-- Tohu Movies: the Friday Pick, new-film alerts and reply emails.
-- Run once in the Supabase SQL Editor. One transaction: if any line
-- fails, nothing changes. Safe to re-run.

begin;

-- ---------- 1. Tables ----------

-- One row per Friday: which film was (or will be) the pick.
create table if not exists public.friday_picks (
  send_date  date primary key,
  film_slug  text not null,
  note       text,
  chosen_by  uuid,
  auto       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.friday_picks enable row level security;
revoke all on public.friday_picks from anon, authenticated;

-- A record of every optional email sent, so nobody gets one twice.
create table if not exists public.email_sends (
  id         bigint generated always as identity primary key,
  kind       text not null,
  key        text not null,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  unique (kind, key, user_id)
);
create index if not exists email_sends_created_idx on public.email_sends (created_at);
alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;

-- ---------- 2. For the site's sending job only ----------
-- These are callable only with the site's private service key.

-- Members who asked for a kind of email and have not had this one.
create or replace function public.email_recipients(p_kind text, p_key text, p_limit int default 100)
returns table (user_id uuid, email text, name text, unsub_token uuid)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, coalesce(p.display_name, ''), e.unsub_token
  from public.email_prefs e
  join auth.users u on u.id = e.user_id
  left join public.profiles p on p.id = e.user_id
  where u.email is not null
    and u.email_confirmed_at is not null
    and not coalesce(p.is_banned, false)
    and case p_kind
          when 'friday_pick' then e.friday_pick
          when 'new_films'   then e.new_films
          else false
        end
    and not exists (
      select 1 from public.email_sends s
      where s.kind = p_kind and s.key = p_key and s.user_id = u.id)
  order by u.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- Approved replies from the last three days whose parent comment's
-- author wants reply emails, has not blocked the replier, and has not
-- been told about this reply yet.
create or replace function public.email_pending_replies(p_limit int default 100)
returns table (
  reply_id text, user_id uuid, email text, name text, unsub_token uuid,
  replier text, body text, film_slug text, film_title text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id::text, u.id, u.email::text, coalesce(pp.display_name, ''), e.unsub_token,
         coalesce(rp.display_name, 'A viewer'), left(r.body, 400), f.slug, f.title
  from public.comments r
  join public.comments parent on parent.id = r.parent_id
  join public.films f on f.slug = r.film_slug and not f.is_hidden
  join auth.users u on u.id = parent.user_id
  join public.email_prefs e on e.user_id = parent.user_id and e.replies
  left join public.profiles pp on pp.id = parent.user_id
  left join public.profiles rp on rp.id = r.user_id
  where r.status = 'approved'
    and r.created_at > now() - interval '3 days'
    and r.user_id <> parent.user_id
    and u.email is not null
    and not coalesce(pp.is_banned, false)
    and not exists (select 1 from public.member_blocks b
                    where b.blocker_id = parent.user_id and b.blocked_id = r.user_id)
    and not exists (select 1 from public.email_sends s
                    where s.kind = 'reply' and s.key = r.id::text and s.user_id = u.id)
  order by r.created_at
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- Claim a send. True only the first time, so two runs never double-send.
create or replace function public.email_claim(p_kind text, p_key text, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.email_sends (kind, key, user_id)
  values (p_kind, p_key, p_user)
  on conflict do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.email_unclaim(p_kind text, p_key text, p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.email_sends where kind = p_kind and key = p_key and user_id = p_user;
$$;

-- The pick for a Friday. If an admin chose one, that; otherwise the
-- most-watched film of the last 30 days that has not been a pick in
-- the last 12 weeks, which is then recorded as that Friday's pick.
create or replace function public.email_friday_pick(p_date date)
returns table (film_slug text, note text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  if not exists (select 1 from public.friday_picks fp
                 join public.films f on f.slug = fp.film_slug and not f.is_hidden
                 where fp.send_date = p_date) then
    select f.slug into v_slug
    from public.films f
    left join public.film_views v
      on v.film_slug = f.slug and v.created_at > now() - interval '30 days'
    where not f.is_hidden
      and f.slug not in (select fp.film_slug from public.friday_picks fp
                         where fp.send_date > p_date - 84)
    group by f.slug, f.created_at
    order by count(v.film_slug) desc, f.created_at desc
    limit 1;
    if v_slug is null then
      return;
    end if;
    insert into public.friday_picks (send_date, film_slug, auto)
    values (p_date, v_slug, true)
    on conflict (send_date) do update set film_slug = excluded.film_slug, auto = true, note = null;
  end if;
  return query select fp.film_slug, fp.note from public.friday_picks fp where fp.send_date = p_date;
end;
$$;

-- Films added in the last seven days (for new-film alerts).
create or replace function public.email_new_films()
returns table (slug text)
language sql
stable
security definer
set search_path = public
as $$
  select f.slug from public.films f
  where not f.is_hidden and f.created_at > now() - interval '7 days'
  order by f.created_at;
$$;

-- ---------- 3. For admins: the Emails tab ----------

create or replace function public.admin_email_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'members',     (select count(*) from auth.users),
    'friday_pick', (select count(*) from public.email_prefs where friday_pick),
    'new_films',   (select count(*) from public.email_prefs where new_films),
    'replies',     (select count(*) from public.email_prefs where replies),
    'sent_7d',     (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (
                      select kind, count(*) as n from public.email_sends
                      where created_at > now() - interval '7 days' group by kind) t),
    'sent_today',  (select count(*) from public.email_sends where created_at > now() - interval '24 hours'),
    'picks',       (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                      select fp.send_date, fp.film_slug, coalesce(f.title, fp.film_slug) as title,
                             fp.note, fp.auto,
                             (select count(*) from public.email_sends s
                              where s.kind = 'friday_pick' and s.key = fp.send_date::text) as sent
                      from public.friday_picks fp
                      left join public.films f on f.slug = fp.film_slug
                      order by fp.send_date desc
                      limit 10) t)
  );
end;
$$;

create or replace function public.admin_set_friday_pick(p_date date, p_slug text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  perform public.require_admin();
  if extract(dow from p_date) <> 5 then
    raise exception 'Choose a Friday.';
  end if;
  if exists (select 1 from public.email_sends s where s.kind = 'friday_pick' and s.key = p_date::text) then
    raise exception 'That Friday''s email has already gone out.';
  end if;
  select f.title into v_title from public.films f where f.slug = p_slug and not f.is_hidden;
  if not found then
    raise exception 'Choose a film that is live on the site.';
  end if;
  insert into public.friday_picks (send_date, film_slug, note, chosen_by, auto)
  values (p_date, p_slug, nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), false)
  on conflict (send_date) do update
    set film_slug = excluded.film_slug, note = excluded.note,
        chosen_by = excluded.chosen_by, auto = false;
  perform public.admin_note('Friday Pick chosen', v_title, 'For ' || to_char(p_date, 'Mon DD'), null);
end;
$$;

-- ---------- 4. Who may call what ----------

revoke all on function public.email_recipients(text, text, int) from public, anon, authenticated;
revoke all on function public.email_pending_replies(int) from public, anon, authenticated;
revoke all on function public.email_claim(text, text, uuid) from public, anon, authenticated;
revoke all on function public.email_unclaim(text, text, uuid) from public, anon, authenticated;
revoke all on function public.email_friday_pick(date) from public, anon, authenticated;
revoke all on function public.email_new_films() from public, anon, authenticated;
grant execute on function public.email_recipients(text, text, int) to service_role;
grant execute on function public.email_pending_replies(int) to service_role;
grant execute on function public.email_claim(text, text, uuid) to service_role;
grant execute on function public.email_unclaim(text, text, uuid) to service_role;
grant execute on function public.email_friday_pick(date) to service_role;
grant execute on function public.email_new_films() to service_role;

revoke all on function public.admin_email_overview() from public, anon;
revoke all on function public.admin_set_friday_pick(date, text, text) from public, anon;
grant execute on function public.admin_email_overview() to authenticated;
grant execute on function public.admin_set_friday_pick(date, text, text) to authenticated;

commit;

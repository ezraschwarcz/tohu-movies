-- Tohu Movies: viewing and sign-up funnels, report a comment, block a
-- member, delete my account.
-- Run once in the Supabase SQL Editor, after 20261116b_super_admins.sql.
-- Runs as one transaction: if any line fails, nothing changes.
-- Safe to re-run.

begin;

-- ---------- 1. Viewing funnel ----------
-- Daily totals only: how many times each film's page was opened, play
-- was pressed, and 25 / 50 / 75 / 100 percent was reached. No record of
-- who; nothing here identifies a viewer.

create table if not exists public.film_events (
  film_slug text   not null,
  event     text   not null,
  day       date   not null default current_date,
  count     bigint not null default 0,
  primary key (film_slug, event, day)
);
alter table public.film_events enable row level security;
revoke all on public.film_events from anon, authenticated;

create or replace function public.track_film_event(p_slug text, p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in ('open', 'play', 'q25', 'q50', 'q75', 'done') then
    return;
  end if;
  if not exists (select 1 from public.films f where f.slug = p_slug) then
    return;
  end if;
  insert into public.film_events (film_slug, event, day, count)
  values (p_slug, p_event, current_date, 1)
  on conflict (film_slug, event, day)
  do update set count = public.film_events.count + 1;
end;
$$;

-- ---------- 2. Sign-up funnel ----------

create table if not exists public.signup_events (
  event text   not null,
  day   date   not null default current_date,
  count bigint not null default 0,
  primary key (event, day)
);
alter table public.signup_events enable row level security;
revoke all on public.signup_events from anon, authenticated;

create or replace function public.track_signup_event(p_event text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event not in ('page_open', 'code_requested', 'code_verified',
                     'google_started', 'welcome_done', 'welcome_skipped') then
    return;
  end if;
  insert into public.signup_events (event, day, count)
  values (p_event, current_date, 1)
  on conflict (event, day)
  do update set count = public.signup_events.count + 1;
end;
$$;

create or replace function public.admin_insights(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_from date := current_date - (v_days - 1);
begin
  perform public.require_admin();
  return jsonb_build_object(
    'days', v_days,
    'viewing', (
      select coalesce(jsonb_object_agg(t.event, t.total), '{}'::jsonb) from (
        select e.event, sum(e.count) as total
        from public.film_events e where e.day >= v_from group by e.event) t),
    'films', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select f.slug, f.title,
               coalesce(sum(e.count) filter (where e.event = 'open'), 0) as open,
               coalesce(sum(e.count) filter (where e.event = 'play'), 0) as play,
               coalesce(sum(e.count) filter (where e.event = 'q25'), 0)  as q25,
               coalesce(sum(e.count) filter (where e.event = 'q50'), 0)  as q50,
               coalesce(sum(e.count) filter (where e.event = 'q75'), 0)  as q75,
               coalesce(sum(e.count) filter (where e.event = 'done'), 0) as done
        from public.film_events e
        join public.films f on f.slug = e.film_slug
        where e.day >= v_from
        group by f.slug, f.title
        order by 4 desc, 3 desc, f.title
        limit 60) t),
    'signup', (
      select coalesce(jsonb_object_agg(t.event, t.total), '{}'::jsonb) from (
        select e.event, sum(e.count) as total
        from public.signup_events e where e.day >= v_from group by e.event) t),
    'new_accounts', (select count(*) from auth.users u where u.created_at >= v_from)
  );
end;
$$;

-- ---------- 3. Report a comment ----------

create table if not exists public.comment_reports (
  id          bigint generated always as identity primary key,
  comment_id  text not null,
  reporter_id uuid not null,
  reason      text,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  unique (comment_id, reporter_id)
);
alter table public.comment_reports enable row level security;
revoke all on public.comment_reports from anon, authenticated;

create or replace function public.report_comment(p_comment text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to report a comment.';
  end if;
  select c.user_id into v_author from public.comments c where c.id::text = p_comment;
  if not found then
    raise exception 'That comment no longer exists.';
  end if;
  if v_author = auth.uid() then
    raise exception 'You cannot report your own comment.';
  end if;
  insert into public.comment_reports (comment_id, reporter_id, reason)
  values (p_comment, auth.uid(), nullif(left(btrim(coalesce(p_reason, '')), 300), ''))
  on conflict (comment_id, reporter_id) do nothing;
end;
$$;

create or replace function public.admin_list_reports()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return (
    select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select c.id::text as id,
             c.film_slug,
             coalesce(f.title, c.film_slug) as film_title,
             c.body,
             c.status,
             c.user_id,
             coalesce(p.display_name, 'A viewer') as display_name,
             coalesce(p.is_banned, false) as is_banned,
             c.created_at,
             count(r.id) as reports,
             coalesce(jsonb_agg(distinct r.reason) filter (where r.reason is not null), '[]'::jsonb) as reasons,
             max(r.created_at) as last_report
      from public.comment_reports r
      join public.comments c on c.id::text = r.comment_id
      left join public.films f on f.slug = c.film_slug
      left join public.profiles p on p.id = c.user_id
      where r.status = 'open'
      group by c.id, c.film_slug, f.title, c.body, c.status, c.user_id,
               p.display_name, p.is_banned, c.created_at
      order by count(r.id) desc, max(r.created_at) desc
      limit 200
    ) t
  );
end;
$$;

create or replace function public.admin_close_reports(p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform public.require_admin();
  update public.comment_reports set status = 'closed'
  where comment_id = p_comment and status = 'open';
  get diagnostics v_count = row_count;
  perform public.admin_note('Reports dismissed', v_count || ' report(s)', null, p_comment);
end;
$$;

-- ---------- 4. Block a member ----------
-- A private list: a member stops seeing the comments of people they
-- block. Nobody else can see who blocked whom.

create table if not exists public.member_blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.member_blocks enable row level security;
revoke all on public.member_blocks from anon, authenticated;
grant select, insert, delete on public.member_blocks to authenticated;

drop policy if exists "members see their own blocks" on public.member_blocks;
create policy "members see their own blocks"
  on public.member_blocks for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "members add their own blocks" on public.member_blocks;
create policy "members add their own blocks"
  on public.member_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "members remove their own blocks" on public.member_blocks;
create policy "members remove their own blocks"
  on public.member_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- ---------- 5. Delete my account ----------
-- Removes the member's comments, likes, watchlist, progress, email
-- choices, blocks, reports and profile, then the account itself.
-- View counts stay but are no longer tied to the member. It cannot be
-- undone. Admins must have their admin access removed first.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := auth.uid();
  v_has_parent boolean;
begin
  if v_me is null then
    raise exception 'Sign in first.';
  end if;
  if public.is_admin() then
    raise exception 'Admin accounts cannot be deleted here. Have your admin access removed first.';
  end if;

  delete from public.comment_likes where user_id = v_me;
  delete from public.comment_likes
  where comment_id in (select c.id from public.comments c where c.user_id = v_me);
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'parent_id'
  ) into v_has_parent;
  if v_has_parent then
    execute 'delete from public.comment_likes where comment_id in
               (select r.id from public.comments r
                where r.parent_id in (select c.id from public.comments c where c.user_id = $1))' using v_me;
    execute 'delete from public.comments r
             where r.parent_id in (select c.id from public.comments c where c.user_id = $1)' using v_me;
  end if;
  delete from public.comment_reports
  where reporter_id = v_me
     or comment_id in (select c.id::text from public.comments c where c.user_id = v_me);
  delete from public.comments where user_id = v_me;
  delete from public.member_blocks where blocker_id = v_me or blocked_id = v_me;
  if to_regclass('public.watchlist') is not null then
    delete from public.watchlist where user_id = v_me;
  end if;
  if to_regclass('public.continue_watching') is not null then
    delete from public.continue_watching where user_id = v_me;
  end if;
  if to_regclass('public.email_prefs') is not null then
    delete from public.email_prefs where user_id = v_me;
  end if;
  if to_regclass('public.film_views') is not null then
    update public.film_views set viewer_id = null where viewer_id = v_me;
  end if;
  delete from public.profiles where id = v_me;

  -- Logged without a name: the point of deleting is to be forgotten.
  insert into public.admin_log (admin_id, action, target, detail)
  values (null, 'Account deleted', 'A member', 'Deleted by the member themself');

  delete from auth.users where id = v_me;
end;
$$;

-- ---------- 6. Who may call what ----------

revoke all on function public.track_film_event(text, text) from public;
revoke all on function public.track_signup_event(text) from public;
revoke all on function public.admin_insights(int) from public, anon;
revoke all on function public.report_comment(text, text) from public, anon;
revoke all on function public.admin_list_reports() from public, anon;
revoke all on function public.admin_close_reports(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;

grant execute on function public.track_film_event(text, text) to anon, authenticated;
grant execute on function public.track_signup_event(text) to anon, authenticated;
grant execute on function public.admin_insights(int) to authenticated;
grant execute on function public.report_comment(text, text) to authenticated;
grant execute on function public.admin_list_reports() to authenticated;
grant execute on function public.admin_close_reports(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

commit;

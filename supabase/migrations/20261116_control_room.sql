-- Tohu Movies: admin control room, member bans, profile bios, cover-art
-- uploads, hidden films, public profiles.
-- Run once in the Supabase SQL Editor. Runs as one transaction: if any
-- line fails, nothing changes. Safe to re-run.

begin;

-- ---------- 1. Profiles: bio and bans ----------

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists is_banned boolean not null default false;
alter table public.profiles add column if not exists banned_reason text;
alter table public.profiles add column if not exists banned_at timestamptz;

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 300);

-- The bio is public, like the display name. Ban details are not.
grant select (bio) on public.profiles to anon, authenticated;
grant insert (bio) on public.profiles to authenticated;
grant update (bio) on public.profiles to authenticated;

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_banned from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_banned() to anon, authenticated;

-- A banned member can still watch, but cannot comment, like, or edit
-- their public profile. These rules stack on top of the existing ones.
drop policy if exists "banned members cannot post comments" on public.comments;
create policy "banned members cannot post comments"
  on public.comments as restrictive for insert to authenticated
  with check (not public.is_banned());

drop policy if exists "banned members cannot edit comments" on public.comments;
create policy "banned members cannot edit comments"
  on public.comments as restrictive for update to authenticated
  using (not public.is_banned())
  with check (not public.is_banned());

drop policy if exists "banned members cannot like" on public.comment_likes;
create policy "banned members cannot like"
  on public.comment_likes as restrictive for insert to authenticated
  with check (not public.is_banned());

drop policy if exists "banned members cannot edit profile" on public.profiles;
create policy "banned members cannot edit profile"
  on public.profiles as restrictive for update to authenticated
  using (not public.is_banned());

-- ---------- 2. Films: hide without deleting, uploaded cover art ----------

alter table public.films add column if not exists is_hidden boolean not null default false;
alter table public.films add column if not exists poster_url text;

alter table public.films enable row level security;

drop policy if exists "films readable by everyone (control room)" on public.films;
create policy "films readable by everyone (control room)"
  on public.films for select to anon, authenticated
  using (true);

drop policy if exists "hidden films are admin only" on public.films;
create policy "hidden films are admin only"
  on public.films as restrictive for select to anon, authenticated
  using (not is_hidden or public.is_admin());

-- Cover art uploaded from the admin page lives in a public bucket.
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do update set public = true;

drop policy if exists "poster files are public" on storage.objects;
create policy "poster files are public"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'posters');

drop policy if exists "admins add poster files" on storage.objects;
create policy "admins add poster files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and public.is_admin());

drop policy if exists "admins replace poster files" on storage.objects;
create policy "admins replace poster files"
  on storage.objects for update to authenticated
  using (bucket_id = 'posters' and public.is_admin())
  with check (bucket_id = 'posters' and public.is_admin());

drop policy if exists "admins delete poster files" on storage.objects;
create policy "admins delete poster files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and public.is_admin());

-- ---------- 3. A record of what admins did ----------

create table if not exists public.admin_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid,
  action     text not null,
  target     text,
  detail     text,
  created_at timestamptz not null default now()
);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_note(p_action text, p_target text, p_detail text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_log (admin_id, action, target, detail)
  values (auth.uid(), p_action, p_target, p_detail);
$$;
revoke all on function public.require_admin() from public, anon, authenticated;
revoke all on function public.admin_note(text, text, text) from public, anon, authenticated;

-- ---------- 4. Admin: overview ----------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'members',          (select count(*) from auth.users),
    'members_7d',       (select count(*) from auth.users u where u.created_at > now() - interval '7 days'),
    'members_30d',      (select count(*) from auth.users u where u.created_at > now() - interval '30 days'),
    'admins',           (select count(*) from public.profiles p where p.is_admin),
    'banned',           (select count(*) from public.profiles p where p.is_banned),
    'films',            (select count(*) from public.films f where not f.is_hidden),
    'hidden_films',     (select count(*) from public.films f where f.is_hidden),
    'comments',         (select count(*) from public.comments c where c.status = 'approved'),
    'pending_comments', (select count(*) from public.comments c where c.status = 'pending'),
    'views_7d',         (select count(*) from public.film_views v where v.created_at > now() - interval '7 days'),
    'views_30d',        (select count(*) from public.film_views v where v.created_at > now() - interval '30 days'),
    'views_all',        (select count(*) from public.film_views),
    'top_films',        (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                           select f.slug, f.title, count(*) as views
                           from public.film_views v
                           join public.films f on f.slug = v.film_slug
                           where v.created_at > now() - interval '30 days'
                           group by f.slug, f.title
                           order by count(*) desc, f.title
                           limit 10) t),
    'sources',          (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                           select coalesce(nullif(u.raw_user_meta_data->>'signup_source', ''), 'not recorded') as source,
                                  count(*) as members
                           from auth.users u
                           where u.created_at > now() - interval '30 days'
                           group by 1
                           order by count(*) desc
                           limit 8) t),
    'recent',           (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                           select l.action, l.target, l.detail, l.created_at,
                                  coalesce(p.display_name, 'An admin') as admin
                           from public.admin_log l
                           left join public.profiles p on p.id = l.admin_id
                           order by l.created_at desc
                           limit 15) t)
  );
end;
$$;

-- ---------- 5. Admin: members ----------

create or replace function public.admin_list_members(
  p_search text default '',
  p_filter text default 'all',
  p_limit  int  default 50,
  p_offset int  default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := btrim(coalesce(p_search, ''));
begin
  perform public.require_admin();
  return (
    select coalesce(jsonb_agg(t), '[]'::jsonb) from (
      select u.id,
             u.email,
             coalesce(p.display_name, '') as display_name,
             p.avatar_preset,
             p.avatar_url,
             u.created_at,
             u.last_sign_in_at,
             coalesce(p.is_admin, false)  as is_admin,
             coalesce(p.is_banned, false) as is_banned,
             p.banned_reason,
             (select count(*) from public.comments c where c.user_id = u.id) as comments
      from auth.users u
      left join public.profiles p on p.id = u.id
      where (v_search = ''
             or u.email ilike '%' || v_search || '%'
             or p.display_name ilike '%' || v_search || '%')
        and (p_filter = 'all'
             or (p_filter = 'admins' and coalesce(p.is_admin, false))
             or (p_filter = 'banned' and coalesce(p.is_banned, false)))
      order by u.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
      offset greatest(coalesce(p_offset, 0), 0)
    ) t
  );
end;
$$;

create or replace function public.admin_set_banned(
  p_user uuid,
  p_banned boolean,
  p_reason text default null,
  p_hide_comments boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_is_admin boolean;
begin
  perform public.require_admin();
  if p_user = auth.uid() then
    raise exception 'You cannot ban yourself.';
  end if;
  select p.display_name, p.is_admin into v_name, v_is_admin
  from public.profiles p where p.id = p_user;
  if not found then
    raise exception 'That member has no profile yet.';
  end if;
  if p_banned and v_is_admin then
    raise exception 'Remove this member''s admin access before banning them.';
  end if;
  update public.profiles
  set is_banned     = p_banned,
      banned_reason = case when p_banned then nullif(btrim(coalesce(p_reason, '')), '') else null end,
      banned_at     = case when p_banned then now() else null end
  where id = p_user;
  if p_banned and p_hide_comments then
    update public.comments set status = 'rejected' where user_id = p_user;
  end if;
  perform public.admin_note(
    case when p_banned then 'Banned member' else 'Lifted ban' end,
    v_name,
    case when p_banned then nullif(btrim(coalesce(p_reason, '')), '') else null end
  );
end;
$$;

create or replace function public.admin_set_admin(p_user uuid, p_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_banned boolean;
begin
  perform public.require_admin();
  if p_user = auth.uid() then
    raise exception 'You cannot change your own admin access. Ask another admin.';
  end if;
  select p.display_name, p.is_banned into v_name, v_banned
  from public.profiles p where p.id = p_user;
  if not found then
    raise exception 'That member has no profile yet.';
  end if;
  if p_admin and v_banned then
    raise exception 'Lift this member''s ban before making them an admin.';
  end if;
  update public.profiles set is_admin = p_admin where id = p_user;
  perform public.admin_note(
    case when p_admin then 'Made admin' else 'Removed admin' end, v_name, null);
end;
$$;

-- ---------- 6. Admin: comments ----------

create or replace function public.admin_list_comments(
  p_status text default 'pending',
  p_search text default '',
  p_limit  int  default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := btrim(coalesce(p_search, ''));
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
             c.created_at
      from public.comments c
      left join public.films f on f.slug = c.film_slug
      left join public.profiles p on p.id = c.user_id
      where (p_status = 'all' or c.status = p_status)
        and (v_search = ''
             or c.body ilike '%' || v_search || '%'
             or p.display_name ilike '%' || v_search || '%'
             or f.title ilike '%' || v_search || '%')
      order by case when p_status = 'pending' then c.created_at end asc,
               c.created_at desc
      limit least(greatest(coalesce(p_limit, 100), 1), 300)
    ) t
  );
end;
$$;

create or replace function public.admin_moderate_comment(p_id text, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
  v_has_parent boolean;
begin
  perform public.require_admin();
  select left(c.body, 80) into v_body from public.comments c where c.id::text = p_id;
  if not found then
    raise exception 'That comment no longer exists.';
  end if;
  if p_action in ('approved', 'rejected', 'pending') then
    update public.comments set status = p_action where id::text = p_id;
    perform public.admin_note('Comment ' || p_action, v_body, null);
  elsif p_action = 'delete' then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'comments' and column_name = 'parent_id'
    ) into v_has_parent;
    if v_has_parent then
      execute 'delete from public.comment_likes where comment_id in
                 (select id from public.comments where parent_id::text = $1)' using p_id;
      execute 'delete from public.comments where parent_id::text = $1' using p_id;
    end if;
    delete from public.comment_likes where comment_id::text = p_id;
    delete from public.comments where id::text = p_id;
    perform public.admin_note('Comment deleted', v_body, null);
  else
    raise exception 'Unknown action.';
  end if;
end;
$$;

-- ---------- 7. Admin: films ----------

create or replace function public.admin_list_films()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return (
    select coalesce(jsonb_agg(t order by t.created_at desc), '[]'::jsonb) from (
      select f.slug, f.title, f.year, f.genre, f.director, f.cast_text, f.rating,
             f.runtime_minutes, f.synopsis, f.warnings, f.playback_id,
             f.is_hidden, f.poster_url, f.created_at,
             (select count(*) from public.film_views v where v.film_slug = f.slug) as views,
             (select count(*) from public.comments c where c.film_slug = f.slug) as comments
      from public.films f
    ) t
  );
end;
$$;

-- Add a film (p_original_slug null) or edit one. The page address
-- (slug) never changes once a film exists, so shared links keep working.
create or replace function public.admin_save_film(p_original_slug text, p_film jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug    text := lower(btrim(coalesce(p_film->>'slug', '')));
  v_title   text := btrim(coalesce(p_film->>'title', ''));
  v_year    int  := (p_film->>'year')::int;
  v_runtime int  := (p_film->>'runtime_minutes')::int;
  v_playback text := btrim(coalesce(p_film->>'playback_id', ''));
begin
  perform public.require_admin();
  if v_title = '' then raise exception 'Enter a title.'; end if;
  if v_year is null or v_year < 1900 or v_year > 2100 then raise exception 'Enter a valid year.'; end if;
  if v_runtime is null or v_runtime <= 0 then raise exception 'Enter the runtime in minutes.'; end if;
  if v_playback = '' then raise exception 'Enter the Mux playback ID.'; end if;

  if p_original_slug is null then
    if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'The page address can only use lowercase letters, numbers and dashes.';
    end if;
    if exists (select 1 from public.films f where f.slug = v_slug) then
      raise exception 'A film already uses the address /films/%.', v_slug;
    end if;
    insert into public.films
      (slug, title, year, genre, director, cast_text, rating, runtime_minutes,
       synopsis, warnings, playback_id, is_hidden, poster_url)
    values
      (v_slug, v_title, v_year,
       btrim(coalesce(p_film->>'genre', '')),
       btrim(coalesce(p_film->>'director', '')),
       btrim(coalesce(p_film->>'cast_text', '')),
       coalesce(nullif(btrim(coalesce(p_film->>'rating', '')), ''), 'NR'),
       v_runtime,
       btrim(coalesce(p_film->>'synopsis', '')),
       btrim(coalesce(p_film->>'warnings', '')),
       v_playback,
       coalesce((p_film->>'is_hidden')::boolean, false),
       nullif(btrim(coalesce(p_film->>'poster_url', '')), ''));
    perform public.admin_note('Film added', v_title, null);
    return v_slug;
  end if;

  update public.films f
  set title           = v_title,
      year            = v_year,
      genre           = btrim(coalesce(p_film->>'genre', '')),
      director        = btrim(coalesce(p_film->>'director', '')),
      cast_text       = btrim(coalesce(p_film->>'cast_text', '')),
      rating          = coalesce(nullif(btrim(coalesce(p_film->>'rating', '')), ''), 'NR'),
      runtime_minutes = v_runtime,
      synopsis        = btrim(coalesce(p_film->>'synopsis', '')),
      warnings        = btrim(coalesce(p_film->>'warnings', '')),
      playback_id     = v_playback,
      is_hidden       = coalesce((p_film->>'is_hidden')::boolean, f.is_hidden),
      poster_url      = case when p_film ? 'poster_url'
                             then nullif(btrim(coalesce(p_film->>'poster_url', '')), '')
                             else f.poster_url end
  where f.slug = p_original_slug;
  if not found then
    raise exception 'That film no longer exists.';
  end if;
  perform public.admin_note('Film edited', v_title, null);
  return p_original_slug;
end;
$$;

create or replace function public.admin_set_film_hidden(p_slug text, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  perform public.require_admin();
  update public.films set is_hidden = p_hidden where slug = p_slug returning title into v_title;
  if not found then
    raise exception 'That film no longer exists.';
  end if;
  perform public.admin_note(case when p_hidden then 'Film hidden' else 'Film shown' end, v_title, null);
end;
$$;

-- Deleting a film also removes its ratings, comments, watchlist
-- entries, progress and view records. It cannot be undone.
create or replace function public.admin_delete_film(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_table text;
begin
  perform public.require_admin();
  select f.title into v_title from public.films f where f.slug = p_slug;
  if not found then
    raise exception 'That film no longer exists.';
  end if;
  delete from public.comment_likes
  where comment_id in (select c.id from public.comments c where c.film_slug = p_slug);
  foreach v_table in array array['comments', 'ratings', 'watchlist', 'continue_watching', 'film_views']
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('delete from public.%I where film_slug = $1', v_table) using p_slug;
    end if;
  end loop;
  delete from public.films where slug = p_slug;
  perform public.admin_note('Film deleted', v_title, null);
end;
$$;

-- ---------- 8. Public profile ----------

-- What anyone may see about a member: name, picture, bio, the month
-- they joined, and their approved comments. Banned members have none.
create or replace function public.public_profile(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'avatar_preset', p.avatar_preset,
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'created_at', p.created_at,
    'comment_count', (select count(*) from public.comments c
                      where c.user_id = p.id and c.status = 'approved'),
    'comments', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                   select c.id::text as id, c.body, c.created_at, c.film_slug,
                          coalesce(f.title, c.film_slug) as film_title
                   from public.comments c
                   join public.films f on f.slug = c.film_slug and not f.is_hidden
                   where c.user_id = p.id and c.status = 'approved'
                   order by c.created_at desc
                   limit 20) t)
  )
  from public.profiles p
  where p.id = p_id and not p.is_banned;
$$;

-- ---------- 9. Who may call what ----------

revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_list_members(text, text, int, int) from public, anon;
revoke all on function public.admin_set_banned(uuid, boolean, text, boolean) from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
revoke all on function public.admin_list_comments(text, text, int) from public, anon;
revoke all on function public.admin_moderate_comment(text, text) from public, anon;
revoke all on function public.admin_list_films() from public, anon;
revoke all on function public.admin_save_film(text, jsonb) from public, anon;
revoke all on function public.admin_set_film_hidden(text, boolean) from public, anon;
revoke all on function public.admin_delete_film(text) from public, anon;
revoke all on function public.public_profile(uuid) from public;

grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_list_members(text, text, int, int) to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean, text, boolean) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_list_comments(text, text, int) to authenticated;
grant execute on function public.admin_moderate_comment(text, text) to authenticated;
grant execute on function public.admin_list_films() to authenticated;
grant execute on function public.admin_save_film(text, jsonb) to authenticated;
grant execute on function public.admin_set_film_hidden(text, boolean) to authenticated;
grant execute on function public.admin_delete_film(text) to authenticated;
grant execute on function public.public_profile(uuid) to anon, authenticated;

commit;

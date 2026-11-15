-- Tohu Movies: privacy hardening. Run once in the Supabase SQL Editor,
-- AFTER Update 3 of the site code is live (Vercel shows Ready).
-- Runs as one transaction: if any line fails, nothing changes.
-- Safe to re-run.
--
-- What it fixes
--   1. Ratings: anyone could change or delete every rating. Now a
--      rating can only be written through functions that touch the
--      caller's own rating, and voter ids are no longer readable.
--   2. Profiles: the is_admin flag was readable by everyone. Now only
--      public fields are readable, and members can only edit their
--      own name and avatar.

begin;

-- ---------- 1. Ratings ----------

create or replace function public.rate_film(p_slug text, p_stars int, p_voter text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'stars must be between 1 and 5';
  end if;
  if p_voter is null or length(p_voter) < 8 or length(p_voter) > 80 then
    raise exception 'invalid voter id';
  end if;
  if not exists (select 1 from public.films where slug = p_slug) then
    raise exception 'unknown film';
  end if;
  select format_type(a.atttypid, a.atttypmod) into v_type
  from pg_attribute a
  where a.attrelid = 'public.ratings'::regclass and a.attname = 'voter_id';
  execute format(
    'insert into public.ratings (film_slug, stars, voter_id)
     values ($1, $2, $3::%s)
     on conflict (film_slug, voter_id)
     do update set stars = excluded.stars, updated_at = now()', v_type)
  using p_slug, p_stars, p_voter;
end;
$$;

create or replace function public.clear_film_rating(p_slug text, p_voter text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ratings
  where film_slug = p_slug and voter_id::text = p_voter;
$$;

create or replace function public.my_film_ratings(p_voter text)
returns table (film_slug text, stars int, title text)
language sql
stable
security definer
set search_path = public
as $$
  select r.film_slug, r.stars::int, f.title
  from public.ratings r
  join public.films f on f.slug = r.film_slug
  where r.voter_id::text = p_voter
  order by r.created_at desc;
$$;

revoke all on function public.rate_film(text, int, text) from public;
revoke all on function public.clear_film_rating(text, text) from public;
revoke all on function public.my_film_ratings(text) from public;
grant execute on function public.rate_film(text, int, text) to anon, authenticated;
grant execute on function public.clear_film_rating(text, text) to anon, authenticated;
grant execute on function public.my_film_ratings(text) to anon, authenticated;

-- Close direct writes; the functions above are now the only way in.
drop policy if exists "ratings deletable by voter" on public.ratings;
drop policy if exists "ratings updatable by everyone" on public.ratings;
drop policy if exists "ratings insertable by everyone" on public.ratings;
revoke all on public.ratings from anon, authenticated;
-- Averages still need the film and the stars; voter ids stay private.
grant select (film_slug, stars) on public.ratings to anon, authenticated;

-- ---------- 2. Profiles ----------

-- The site and the security rules ask is_admin() for the caller's own
-- status. It is (re)defined here to run with the database owner's
-- rights, so it keeps working once the column is hidden below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

revoke all on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_preset, avatar_url, created_at, updated_at)
  on public.profiles to anon, authenticated;
grant insert (id, display_name, avatar_preset, avatar_url)
  on public.profiles to authenticated;
grant update (display_name, avatar_preset, avatar_url)
  on public.profiles to authenticated;

-- The old update rule compared is_admin against itself, which needs
-- read access to that column. The column grants above already make
-- is_admin impossible to change, so the rule only checks ownership.
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- 3. Tidy: tables nobody anonymous should write ----------
revoke insert, update, delete, truncate on public.films from anon;
revoke update, delete, truncate on public.films from authenticated;
revoke insert, update, delete, truncate on public.comments from anon;
revoke truncate on public.comments from authenticated;
revoke insert, update, delete, truncate on public.watchlist from anon;
revoke insert, update, delete, truncate on public.continue_watching from anon;
revoke insert, update, delete, truncate on public.comment_likes from anon;

commit;

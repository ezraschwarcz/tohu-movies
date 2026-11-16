-- Tohu Movies: ratings tied to accounts, viewing history, profile summary.
-- Run once in the Supabase SQL Editor. One transaction; safe to re-run.

begin;

-- ---------- 1. Ratings can belong to an account ----------

alter table public.ratings add column if not exists user_id uuid;
create index if not exists ratings_user_idx on public.ratings (user_id);

-- Same call as before. When the rater is signed in, the rating is also
-- tied to their account, and any older rating of the same film from
-- another of their devices is removed so a film is never counted twice.
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
  if auth.uid() is not null then
    delete from public.ratings
    where film_slug = p_slug and user_id = auth.uid() and voter_id::text <> p_voter;
  end if;
  execute format(
    'insert into public.ratings (film_slug, stars, voter_id, user_id)
     values ($1, $2, $3::%s, $4)
     on conflict (film_slug, voter_id)
     do update set stars = excluded.stars, updated_at = now(),
                   user_id = coalesce(excluded.user_id, public.ratings.user_id)', v_type)
  using p_slug, p_stars, p_voter, auth.uid();
end;
$$;

create or replace function public.clear_film_rating(p_slug text, p_voter text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ratings
  where film_slug = p_slug
    and (voter_id::text = p_voter or (auth.uid() is not null and user_id = auth.uid()));
$$;

-- This device's ratings plus, when signed in, the account's.
create or replace function public.my_film_ratings(p_voter text)
returns table (film_slug text, stars int, title text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (r.film_slug) r.film_slug, r.stars::int, f.title
  from public.ratings r
  join public.films f on f.slug = r.film_slug
  where r.voter_id::text = p_voter
     or (auth.uid() is not null and r.user_id = auth.uid())
  order by r.film_slug, (r.user_id is not null) desc, r.updated_at desc;
$$;

-- On sign-in: attach this device's earlier ratings to the account.
-- Where the account already rated a film, the account's rating stays
-- and the device's duplicate is removed.
create or replace function public.claim_my_ratings(p_voter text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null or p_voter is null or length(p_voter) < 8 then
    return 0;
  end if;
  delete from public.ratings d
  where d.voter_id::text = p_voter and d.user_id is null
    and exists (select 1 from public.ratings a
                where a.film_slug = d.film_slug and a.user_id = auth.uid());
  update public.ratings set user_id = auth.uid()
  where voter_id::text = p_voter and user_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- 2. Everything the profile page shows, in one call ----------

create or replace function public.my_profile_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'member_since', (select u.created_at from auth.users u where u.id = auth.uid()),
    'bio',          (select p.bio from public.profiles p where p.id = auth.uid()),
    'watchlist',    (select count(*) from public.watchlist w where w.user_id = auth.uid()),
    'comments',     (select count(*) from public.comments c where c.user_id = auth.uid() and c.status = 'approved'),
    'rated',        (select count(*) from public.ratings r where r.user_id = auth.uid()),
    'started',      (select count(*) from public.continue_watching cw where cw.user_id = auth.uid()),
    'finished',     (select count(*) from public.continue_watching cw
                     where cw.user_id = auth.uid() and cw.duration_seconds > 0
                       and cw.position_seconds::numeric / cw.duration_seconds >= 0.9),
    'minutes',      (select coalesce(sum(cw.position_seconds), 0) / 60 from public.continue_watching cw
                     where cw.user_id = auth.uid()),
    'history',      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select cw.film_slug, f.title, f.year, f.playback_id, f.poster_url,
                              cw.position_seconds, cw.duration_seconds, cw.updated_at
                       from public.continue_watching cw
                       join public.films f on f.slug = cw.film_slug and not f.is_hidden
                       where cw.user_id = auth.uid()
                       order by cw.updated_at desc
                       limit 100) t),
    'ratings',      (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select r.film_slug, f.title, f.year, f.poster_url, r.stars::int as stars, r.updated_at
                       from public.ratings r
                       join public.films f on f.slug = r.film_slug and not f.is_hidden
                       where r.user_id = auth.uid()
                       order by r.updated_at desc
                       limit 200) t),
    'recent_comments', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
                       select c.id::text as id, c.body, c.status, c.created_at, c.film_slug,
                              coalesce(f.title, c.film_slug) as film_title
                       from public.comments c
                       left join public.films f on f.slug = c.film_slug
                       where c.user_id = auth.uid()
                       order by c.created_at desc
                       limit 5) t)
  ) end;
$$;

-- Remove one film from your history, or all of it.
create or replace function public.clear_my_history(p_slug text default null)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.continue_watching
  where user_id = auth.uid() and (p_slug is null or film_slug = p_slug);
$$;

revoke all on function public.rate_film(text, int, text) from public;
revoke all on function public.clear_film_rating(text, text) from public;
revoke all on function public.my_film_ratings(text) from public;
revoke all on function public.claim_my_ratings(text) from public, anon;
revoke all on function public.my_profile_summary() from public, anon;
revoke all on function public.clear_my_history(text) from public, anon;
grant execute on function public.rate_film(text, int, text) to anon, authenticated;
grant execute on function public.clear_film_rating(text, text) to anon, authenticated;
grant execute on function public.my_film_ratings(text) to anon, authenticated;
grant execute on function public.claim_my_ratings(text) to authenticated;
grant execute on function public.my_profile_summary() to authenticated;
grant execute on function public.clear_my_history(text) to authenticated;

commit;

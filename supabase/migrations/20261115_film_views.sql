-- Tohu Movies: view tracking (run once in the Supabase SQL Editor).
-- Additive and safe to re-run. Changes no existing table or policy.
--
-- What it adds
--   film_views          one row per counted view (30s of real playback)
--   record_film_view()  the only way to write a view (called by the player)
--   film_view_counts()  per-film totals for the last N days (Trending row)
--
-- Privacy: the table is not readable by visitors. Only aggregated counts
-- leave the database. viewer_id is the signed-in user's id, or null.

create table if not exists public.film_views (
  id         bigint generated always as identity primary key,
  film_slug  text not null references public.films (slug) on delete cascade,
  viewer_id  uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists film_views_slug_created_idx
  on public.film_views (film_slug, created_at desc);
create index if not exists film_views_viewer_idx
  on public.film_views (viewer_id) where viewer_id is not null;

alter table public.film_views enable row level security;
-- No policies on purpose: nobody reads or writes the table directly.
revoke all on public.film_views from anon, authenticated;

create or replace function public.record_film_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.films where slug = p_slug) then
    return;
  end if;
  -- A signed-in viewer counts at most once per film per 6 hours.
  if auth.uid() is not null and exists (
    select 1 from public.film_views
    where film_slug = p_slug
      and viewer_id = auth.uid()
      and created_at > now() - interval '6 hours'
  ) then
    return;
  end if;
  insert into public.film_views (film_slug, viewer_id)
  values (p_slug, auth.uid());
end;
$$;

create or replace function public.film_view_counts(p_days int default 30)
returns table (film_slug text, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.film_slug, count(*)::bigint as views
  from public.film_views v
  where v.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  group by v.film_slug;
$$;

revoke all on function public.record_film_view(text) from public;
revoke all on function public.film_view_counts(int) from public;
grant execute on function public.record_film_view(text) to anon, authenticated;
grant execute on function public.film_view_counts(int) to anon, authenticated;

-- Stand-in for the tables Tohu's database had before the scripts in
-- supabase/migrations were written (they were created in the Supabase
-- dashboard). Only what the migrations build on; enough to run them and test
-- the rules they add. The real database is checked separately, from outside,
-- by tests/db/live.test.mjs.

create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz, banned_until timestamptz, deleted_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id bigint generated always as identity primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
create table public.profiles (id uuid primary key references auth.users(id), display_name text not null, is_admin boolean not null default false, avatar_preset text, avatar_url text, created_at timestamptz default now(), updated_at timestamptz default now());
alter table public.profiles enable row level security;
create policy "read" on public.profiles for select using (true);
create policy "users can update their own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create table public.films (slug text primary key, title text not null, year int not null, genre text not null default '', director text not null default '', cast_text text not null default '', rating text not null default 'NR', runtime_minutes int not null, synopsis text not null default '', warnings text not null default '', playback_id text not null, created_at timestamptz not null default now());
alter table public.films enable row level security;
create policy "films are readable by everyone" on public.films for select using (true);
create table public.comments (id uuid primary key default gen_random_uuid(), film_slug text references public.films(slug), body text, status text default 'pending', user_id uuid, parent_id uuid references public.comments(id), created_at timestamptz default now());
alter table public.comments enable row level security;
create policy "ins" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "sel" on public.comments for select using (true);
create table public.comment_likes (comment_id uuid references public.comments(id), user_id uuid);
alter table public.comment_likes enable row level security;
create policy "ins" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
create table public.ratings (film_slug text references public.films(slug), stars int, voter_id text, created_at timestamptz default now(), updated_at timestamptz default now(), primary key (film_slug, voter_id));
alter table public.ratings enable row level security;
create table public.watchlist (film_slug text references public.films(slug), user_id uuid references auth.users(id) on delete cascade, created_at timestamptz default now(), primary key (user_id, film_slug));
alter table public.watchlist enable row level security;
create policy "own" on public.watchlist for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.continue_watching (film_slug text references public.films(slug), user_id uuid references auth.users(id) on delete cascade, position_seconds numeric default 0, duration_seconds numeric default 0, updated_at timestamptz default now(), primary key (user_id, film_slug));
alter table public.continue_watching enable row level security;
create policy "own" on public.continue_watching for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.film_views (id bigint generated always as identity primary key, film_slug text references public.films(slug) on delete cascade, viewer_id uuid, created_at timestamptz default now());
grant usage on schema public, auth to anon, authenticated;
grant select on public.films to anon, authenticated;
grant select, insert, update, delete on public.comments, public.comment_likes to authenticated;
grant select (id, display_name, avatar_preset, avatar_url, created_at, updated_at) on public.profiles to anon, authenticated;
grant update (display_name, avatar_preset, avatar_url) on public.profiles to authenticated;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) $$;

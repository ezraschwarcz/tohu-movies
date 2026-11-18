-- Fixes from Supabase's Security Advisor (Nov 17, 2026). Safe to run again.
--
-- 1. handle_new_user sets up a profile when someone signs up. It runs on its
--    own as a trigger; nobody should be able to call it through the API.
-- 2. set_updated_at gets a fixed search path, so it can't be pointed at
--    look-alike functions.
-- 3. Photos and cover art stay public by their address, but visitors can no
--    longer list every file in the avatars and posters folders. Members can
--    still see (and so replace or delete) their own photo; admins their posters.
--
-- Left as they are, on purpose: the other functions the advisor lists either
-- check for an admin inside (admin_*), or are meant for visitors (ratings,
-- view counts, unsubscribe, submitting a film, public profiles). Tables with
-- row level security and no policies are private by design.

do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    revoke execute on function public.handle_new_user() from public, anon, authenticated;
  end if;
  if to_regprocedure('public.set_updated_at()') is not null then
    alter function public.set_updated_at() set search_path = pg_catalog, public;
  end if;
end $$;

drop policy if exists "avatars readable by everyone" on storage.objects;
drop policy if exists "members see their own photo files" on storage.objects;
create policy "members see their own photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "poster files are public" on storage.objects;
drop policy if exists "admins see poster files" on storage.objects;
create policy "admins see poster files"
  on storage.objects for select to authenticated
  using (bucket_id = 'posters' and public.is_admin());

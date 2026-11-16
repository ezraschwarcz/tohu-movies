-- Tohu Movies: email preferences. Run once in the Supabase SQL Editor.
-- Additive and safe to re-run. Changes no existing table or policy.
--
-- What it adds
--   email_prefs          one row per member: which emails they want
--   unsubscribe_email()  one-click unsubscribe from a link in an email,
--                        without signing in

begin;

create table if not exists public.email_prefs (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  -- Optional emails: off until the member opts in.
  friday_pick boolean not null default false,
  new_films   boolean not null default false,
  -- Activity emails: on by default, each with its own off switch.
  replies     boolean not null default true,
  reminders   boolean not null default true,
  -- Secret token carried by unsubscribe links.
  unsub_token uuid not null default gen_random_uuid() unique,
  welcomed_at timestamptz,
  -- When the member answered the one-time "want emails?" prompt.
  optin_asked_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Safe to re-run on a table made by an earlier version of this script.
alter table public.email_prefs add column if not exists optin_asked_at timestamptz;

alter table public.email_prefs enable row level security;

drop policy if exists "email prefs readable by owner" on public.email_prefs;
create policy "email prefs readable by owner"
  on public.email_prefs for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "email prefs insertable by owner" on public.email_prefs;
create policy "email prefs insertable by owner"
  on public.email_prefs for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "email prefs updatable by owner" on public.email_prefs;
create policy "email prefs updatable by owner"
  on public.email_prefs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.email_prefs from anon, authenticated;
grant select on public.email_prefs to authenticated;
grant insert (user_id, friday_pick, new_films, replies, reminders)
  on public.email_prefs to authenticated;
grant update (friday_pick, new_films, replies, reminders, welcomed_at, optin_asked_at, updated_at)
  on public.email_prefs to authenticated;

-- One-click unsubscribe. p_kind is one of: friday_pick, new_films,
-- replies, reminders, all. Returns the kind that was turned off, or
-- null when the token is not recognized.
create or replace function public.unsubscribe_email(p_token uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(coalesce(p_kind, 'all'));
begin
  if v_kind not in ('friday_pick', 'new_films', 'replies', 'reminders', 'all') then
    v_kind := 'all';
  end if;
  update public.email_prefs set
    friday_pick = case when v_kind in ('friday_pick', 'all') then false else friday_pick end,
    new_films   = case when v_kind in ('new_films', 'all')   then false else new_films end,
    replies     = case when v_kind in ('replies', 'all')     then false else replies end,
    reminders   = case when v_kind in ('reminders', 'all')   then false else reminders end,
    updated_at  = now()
  where unsub_token = p_token;
  if not found then
    return null;
  end if;
  return v_kind;
end;
$$;

revoke all on function public.unsubscribe_email(uuid, text) from public;
grant execute on function public.unsubscribe_email(uuid, text) to anon, authenticated;

commit;

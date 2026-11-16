-- Tohu Movies: "Submit your film" form.
-- Run once in the Supabase SQL Editor. One transaction; safe to re-run.

begin;

create table if not exists public.film_submissions (
  id         bigint generated always as identity primary key,
  title      text not null,
  year       int,
  role       text,
  name       text not null,
  email      text not null,
  link       text,
  rights     text,
  message    text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.film_submissions enable row level security;
revoke all on public.film_submissions from anon, authenticated;

-- Anyone may submit. Lengths are capped, and the whole form stops
-- accepting entries after 40 in a day, so it cannot be flooded.
create or replace function public.submit_film(p jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p->>'title', ''));
  v_name  text := btrim(coalesce(p->>'name', ''));
  v_email text := btrim(coalesce(p->>'email', ''));
  v_id bigint;
begin
  if v_title = '' or v_name = '' then
    raise exception 'Please give the film title and your name.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please give a valid email address.';
  end if;
  if (select count(*) from public.film_submissions
      where created_at > now() - interval '1 day') >= 40 then
    raise exception 'We have received a lot of submissions today. Please try again tomorrow, or email hello@tohumovies.com.';
  end if;
  insert into public.film_submissions (title, year, role, name, email, link, rights, message)
  values (
    left(v_title, 200),
    case when (p->>'year') ~ '^\d{4}$' then (p->>'year')::int end,
    left(btrim(coalesce(p->>'role', '')), 80),
    left(v_name, 120),
    left(v_email, 200),
    left(btrim(coalesce(p->>'link', '')), 500),
    left(btrim(coalesce(p->>'rights', '')), 300),
    left(btrim(coalesce(p->>'message', '')), 2000))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_list_submissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select * from public.film_submissions
    order by (status = 'new') desc, created_at desc
    limit 200) t);
end;
$$;

create or replace function public.admin_set_submission_status(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  perform public.require_admin();
  if p_status not in ('new', 'reviewed', 'accepted', 'declined') then
    raise exception 'Unknown status.';
  end if;
  update public.film_submissions set status = p_status where id = p_id returning title into v_title;
  if not found then
    raise exception 'That submission no longer exists.';
  end if;
  perform public.admin_note('Submission ' || p_status, v_title, null, null);
end;
$$;

-- For the site's notification email: super admins' addresses.
create or replace function public.super_admin_emails()
returns table (email text)
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text from auth.users u
  join public.profiles p on p.id = u.id
  where p.is_admin and p.is_super_admin and u.email is not null;
$$;

revoke all on function public.submit_film(jsonb) from public;
grant execute on function public.submit_film(jsonb) to anon, authenticated;
revoke all on function public.admin_list_submissions() from public, anon;
revoke all on function public.admin_set_submission_status(bigint, text) from public, anon;
grant execute on function public.admin_list_submissions() to authenticated;
grant execute on function public.admin_set_submission_status(bigint, text) to authenticated;
revoke all on function public.super_admin_emails() from public, anon, authenticated;
grant execute on function public.super_admin_emails() to service_role;

commit;

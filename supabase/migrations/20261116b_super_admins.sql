-- Tohu Movies: super admins, a fuller admin log, member counts.
-- Run once in the Supabase SQL Editor, AFTER 20261116_control_room.sql.
-- Runs as one transaction: if any line fails, nothing changes.
-- Safe to re-run. The last line shows who the super admins are.
--
-- The rules this sets
--   Member -> admin ............ super admins only
--   Admin -> super admin ....... super admins only
--   Admin -> member ............ any admin, but never a super admin
--   Super admin -> anything .... nobody, from the site. Only by hand,
--                                here in the database.
--   Nobody can change their own access.
--   Every change is written to the admin log, which the site can read
--   but never edit or delete.

begin;

-- ---------- 1. The super admin flag ----------

alter table public.profiles add column if not exists is_super_admin boolean not null default false;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_super_admin and p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_super_admin() to anon, authenticated;

-- ---------- 2. A fuller log ----------

alter table public.admin_log add column if not exists target_id text;

drop function if exists public.admin_note(text, text, text);
create or replace function public.admin_note(
  p_action text,
  p_target text,
  p_detail text,
  p_target_id text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_log (admin_id, action, target, detail, target_id)
  values (auth.uid(), p_action, p_target, p_detail, p_target_id);
$$;
revoke all on function public.admin_note(text, text, text, text) from public, anon, authenticated;

-- For things the site itself does on an admin's behalf (for example
-- sending a notification email), so they are in the log too.
create or replace function public.admin_log_event(p_action text, p_target text, p_detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  perform public.admin_note(left(p_action, 80), left(p_target, 200), left(p_detail, 500), null);
end;
$$;

create or replace function public.admin_list_log(
  p_search text default '',
  p_limit  int  default 100,
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
      select l.id, l.action, l.target, l.detail, l.created_at,
             coalesce(p.display_name, case when l.admin_id is null then 'Database' else 'A former admin' end) as admin
      from public.admin_log l
      left join public.profiles p on p.id = l.admin_id
      where v_search = ''
         or l.action ilike '%' || v_search || '%'
         or l.target ilike '%' || v_search || '%'
         or l.detail ilike '%' || v_search || '%'
         or p.display_name ilike '%' || v_search || '%'
      order by l.created_at desc, l.id desc
      limit least(greatest(coalesce(p_limit, 100), 1), 300)
      offset greatest(coalesce(p_offset, 0), 0)
    ) t
  );
end;
$$;

-- ---------- 3. The first super admin ----------

-- Only when there is no super admin yet: the admin whose email name is
-- ezraschwarcz, or failing that the longest-standing admin.
do $$
declare
  v_id uuid;
  v_name text;
begin
  if not exists (select 1 from public.profiles where is_super_admin) then
    select p.id into v_id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_admin and u.email ilike 'ezraschwarcz@%'
    order by u.created_at
    limit 1;
    if v_id is null then
      select p.id into v_id
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.is_admin
      order by u.created_at
      limit 1;
    end if;
    if v_id is not null then
      update public.profiles set is_super_admin = true where id = v_id
      returning display_name into v_name;
      insert into public.admin_log (admin_id, action, target, detail, target_id)
      values (null, 'Made super admin', v_name, 'Set by the database script', v_id::text);
    end if;
  end if;
end;
$$;

-- ---------- 4. Changing someone's access ----------

-- The old function let any admin create admins. It is replaced.
drop function if exists public.admin_set_admin(uuid, boolean);

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_is_admin boolean;
  v_is_super boolean;
  v_banned boolean;
  v_previous text;
  v_actor_super boolean := public.is_super_admin();
begin
  perform public.require_admin();
  if p_role not in ('member', 'admin', 'super_admin') then
    raise exception 'Unknown access level.';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own access.';
  end if;
  select p.display_name, p.is_admin, p.is_super_admin and p.is_admin, p.is_banned
    into v_name, v_is_admin, v_is_super, v_banned
  from public.profiles p where p.id = p_user;
  if not found then
    raise exception 'That member has no profile yet.';
  end if;
  v_previous := case when v_is_super then 'super_admin' when v_is_admin then 'admin' else 'member' end;
  if v_previous = p_role then
    raise exception 'That member already has this access.';
  end if;
  if v_is_super then
    raise exception 'A super admin''s access cannot be changed from the site. It can only be changed by hand in the database.';
  end if;

  if p_role = 'member' then
    -- Any admin may remove a regular admin.
    update public.profiles set is_admin = false, is_super_admin = false where id = p_user;
    perform public.admin_note('Removed admin', v_name, null, p_user::text);
  else
    if not v_actor_super then
      raise exception 'Only a super admin can make someone an admin.';
    end if;
    if v_banned then
      raise exception 'Lift this member''s ban before giving them admin access.';
    end if;
    update public.profiles
    set is_admin = true, is_super_admin = (p_role = 'super_admin')
    where id = p_user;
    perform public.admin_note(
      case when p_role = 'super_admin' then 'Made super admin' else 'Made admin' end,
      v_name, 'Was: ' || replace(v_previous, '_', ' '), p_user::text);
  end if;

  -- Returned so the site can send the notification emails.
  return jsonb_build_object(
    'name', v_name,
    'email', (select u.email from auth.users u where u.id = p_user),
    'previous', v_previous,
    'role', p_role,
    'actor', coalesce((select p.display_name from public.profiles p where p.id = auth.uid()), 'An admin'),
    'super_admin_emails', (
      select coalesce(jsonb_agg(u.email), '[]'::jsonb)
      from auth.users u
      join public.profiles p on p.id = u.id
      where p.is_super_admin and p.is_admin and u.email is not null)
  );
end;
$$;

-- ---------- 5. Members: counts, and the super admin badge ----------

create or replace function public.admin_member_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'total',        (select count(*) from auth.users),
    'new_7d',       (select count(*) from auth.users u where u.created_at > now() - interval '7 days'),
    'admins',       (select count(*) from public.profiles p where p.is_admin),
    'super_admins', (select count(*) from public.profiles p where p.is_admin and p.is_super_admin),
    'banned',       (select count(*) from public.profiles p where p.is_banned)
  );
end;
$$;

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
             coalesce(p.is_admin and p.is_super_admin, false) as is_super_admin,
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

-- The ban function now records who was banned by id as well.
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
    case when p_banned
         then concat_ws('; ', nullif(btrim(coalesce(p_reason, '')), ''),
                        case when p_hide_comments then 'comments taken down' end)
         else null end,
    p_user::text
  );
end;
$$;

-- ---------- 6. Who may call what ----------

revoke all on function public.admin_log_event(text, text, text) from public, anon;
revoke all on function public.admin_list_log(text, int, int) from public, anon;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_member_counts() from public, anon;
grant execute on function public.admin_log_event(text, text, text) to authenticated;
grant execute on function public.admin_list_log(text, int, int) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_member_counts() to authenticated;

-- The log can be read through the functions above and written only by
-- the database's own functions. Nobody can edit or delete it from the site.
revoke all on public.admin_log from anon, authenticated;

commit;

select display_name as "Super admins now" from public.profiles where is_super_admin and is_admin;

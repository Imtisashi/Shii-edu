alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

update public.profiles p
set auth_user_id = p.id
where p.auth_user_id is null
  and exists (
    select 1
    from auth.users u
    where u.id = p.id
  );

create unique index if not exists profiles_auth_user_id_uidx
on public.profiles (auth_user_id)
where auth_user_id is not null;

create or replace function app_private.current_profile_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function app_private.current_profile_institute_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    app_private.jwt_institute_id(),
    (
      select p.institute_id
      from public.profiles p
      where p.auth_user_id = auth.uid()
      limit 1
    )
  )
$$;

create or replace function app_private.current_profile_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(app_private.jwt_role(), ''),
    (
      select p.role::text
      from public.profiles p
      where p.auth_user_id = auth.uid()
      limit 1
    ),
    ''
  )
$$;

create or replace function app_private.is_superadmin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.current_profile_role() = 'superadmin'
$$;

create or replace function app_private.same_institute(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select target_institute_id = app_private.current_profile_institute_id()
$$;

create or replace function app_private.same_institute_path(target_institute_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select target_institute_id = (app_private.current_profile_institute_id())::text
$$;

create or replace function app_private.is_admin_for(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_superadmin()
    or (
      app_private.same_institute(target_institute_id)
      and app_private.current_profile_role() = 'admin'
    )
$$;

create or replace function app_private.is_faculty_for(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_superadmin()
    or (
      app_private.same_institute(target_institute_id)
      and app_private.current_profile_role() in ('admin', 'teacher')
    )
$$;

create or replace function app_private.can_read_institute(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_superadmin() or app_private.same_institute(target_institute_id)
$$;

create or replace function app_private.can_admin_institute(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_superadmin()
    or (
      app_private.same_institute(target_institute_id)
      and app_private.current_profile_role() = 'admin'
    )
$$;

create or replace function app_private.can_faculty_institute(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_superadmin()
    or (
      app_private.same_institute(target_institute_id)
      and app_private.current_profile_role() in ('admin', 'teacher')
    )
$$;

drop policy if exists "profiles_select_same_institute" on public.profiles;
create policy "profiles_select_same_institute"
on public.profiles
for select
to authenticated
using (
  app_private.is_superadmin()
  or auth_user_id = auth.uid()
  or app_private.same_institute(institute_id)
);

drop policy if exists "profiles_update_same_institute" on public.profiles;
create policy "profiles_update_same_institute"
on public.profiles
for update
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
  or (auth_user_id = auth.uid() and app_private.same_institute(institute_id))
)
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
  or (auth_user_id = auth.uid() and app_private.same_institute(institute_id))
);

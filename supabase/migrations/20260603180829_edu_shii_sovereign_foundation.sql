create schema if not exists app_private;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'edu_shii_profile_role') then
    create type public.edu_shii_profile_role as enum (
      'superadmin',
      'admin',
      'teacher',
      'student',
      'parent',
      'driver'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'edu_shii_bus_route_status') then
    create type public.edu_shii_bus_route_status as enum (
      'inactive',
      'active'
    );
  end if;
end $$;

create or replace function app_private.jwt_institute_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'institute_id', '')::uuid
$$;

create or replace function app_private.jwt_role()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''))
$$;

create or replace function app_private.is_superadmin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.jwt_role() = 'superadmin'
$$;

create or replace function app_private.same_institute(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select target_institute_id = app_private.jwt_institute_id()
$$;

create or replace function app_private.same_institute_path(target_institute_id text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select target_institute_id = (app_private.jwt_institute_id())::text
$$;

create or replace function app_private.is_admin_for(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.same_institute(target_institute_id)
    and app_private.jwt_role() in ('admin', 'superadmin')
$$;

create or replace function app_private.is_faculty_for(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.same_institute(target_institute_id)
    and app_private.jwt_role() in ('admin', 'teacher', 'superadmin')
$$;

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  logo_url text,
  primary_color text not null default '#2563EB' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#14B8A6' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  dark_primary_color text not null default '#0B0F19' check (dark_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  dark_secondary_color text not null default '#111827' check (dark_secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institute_id uuid references public.institutes(id) on delete restrict,
  email text,
  full_name text not null check (char_length(trim(full_name)) between 1 and 180),
  role public.edu_shii_profile_role not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_superadmin_institute_rule check (
    role = 'superadmin' or institute_id is not null
  )
);

create table if not exists public.parent_student_map (
  institute_id uuid not null references public.institutes(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id),
  constraint parent_student_distinct_people check (parent_id <> student_id)
);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  class_id text not null check (char_length(trim(class_id)) between 1 and 80),
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  subject text not null check (char_length(trim(subject)) between 1 and 140),
  teacher_id uuid references public.profiles(id) on delete set null,
  room_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_time_order check (start_time < end_time)
);

create table if not exists public.bus_routes (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  route_name text not null check (char_length(trim(route_name)) between 2 and 140),
  driver_id uuid references public.profiles(id) on delete set null,
  vehicle_number text not null check (char_length(trim(vehicle_number)) between 1 and 80),
  status public.edu_shii_bus_route_status not null default 'inactive',
  last_known_position extensions.geography(point, 4326),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_institute_role_idx on public.profiles (institute_id, role);
create index if not exists parent_student_map_institute_idx on public.parent_student_map (institute_id);
create index if not exists parent_student_map_student_idx on public.parent_student_map (student_id);
create index if not exists routines_institute_class_day_idx on public.routines (institute_id, class_id, day_of_week, start_time);
create index if not exists routines_teacher_time_idx on public.routines (institute_id, teacher_id, day_of_week, start_time, end_time);
create index if not exists bus_routes_institute_status_idx on public.bus_routes (institute_id, status);
create index if not exists bus_routes_last_known_position_idx on public.bus_routes using gist (last_known_position);

create unique index if not exists routines_no_teacher_overlap_idx
on public.routines (institute_id, teacher_id, day_of_week, start_time, end_time)
where teacher_id is not null;

create unique index if not exists routines_no_room_overlap_idx
on public.routines (institute_id, day_of_week, start_time, end_time, room_number)
where room_number is not null;

drop trigger if exists institutes_touch_updated_at on public.institutes;
create trigger institutes_touch_updated_at
before update on public.institutes
for each row execute function app_private.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function app_private.touch_updated_at();

drop trigger if exists routines_touch_updated_at on public.routines;
create trigger routines_touch_updated_at
before update on public.routines
for each row execute function app_private.touch_updated_at();

drop trigger if exists bus_routes_touch_updated_at on public.bus_routes;
create trigger bus_routes_touch_updated_at
before update on public.bus_routes
for each row execute function app_private.touch_updated_at();

alter table public.institutes enable row level security;
alter table public.profiles enable row level security;
alter table public.parent_student_map enable row level security;
alter table public.routines enable row level security;
alter table public.bus_routes enable row level security;

drop policy if exists "institutes_select_same_institute" on public.institutes;
create policy "institutes_select_same_institute"
on public.institutes
for select
to authenticated
using (app_private.is_superadmin() or app_private.same_institute(id));

drop policy if exists "institutes_superadmin_insert" on public.institutes;
create policy "institutes_superadmin_insert"
on public.institutes
for insert
to authenticated
with check (app_private.is_superadmin());

drop policy if exists "institutes_superadmin_update" on public.institutes;
create policy "institutes_superadmin_update"
on public.institutes
for update
to authenticated
using (app_private.is_superadmin())
with check (app_private.is_superadmin());

drop policy if exists "institutes_superadmin_delete" on public.institutes;
create policy "institutes_superadmin_delete"
on public.institutes
for delete
to authenticated
using (app_private.is_superadmin());

drop policy if exists "profiles_select_same_institute" on public.profiles;
create policy "profiles_select_same_institute"
on public.profiles
for select
to authenticated
using (
  app_private.is_superadmin()
  or id = auth.uid()
  or app_private.same_institute(institute_id)
);

drop policy if exists "profiles_admin_insert_same_institute" on public.profiles;
create policy "profiles_admin_insert_same_institute"
on public.profiles
for insert
to authenticated
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "profiles_update_same_institute" on public.profiles;
create policy "profiles_update_same_institute"
on public.profiles
for update
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
  or (id = auth.uid() and app_private.same_institute(institute_id))
)
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
  or (id = auth.uid() and app_private.same_institute(institute_id))
);

drop policy if exists "profiles_superadmin_delete" on public.profiles;
create policy "profiles_superadmin_delete"
on public.profiles
for delete
to authenticated
using (app_private.is_superadmin());

drop policy if exists "parent_student_map_select_same_institute" on public.parent_student_map;
create policy "parent_student_map_select_same_institute"
on public.parent_student_map
for select
to authenticated
using (
  app_private.is_superadmin()
  or app_private.same_institute(institute_id)
);

drop policy if exists "parent_student_map_admin_insert_same_institute" on public.parent_student_map;
create policy "parent_student_map_admin_insert_same_institute"
on public.parent_student_map
for insert
to authenticated
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "parent_student_map_admin_update_same_institute" on public.parent_student_map;
create policy "parent_student_map_admin_update_same_institute"
on public.parent_student_map
for update
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
)
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "parent_student_map_admin_delete_same_institute" on public.parent_student_map;
create policy "parent_student_map_admin_delete_same_institute"
on public.parent_student_map
for delete
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "routines_select_same_institute" on public.routines;
create policy "routines_select_same_institute"
on public.routines
for select
to authenticated
using (
  app_private.is_superadmin()
  or app_private.same_institute(institute_id)
);

drop policy if exists "routines_faculty_insert_same_institute" on public.routines;
create policy "routines_faculty_insert_same_institute"
on public.routines
for insert
to authenticated
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "routines_faculty_update_same_institute" on public.routines;
create policy "routines_faculty_update_same_institute"
on public.routines
for update
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
)
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "routines_admin_delete_same_institute" on public.routines;
create policy "routines_admin_delete_same_institute"
on public.routines
for delete
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "bus_routes_select_same_institute" on public.bus_routes;
create policy "bus_routes_select_same_institute"
on public.bus_routes
for select
to authenticated
using (
  app_private.is_superadmin()
  or app_private.same_institute(institute_id)
);

drop policy if exists "bus_routes_admin_insert_same_institute" on public.bus_routes;
create policy "bus_routes_admin_insert_same_institute"
on public.bus_routes
for insert
to authenticated
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "bus_routes_admin_update_same_institute" on public.bus_routes;
create policy "bus_routes_admin_update_same_institute"
on public.bus_routes
for update
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
)
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

drop policy if exists "bus_routes_admin_delete_same_institute" on public.bus_routes;
create policy "bus_routes_admin_delete_same_institute"
on public.bus_routes
for delete
to authenticated
using (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('assets', 'assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
  ('logos', 'logos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('documents', 'documents', false, 26214400, array['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "edu_shii_storage_select_same_institute" on storage.objects;
create policy "edu_shii_storage_select_same_institute"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('assets', 'logos', 'documents')
  and (
    app_private.is_superadmin()
    or app_private.same_institute_path((storage.foldername(name))[1])
  )
);

drop policy if exists "edu_shii_storage_insert_same_institute" on storage.objects;
create policy "edu_shii_storage_insert_same_institute"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('assets', 'logos', 'documents')
  and (
    app_private.is_superadmin()
    or app_private.same_institute_path((storage.foldername(name))[1])
  )
);

drop policy if exists "edu_shii_storage_update_same_institute" on storage.objects;
create policy "edu_shii_storage_update_same_institute"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('assets', 'logos', 'documents')
  and (
    app_private.is_superadmin()
    or app_private.same_institute_path((storage.foldername(name))[1])
  )
)
with check (
  bucket_id in ('assets', 'logos', 'documents')
  and (
    app_private.is_superadmin()
    or app_private.same_institute_path((storage.foldername(name))[1])
  )
);

drop policy if exists "edu_shii_storage_delete_same_institute" on storage.objects;
create policy "edu_shii_storage_delete_same_institute"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('assets', 'logos', 'documents')
  and (
    app_private.is_superadmin()
    or app_private.same_institute_path((storage.foldername(name))[1])
  )
);

alter table realtime.messages enable row level security;

drop policy if exists "edu_shii_realtime_broadcast_same_institute" on realtime.messages;
create policy "edu_shii_realtime_broadcast_same_institute"
on realtime.messages
for select
to authenticated
using (
  app_private.is_superadmin()
  or (
    realtime.topic() like 'bus_tracking:%'
    and split_part(realtime.topic(), ':', 2) = (app_private.jwt_institute_id())::text
  )
  or (
    realtime.topic() like 'alerts:%'
    and split_part(realtime.topic(), ':', 2) = (app_private.jwt_institute_id())::text
  )
);

drop policy if exists "edu_shii_realtime_send_same_institute" on realtime.messages;
create policy "edu_shii_realtime_send_same_institute"
on realtime.messages
for insert
to authenticated
with check (
  app_private.is_superadmin()
  or (
    realtime.topic() like 'bus_tracking:%'
    and split_part(realtime.topic(), ':', 2) = (app_private.jwt_institute_id())::text
    and app_private.jwt_role() in ('driver', 'admin')
  )
  or (
    realtime.topic() like 'alerts:%'
    and split_part(realtime.topic(), ':', 2) = (app_private.jwt_institute_id())::text
    and app_private.jwt_role() in ('admin', 'teacher')
  )
);

grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

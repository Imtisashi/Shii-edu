create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'edu_shii_institution_type') then
    create type public.edu_shii_institution_type as enum ('school', 'college');
  end if;

  if not exists (select 1 from pg_type where typname = 'edu_shii_upload_provider') then
    create type public.edu_shii_upload_provider as enum ('supabase', 'cloudinary', 'firebase', 'external');
  end if;

  if not exists (select 1 from pg_type where typname = 'edu_shii_attendance_status') then
    create type public.edu_shii_attendance_status as enum ('present', 'absent', 'late', 'excused');
  end if;

  if not exists (select 1 from pg_type where typname = 'edu_shii_fee_status') then
    create type public.edu_shii_fee_status as enum ('draft', 'assigned', 'pending', 'partial', 'paid', 'overdue', 'waived', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'edu_shii_task_status') then
    create type public.edu_shii_task_status as enum ('queued', 'processing', 'retry', 'completed', 'failed', 'dead_letter');
  end if;
end $$;

create or replace function app_private.normalize_login_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '', 'g'), '')
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
  select app_private.is_superadmin() or (
    app_private.same_institute(target_institute_id)
    and app_private.jwt_role() = 'admin'
  )
$$;

create or replace function app_private.can_faculty_institute(target_institute_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_superadmin() or (
    app_private.same_institute(target_institute_id)
    and app_private.jwt_role() in ('admin', 'teacher')
  )
$$;

alter table public.institutes
  add column if not exists institute_code text,
  add column if not exists legacy_firestore_id text,
  add column if not exists institution_type public.edu_shii_institution_type not null default 'school',
  add column if not exists name_key text,
  add column if not exists about_us text,
  add column if not exists tagline text,
  add column if not exists location text,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists academic_model jsonb not null default '{}'::jsonb,
  add column if not exists schema_version integer not null default 2;

update public.institutes
set
  name_key = coalesce(name_key, lower(trim(name))),
  institute_code = coalesce(institute_code, legacy_firestore_id, nullif(configuration ->> 'instituteId', '')),
  about_us = coalesce(about_us, configuration ->> 'aboutUs'),
  tagline = coalesce(tagline, configuration ->> 'tagline'),
  location = coalesce(location, configuration ->> 'location'),
  academic_model = case
    when academic_model = '{}'::jsonb and configuration ? 'academicModel' then configuration -> 'academicModel'
    else academic_model
  end;

create unique index if not exists institutes_institute_code_ci_uidx
on public.institutes (app_private.normalize_login_key(institute_code))
where institute_code is not null;

create unique index if not exists institutes_legacy_firestore_id_uidx
on public.institutes (legacy_firestore_id)
where legacy_firestore_id is not null;

create index if not exists institutes_institution_type_idx
on public.institutes (institution_type);

alter table public.profiles
  add column if not exists login_id text,
  add column if not exists login_id_key text,
  add column if not exists unique_id text,
  add column if not exists legacy_firestore_id text,
  add column if not exists photo_url text,
  add column if not exists phone text,
  add column if not exists status text not null default 'active',
  add column if not exists assigned_class text,
  add column if not exists assigned_section text,
  add column if not exists assigned_department text,
  add column if not exists assigned_semester text,
  add column if not exists degree text,
  add column if not exists experience text,
  add column if not exists teacher_code text,
  add column if not exists teaching_scope jsonb not null default '{}'::jsonb,
  add column if not exists fee_paid numeric(12,2) not null default 0,
  add column if not exists total_fee numeric(12,2) not null default 0,
  add column if not exists fee_breakdown jsonb not null default '[]'::jsonb;

create unique index if not exists profiles_institute_login_id_key_uidx
on public.profiles (institute_id, login_id_key)
where institute_id is not null and login_id_key is not null;

create unique index if not exists profiles_legacy_firestore_id_uidx
on public.profiles (legacy_firestore_id)
where legacy_firestore_id is not null;

create index if not exists profiles_status_idx
on public.profiles (institute_id, status);

create or replace function app_private.prepare_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.login_id_key := app_private.normalize_login_key(coalesce(new.login_id, new.unique_id, new.email, new.id::text));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_prepare_identity on public.profiles;
create trigger profiles_prepare_identity
before insert or update on public.profiles
for each row execute function app_private.prepare_profile_identity();

create or replace function app_private.prevent_profile_self_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) = old.id
    and not app_private.can_admin_institute(old.institute_id)
  then
    if new.role is distinct from old.role
      or new.institute_id is distinct from old.institute_id
      or new.login_id is distinct from old.login_id
      or new.login_id_key is distinct from old.login_id_key
      or new.unique_id is distinct from old.unique_id
      or new.legacy_firestore_id is distinct from old.legacy_firestore_id
      or new.status is distinct from old.status
    then
      raise exception 'You cannot change profile authority fields from the client.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_escalation on public.profiles;
create trigger profiles_prevent_self_escalation
before update on public.profiles
for each row execute function app_private.prevent_profile_self_escalation();

alter table public.routines
  add column if not exists legacy_firestore_id text,
  add column if not exists section text,
  add column if not exists department text,
  add column if not exists semester text,
  add column if not exists raw_time text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists routines_legacy_firestore_id_uidx
on public.routines (institute_id, legacy_firestore_id)
where legacy_firestore_id is not null;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,
  provider public.edu_shii_upload_provider not null default 'supabase',
  bucket text,
  storage_path text,
  public_url text,
  source_url text,
  legacy_public_id text,
  resource_type text not null default 'image',
  mime_type text,
  file_name text,
  title text,
  purpose text not null default 'general',
  byte_size bigint,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  migrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_location_check check (
    public_url is not null or source_url is not null or storage_path is not null
  )
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  label text not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.standards (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  legacy_firestore_id text,
  standard_code text not null,
  label text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_sections (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  standard_id uuid references public.standards(id) on delete set null,
  legacy_firestore_id text,
  standard_code text not null,
  section_code text not null,
  label text not null,
  class_teacher_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  class_section_id uuid not null references public.class_sections(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  code text not null,
  name text not null,
  head_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  legacy_firestore_id text,
  semester_number integer not null check (semester_number between 1 and 12),
  label text not null,
  academic_year text,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_credit_hours (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  legacy_firestore_id text,
  course_code text not null,
  course_title text not null,
  credit_hours numeric(5,2) not null check (credit_hours > 0),
  grade_points numeric(5,2),
  is_elective boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.elective_registrations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_credit_id uuid references public.course_credit_hours(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  status text not null default 'registered',
  registered_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  teacher_id uuid references public.profiles(id) on delete set null,
  teacher_legacy_id text,
  teacher_name text,
  title text not null,
  subject text,
  description text,
  due_on date,
  attachment_media_id uuid references public.media_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  student_id uuid references public.profiles(id) on delete set null,
  student_legacy_id text,
  student_login_id text,
  student_name text,
  teacher_id uuid references public.profiles(id) on delete set null,
  teacher_legacy_id text,
  teacher_name text,
  attendance_date date not null,
  subject text,
  attendance_type text not null default 'daily',
  status public.edu_shii_attendance_status not null default 'present',
  is_present boolean not null default true,
  target_primary text,
  target_secondary text,
  records jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_attendance (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  class_section_id uuid references public.class_sections(id) on delete set null,
  attendance_date date not null,
  taken_by uuid references public.profiles(id) on delete set null,
  records jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  student_id uuid references public.profiles(id) on delete set null,
  student_legacy_id text,
  student_name text,
  teacher_id uuid references public.profiles(id) on delete set null,
  teacher_legacy_id text,
  teacher_name text,
  subject text not null,
  exam_type text,
  marks numeric(8,2),
  total_marks numeric(8,2),
  percentage numeric(8,2),
  grade_letter text,
  grade_points numeric(5,2),
  credit_hours numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  instructor_id uuid references public.profiles(id) on delete set null,
  instructor_legacy_id text,
  instructor_name text,
  department_id uuid references public.departments(id) on delete set null,
  semester_id uuid references public.semesters(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'draft',
  published boolean not null default false,
  institution_type public.edu_shii_institution_type,
  academic_year text,
  classes jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  modules jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  user_legacy_id text,
  course_id uuid references public.courses(id) on delete cascade,
  course_legacy_id text,
  lesson_id text not null,
  completed boolean not null default false,
  position_seconds integer not null default 0,
  duration_seconds integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pyqs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  title text not null,
  subject text,
  year text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  document_media_id uuid references public.media_assets(id) on delete set null,
  file_url text,
  public_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  title text,
  image_url text,
  media_id uuid references public.media_assets(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_by_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  title text not null,
  holiday_date date not null,
  holiday_type text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  title text not null,
  message text not null,
  content text,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  target_roles text[] not null default array['all']::text[],
  target_level text,
  notice_type text not null default 'notice',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  title text not null,
  message text not null,
  notification_type text not null default 'general',
  target_roles text[] not null default array['all']::text[],
  recipient_ids uuid[] not null default '{}'::uuid[],
  read_by uuid[] not null default '{}'::uuid[],
  related_type text,
  related_id text,
  author jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  title text not null,
  academic_year text,
  amount numeric(12,2) not null default 0,
  due_on date,
  applies_to jsonb not null default '{}'::jsonb,
  breakdown jsonb not null default '[]'::jsonb,
  status public.edu_shii_fee_status not null default 'assigned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  fee_structure_id uuid references public.fee_structures(id) on delete set null,
  student_id uuid references public.profiles(id) on delete cascade,
  student_legacy_id text,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  currency text not null default 'INR',
  due_on date,
  status public.edu_shii_fee_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  invoice_id uuid references public.fee_invoices(id) on delete set null,
  student_id uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  provider text not null default 'manual',
  provider_payment_id text,
  status text not null default 'recorded',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  invoice_id uuid references public.fee_invoices(id) on delete cascade,
  provider text not null default 'stripe',
  provider_order_id text,
  idempotency_key text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  status text not null default 'created',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  institute_id uuid references public.institutes(id) on delete set null,
  event_type text not null,
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  participant_ids uuid[] not null default '{}'::uuid[],
  participant_legacy_ids text[] not null default '{}'::text[],
  title text,
  last_message text,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  legacy_firestore_id text,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_legacy_id text,
  body text not null,
  attachment_media_id uuid references public.media_assets(id) on delete set null,
  read_by uuid[] not null default '{}'::uuid[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_hour_policies (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  policy jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id)
);

create table if not exists public.syllabi (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  legacy_firestore_id text,
  title text not null,
  subject text,
  file_url text,
  public_id text,
  document_media_id uuid references public.media_assets(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.syllabus_chunks (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  syllabus_id uuid references public.syllabi(id) on delete cascade,
  legacy_firestore_id text,
  chunk_index integer not null default 0,
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher_absences (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  teacher_legacy_id text,
  absence_date date not null,
  reason text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.substitute_assignments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  absence_id uuid references public.teacher_absences(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  substitute_teacher_id uuid references public.profiles(id) on delete set null,
  substitute_legacy_id text,
  assignment_date date not null,
  status text not null default 'assigned',
  ai_reasoning jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  device_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, token)
);

create table if not exists public.student_import_jobs (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'queued',
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_tasks (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid references public.institutes(id) on delete cascade,
  task_type text not null,
  status public.edu_shii_task_status not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_task_dead_letters (
  id uuid primary key,
  institute_id uuid references public.institutes(id) on delete set null,
  task_type text not null,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function public.calculate_weighted_gpa(grades jsonb, scale numeric default 10)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  total_points numeric := 0;
  total_credits numeric := 0;
  credits numeric;
  points numeric;
begin
  if grades is null or jsonb_typeof(grades) <> 'array' then
    return null;
  end if;

  for item in select * from jsonb_array_elements(grades)
  loop
    credits := nullif((item ->> 'creditHours')::numeric, 0);
    points := (item ->> 'gradePoints')::numeric;

    if credits is not null and points is not null then
      total_points := total_points + (credits * least(points, scale));
      total_credits := total_credits + credits;
    end if;
  end loop;

  if total_credits = 0 then
    return null;
  end if;

  return round(total_points / total_credits, 2);
end;
$$;

create or replace function public.calculate_cgpa(semester_gpas jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  total_weighted numeric := 0;
  total_credits numeric := 0;
  credits numeric;
  gpa numeric;
begin
  if semester_gpas is null or jsonb_typeof(semester_gpas) <> 'array' then
    return null;
  end if;

  for item in select * from jsonb_array_elements(semester_gpas)
  loop
    credits := nullif((item ->> 'creditHours')::numeric, 0);
    gpa := (item ->> 'gpa')::numeric;

    if credits is not null and gpa is not null then
      total_weighted := total_weighted + (credits * gpa);
      total_credits := total_credits + credits;
    end if;
  end loop;

  if total_credits = 0 then
    return null;
  end if;

  return round(total_weighted / total_credits, 2);
end;
$$;

create index if not exists media_assets_institute_purpose_idx on public.media_assets (institute_id, purpose);
create index if not exists media_assets_storage_path_idx on public.media_assets (bucket, storage_path) where storage_path is not null;
create unique index if not exists media_assets_legacy_public_id_uidx on public.media_assets (provider, legacy_public_id) where legacy_public_id is not null;

create unique index if not exists academic_years_legacy_firestore_id_uidx on public.academic_years (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists standards_legacy_firestore_id_uidx on public.standards (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists class_sections_legacy_firestore_id_uidx on public.class_sections (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists departments_legacy_firestore_id_uidx on public.departments (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists semesters_legacy_firestore_id_uidx on public.semesters (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists course_credit_hours_legacy_firestore_id_uidx on public.course_credit_hours (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists assignments_legacy_firestore_id_uidx on public.assignments (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists attendance_records_legacy_firestore_id_uidx on public.attendance_records (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists grades_legacy_firestore_id_uidx on public.grades (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists courses_legacy_firestore_id_uidx on public.courses (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists course_progress_unique_lesson_uidx on public.course_progress (institute_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid), lesson_id);
create unique index if not exists pyqs_legacy_firestore_id_uidx on public.pyqs (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists gallery_legacy_firestore_id_uidx on public.gallery (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists holidays_legacy_firestore_id_uidx on public.holidays (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists notices_legacy_firestore_id_uidx on public.notices (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists notifications_legacy_firestore_id_uidx on public.notifications (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists fee_structures_legacy_firestore_id_uidx on public.fee_structures (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists fee_invoices_legacy_firestore_id_uidx on public.fee_invoices (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists payments_provider_payment_id_uidx on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create unique index if not exists payment_orders_idempotency_key_uidx on public.payment_orders (idempotency_key) where idempotency_key is not null;
create unique index if not exists conversations_legacy_firestore_id_uidx on public.conversations (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists messages_legacy_firestore_id_uidx on public.messages (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists syllabi_legacy_firestore_id_uidx on public.syllabi (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists syllabus_chunks_legacy_firestore_id_uidx on public.syllabus_chunks (institute_id, legacy_firestore_id) where legacy_firestore_id is not null;
create unique index if not exists system_tasks_idempotency_key_uidx on public.system_tasks (idempotency_key) where idempotency_key is not null;

create index if not exists attendance_records_student_date_idx on public.attendance_records (institute_id, student_id, attendance_date desc);
create index if not exists attendance_records_target_date_idx on public.attendance_records (institute_id, target_primary, target_secondary, attendance_date desc);
create index if not exists grades_student_subject_idx on public.grades (institute_id, student_id, subject);
create index if not exists courses_published_idx on public.courses (institute_id, published, status);
create index if not exists fee_invoices_student_status_idx on public.fee_invoices (institute_id, student_id, status);
create index if not exists notifications_institute_created_idx on public.notifications (institute_id, created_at desc);
create index if not exists conversations_participant_ids_gin_idx on public.conversations using gin (participant_ids);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists system_tasks_ready_idx on public.system_tasks (status, run_after);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'media_assets',
    'academic_years',
    'standards',
    'class_sections',
    'class_teacher_assignments',
    'departments',
    'semesters',
    'course_credit_hours',
    'elective_registrations',
    'assignments',
    'attendance_records',
    'daily_attendance',
    'grades',
    'courses',
    'course_progress',
    'pyqs',
    'gallery',
    'holidays',
    'notices',
    'notifications',
    'fee_structures',
    'fee_invoices',
    'payments',
    'payment_orders',
    'conversations',
    'messages',
    'office_hour_policies',
    'syllabi',
    'syllabus_chunks',
    'teacher_absences',
    'substitute_assignments',
    'push_tokens',
    'student_import_jobs',
    'system_tasks',
    'system_task_dead_letters'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_select_same_institute', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app_private.can_read_institute(institute_id))',
      table_name || '_select_same_institute',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_insert_same_institute', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (app_private.can_admin_institute(institute_id))',
      table_name || '_admin_insert_same_institute',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_update_same_institute', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (app_private.can_admin_institute(institute_id)) with check (app_private.can_admin_institute(institute_id))',
      table_name || '_admin_update_same_institute',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_delete_same_institute', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (app_private.can_admin_institute(institute_id))',
      table_name || '_admin_delete_same_institute',
      table_name
    );
  end loop;
end $$;

drop policy if exists "assignments_faculty_insert_same_institute" on public.assignments;
create policy "assignments_faculty_insert_same_institute"
on public.assignments
for insert
to authenticated
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "assignments_faculty_update_same_institute" on public.assignments;
create policy "assignments_faculty_update_same_institute"
on public.assignments
for update
to authenticated
using (app_private.can_faculty_institute(institute_id))
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "attendance_faculty_insert_same_institute" on public.attendance_records;
create policy "attendance_faculty_insert_same_institute"
on public.attendance_records
for insert
to authenticated
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "attendance_faculty_update_same_institute" on public.attendance_records;
create policy "attendance_faculty_update_same_institute"
on public.attendance_records
for update
to authenticated
using (app_private.can_faculty_institute(institute_id))
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "grades_faculty_insert_same_institute" on public.grades;
create policy "grades_faculty_insert_same_institute"
on public.grades
for insert
to authenticated
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "grades_faculty_update_same_institute" on public.grades;
create policy "grades_faculty_update_same_institute"
on public.grades
for update
to authenticated
using (app_private.can_faculty_institute(institute_id))
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "courses_faculty_insert_same_institute" on public.courses;
create policy "courses_faculty_insert_same_institute"
on public.courses
for insert
to authenticated
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "courses_faculty_update_same_institute" on public.courses;
create policy "courses_faculty_update_same_institute"
on public.courses
for update
to authenticated
using (app_private.can_faculty_institute(institute_id))
with check (app_private.can_faculty_institute(institute_id));

drop policy if exists "course_progress_student_insert_same_institute" on public.course_progress;
create policy "course_progress_student_insert_same_institute"
on public.course_progress
for insert
to authenticated
with check (
  app_private.can_read_institute(institute_id)
  and (user_id = (select auth.uid()) or app_private.can_faculty_institute(institute_id))
);

drop policy if exists "course_progress_student_update_same_institute" on public.course_progress;
create policy "course_progress_student_update_same_institute"
on public.course_progress
for update
to authenticated
using (
  app_private.can_read_institute(institute_id)
  and (user_id = (select auth.uid()) or app_private.can_faculty_institute(institute_id))
)
with check (
  app_private.can_read_institute(institute_id)
  and (user_id = (select auth.uid()) or app_private.can_faculty_institute(institute_id))
);

drop policy if exists "elective_student_insert_same_institute" on public.elective_registrations;
create policy "elective_student_insert_same_institute"
on public.elective_registrations
for insert
to authenticated
with check (
  app_private.can_read_institute(institute_id)
  and (student_id = (select auth.uid()) or app_private.can_admin_institute(institute_id))
);

drop policy if exists "messages_participant_insert_same_institute" on public.messages;
create policy "messages_participant_insert_same_institute"
on public.messages
for insert
to authenticated
with check (
  app_private.can_read_institute(institute_id)
  and (sender_id = (select auth.uid()) or app_private.can_admin_institute(institute_id))
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'media_assets',
    'academic_years',
    'standards',
    'class_sections',
    'class_teacher_assignments',
    'departments',
    'semesters',
    'course_credit_hours',
    'elective_registrations',
    'assignments',
    'attendance_records',
    'daily_attendance',
    'grades',
    'courses',
    'course_progress',
    'pyqs',
    'gallery',
    'holidays',
    'notices',
    'notifications',
    'fee_structures',
    'fee_invoices',
    'payments',
    'payment_orders',
    'conversations',
    'messages',
    'office_hour_policies',
    'syllabi',
    'syllabus_chunks',
    'teacher_absences',
    'substitute_assignments',
    'push_tokens',
    'student_import_jobs',
    'system_tasks'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function app_private.touch_updated_at()',
      table_name || '_touch_updated_at',
      table_name
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('logos', 'logos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('assets', 'assets', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'application/pdf']),
  ('documents', 'documents', false, 52428800, array['application/pdf', 'text/csv', 'application/csv', 'text/plain', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('course-media', 'course-media', false, 104857600, array['video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
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
  bucket_id in ('assets', 'avatars', 'course-media', 'documents', 'logos')
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
  bucket_id in ('assets', 'avatars', 'course-media', 'documents', 'logos')
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
  bucket_id in ('assets', 'avatars', 'course-media', 'documents', 'logos')
  and (
    app_private.is_superadmin()
    or app_private.same_institute_path((storage.foldername(name))[1])
  )
)
with check (
  bucket_id in ('assets', 'avatars', 'course-media', 'documents', 'logos')
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
  bucket_id in ('assets', 'avatars', 'course-media', 'documents', 'logos')
  and (
    app_private.is_superadmin()
    or app_private.same_institute_path((storage.foldername(name))[1])
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.calculate_weighted_gpa(jsonb, numeric) to authenticated;
grant execute on function public.calculate_cgpa(jsonb) to authenticated;

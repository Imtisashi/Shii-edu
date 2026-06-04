create index if not exists routines_teacher_id_idx on public.routines (teacher_id);
create index if not exists bus_routes_driver_id_idx on public.bus_routes (driver_id);

drop policy if exists "profiles_select_same_institute" on public.profiles;
create policy "profiles_select_same_institute"
on public.profiles
for select
to authenticated
using (
  app_private.is_superadmin()
  or id = (select auth.uid())
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
  or (id = (select auth.uid()) and app_private.same_institute(institute_id))
)
with check (
  app_private.is_superadmin()
  or app_private.is_admin_for(institute_id)
  or (id = (select auth.uid()) and app_private.same_institute(institute_id))
);

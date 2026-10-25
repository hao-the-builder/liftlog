-- ============================================================================
-- Row Level Security.
--
-- Default deny: RLS is enabled on every table and no policy grants access to
-- anything but the caller's own rows. The one exception is the global exercise
-- library (exercises where owner_id is null), which every authenticated user
-- can read and nobody can write through the API. It is populated by migration
-- 0003 and by the service-role seed script, both of which bypass RLS.
--
-- Policies are written with (select auth.uid()) rather than a bare auth.uid()
-- so Postgres evaluates the function once per statement instead of once per
-- row, which matters on set_logs.
-- ============================================================================

alter table public.profiles           enable row level security;
alter table public.exercises          enable row level security;
alter table public.templates          enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workouts           enable row level security;
alter table public.set_logs           enable row level security;
alter table public.bodyweight_logs    enable row level security;
alter table public.protein_logs       enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: a user sees and edits exactly one row, their own.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- exercises: the global library is read-only for everyone; custom exercises
-- belong to one user. A user cannot write a row with owner_id null, so the
-- shared library cannot be edited or polluted through the API.
-- ---------------------------------------------------------------------------
drop policy if exists exercises_select_global_or_own on public.exercises;
create policy exercises_select_global_or_own on public.exercises
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));

drop policy if exists exercises_insert_own on public.exercises;
create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists exercises_update_own on public.exercises;
create policy exercises_update_own on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists exercises_delete_own on public.exercises;
create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- templates: always private. There are no global templates.
-- ---------------------------------------------------------------------------
drop policy if exists templates_all_own on public.templates;
create policy templates_all_own on public.templates
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- template_exercises: reached through the owning template.
-- ---------------------------------------------------------------------------
drop policy if exists template_exercises_all_own on public.template_exercises;
create policy template_exercises_all_own on public.template_exercises
  for all to authenticated
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_exercises.template_id
        and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.templates t
      where t.id = template_exercises.template_id
        and t.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- workouts, set_logs, bodyweight_logs, protein_logs: plain user_id ownership.
-- ---------------------------------------------------------------------------
drop policy if exists workouts_all_own on public.workouts;
create policy workouts_all_own on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists set_logs_all_own on public.set_logs;
create policy set_logs_all_own on public.set_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists bodyweight_logs_all_own on public.bodyweight_logs;
create policy bodyweight_logs_all_own on public.bodyweight_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists protein_logs_all_own on public.protein_logs;
create policy protein_logs_all_own on public.protein_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- The anon role gets nothing. Signing in is the only way to reach any row.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.exercises, public.templates,
  public.template_exercises, public.workouts, public.set_logs,
  public.bodyweight_logs, public.protein_logs
  from anon;

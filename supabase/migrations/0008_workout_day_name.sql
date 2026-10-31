-- ---------------------------------------------------------------------------
-- 0008  Stamp the workout day's name onto the workout itself.
--
-- Why this exists
-- ---------------
-- The per-day volume trackers group a history by which workout day it was:
-- every Push A against every other Push A. Grouping by template_id alone
-- cannot carry that, for two reasons:
--
--   1. workouts.template_id is ON DELETE SET NULL. Delete "Push A" and every
--      Push A session you have ever logged silently falls out of its tracker,
--      permanently. That is the kind of data loss you only notice months later.
--   2. Renaming a template rewrites history. Rename "Push A" to "Chest Day"
--      and sessions you did under the old name retroactively claim the new
--      one, which makes a long-run trend quietly dishonest.
--
-- Stamping the name at the moment the workout starts fixes both. The workout
-- owns its label, so the label survives the template being renamed, deleted or
-- rebuilt, and a trend line keeps meaning the thing it meant when it was drawn.
-- template_id stays exactly as it is: it is still the right thing for "what am
-- I training from right now", and the two answer different questions.
--
-- Nullable on purpose. An ad-hoc workout genuinely has no day, and a null here
-- reads as "unplanned" rather than being forced into a bucket it does not
-- belong in.
--
-- No backfill is needed: this lands while the workouts table is still empty.
-- Were it not, the honest backfill would be
--     update public.workouts w set day_name = t.name
--       from public.templates t where t.id = w.template_id;
-- which is correct only for templates that have not been renamed since, and is
-- the exact ambiguity this column exists to remove.
-- ---------------------------------------------------------------------------

alter table public.workouts
  add column if not exists day_name text
    check (day_name is null or length(trim(day_name)) > 0);

-- The trackers read "every workout of this day, oldest first", one query per
-- user. This is the index for exactly that.
create index if not exists workouts_user_day_idx
  on public.workouts (user_id, day_name, started_at);

comment on column public.workouts.day_name is
  'The workout day''s name as it was at the moment this workout started. '
  'Snapshotted rather than joined so that renaming or deleting a template '
  'cannot rewrite or orphan history. Null means an ad-hoc, unplanned workout.';

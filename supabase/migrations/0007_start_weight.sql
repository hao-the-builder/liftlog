-- ============================================================================
-- A starting weight per exercise, per day.
--
-- Today prefills each set from the last session's matching set, which is the
-- right answer once there is history. On the very first session there is none,
-- so every row opened at 0 and had to be dialled up from nothing with the
-- stepper. That is the one moment the app asked for the most work.
--
-- So the prescription carries a starting weight. It sits on
-- template_exercises rather than on exercises for the same reason increment
-- does: the same movement can belong to two days at two different loads, and
-- a back-off day is a real thing people program. Null means "no opinion", and
-- the fallback chain stays explicit:
--
--   last session's set  ->  start_weight  ->  0
--
-- It is a starting point, not a target. Nothing reads it once a set has been
-- logged, so it can never fight the progression hint.
-- ============================================================================

alter table public.template_exercises
  add column if not exists start_weight numeric(7, 2)
    check (start_weight is null or start_weight >= 0);

comment on column public.template_exercises.start_weight is
  'Seed weight for the first session. Null means fall back to 0. Never overrides logged history.';

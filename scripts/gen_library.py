# Emits supabase/migrations/0003_exercise_library.sql from one data table so the
# muscle vocabulary stays consistent across the whole library.
LIB = [
    # name, equipment, primary, secondaries
    # ---- chest ----
    ("Barbell bench press", "barbell", "chest", ["front delts", "triceps"]),
    ("Incline barbell bench press", "barbell", "chest", ["front delts", "triceps"]),
    ("Dumbbell bench press", "dumbbell", "chest", ["front delts", "triceps"]),
    ("Incline dumbbell press", "dumbbell", "chest", ["front delts", "triceps"]),
    ("Machine chest press", "machine", "chest", ["front delts", "triceps"]),
    ("Incline machine press", "machine", "chest", ["front delts", "triceps"]),
    ("Pec deck", "machine", "chest", []),
    ("Cable fly", "cable", "chest", ["front delts"]),
    ("Push-up", "bodyweight", "chest", ["front delts", "triceps"]),
    ("Dip", "bodyweight", "chest", ["triceps", "front delts"]),
    # ---- shoulders ----
    ("Overhead press", "barbell", "front delts", ["triceps", "upper back"]),
    ("Dumbbell shoulder press", "dumbbell", "front delts", ["triceps", "side delts"]),
    ("Machine shoulder press", "machine", "front delts", ["triceps", "side delts"]),
    ("Arnold press", "dumbbell", "front delts", ["side delts", "triceps"]),
    ("Lateral raise", "dumbbell", "side delts", []),
    ("Cable lateral raise", "cable", "side delts", []),
    ("Machine lateral raise", "machine", "side delts", []),
    ("Upright row", "barbell", "side delts", ["traps", "biceps"]),
    ("Reverse pec deck", "machine", "rear delts", []),
    ("Reverse dumbbell fly", "dumbbell", "rear delts", []),
    ("Face pull", "cable", "rear delts", ["upper back", "traps"]),
    # ---- back ----
    ("Lat pulldown", "cable", "lats", ["biceps", "upper back"]),
    ("Close-grip pulldown", "cable", "lats", ["biceps"]),
    ("Pull-up", "bodyweight", "lats", ["biceps", "upper back"]),
    ("Chin-up", "bodyweight", "lats", ["biceps"]),
    ("Straight-arm pulldown", "cable", "lats", ["triceps"]),
    ("Single-arm cable row", "cable", "lats", ["upper back", "biceps"]),
    ("Dumbbell row", "dumbbell", "lats", ["upper back", "biceps"]),
    ("Barbell row", "barbell", "upper back", ["lats", "biceps"]),
    ("Pendlay row", "barbell", "upper back", ["lats", "biceps"]),
    ("T-bar row", "barbell", "upper back", ["lats", "biceps"]),
    ("Seated cable row", "cable", "upper back", ["lats", "biceps"]),
    ("Seated cable mid-back row", "cable", "upper back", ["lats", "rear delts", "biceps"]),
    ("Machine mid-back row", "machine", "upper back", ["lats", "rear delts", "biceps"]),
    ("Machine row", "machine", "upper back", ["lats", "biceps"]),
    ("Barbell shrug", "barbell", "traps", []),
    ("Dumbbell shrug", "dumbbell", "traps", []),
    ("Farmer's walk", "dumbbell", "traps", ["forearms", "abs"]),
    # ---- arms ----
    ("Barbell curl", "barbell", "biceps", ["forearms"]),
    ("Cable curl", "cable", "biceps", []),
    ("Incline dumbbell curl", "dumbbell", "biceps", []),
    ("Preacher curl", "machine", "biceps", []),
    ("Concentration curl", "dumbbell", "biceps", []),
    ("Hammer curl", "dumbbell", "biceps", ["forearms"]),
    ("Reverse curl", "barbell", "forearms", ["biceps"]),
    ("Wrist curl", "dumbbell", "forearms", []),
    ("Triceps pushdown", "cable", "triceps", []),
    ("Overhead cable triceps extension", "cable", "triceps", []),
    ("Overhead dumbbell triceps extension", "dumbbell", "triceps", []),
    ("Skull crusher", "barbell", "triceps", []),
    ("Close-grip bench press", "barbell", "triceps", ["chest", "front delts"]),
    ("Triceps dip machine", "machine", "triceps", ["chest"]),
    # ---- legs ----
    ("Back squat", "barbell", "quads", ["glutes", "lower back"]),
    ("Front squat", "barbell", "quads", ["glutes", "abs"]),
    ("Hack squat", "machine", "quads", ["glutes"]),
    ("Leg press", "machine", "quads", ["glutes"]),
    ("Leg extension", "machine", "quads", []),
    ("Bulgarian split squat", "dumbbell", "quads", ["glutes", "hamstrings"]),
    ("Walking lunge", "dumbbell", "quads", ["glutes", "hamstrings"]),
    ("Romanian deadlift", "barbell", "hamstrings", ["glutes", "lower back"]),
    ("Dumbbell Romanian deadlift", "dumbbell", "hamstrings", ["glutes", "lower back"]),
    ("Seated leg curl", "machine", "hamstrings", []),
    ("Lying leg curl", "machine", "hamstrings", []),
    ("Good morning", "barbell", "hamstrings", ["lower back", "glutes"]),
    ("Conventional deadlift", "barbell", "lower back", ["hamstrings", "glutes", "traps"]),
    ("Back extension", "bodyweight", "lower back", ["glutes", "hamstrings"]),
    ("Hip thrust machine", "machine", "glutes", ["hamstrings"]),
    ("Barbell hip thrust", "barbell", "glutes", ["hamstrings"]),
    ("Hip abduction machine", "machine", "glutes", []),
    ("Cable kickback", "cable", "glutes", ["hamstrings"]),
    ("Standing calf raise", "machine", "calves", []),
    ("Seated calf raise", "machine", "calves", []),
    ("Calf press", "machine", "calves", []),
    # ---- core ----
    ("Cable crunch", "cable", "abs", []),
    ("Hanging leg raise", "bodyweight", "abs", []),
    ("Lying leg raise", "bodyweight", "abs", []),
    ("Plank", "bodyweight", "abs", []),
    ("Ab wheel rollout", "bodyweight", "abs", ["lats"]),
    ("Russian twist", "bodyweight", "obliques", ["abs"]),
    ("Cable woodchop", "cable", "obliques", ["abs"]),
]

def q(s):
    return "'" + s.replace("'", "''") + "'"

def arr(items):
    if not items:
        return "'{}'::text[]"
    return "array[" + ", ".join(q(i) for i in items) + "]::text[]"

rows = ",\n".join(
    "  ({}, {}, {}, {})".format(q(n), q(e), q(p), arr(s)) for n, e, p, s in LIB
)

sql = """-- ============================================================================
-- Global exercise library. Shared with every user, read-only through the API
-- (see 0002_rls.sql). Keyed on lower(name) where owner_id is null, so running
-- this migration more than once inserts nothing the second time.
--
-- The muscle vocabulary below is closed. The weekly sets-per-muscle chart
-- groups on these exact strings, so a new exercise must reuse one of them:
--   chest, front delts, side delts, rear delts, lats, upper back, traps,
--   lower back, biceps, triceps, forearms, quads, hamstrings, glutes,
--   calves, abs, obliques
-- ============================================================================

insert into public.exercises (owner_id, name, equipment, primary_muscle, secondary_muscles)
select null, v.name, v.equipment, v.primary_muscle, v.secondary_muscles
from (values
{rows}
) as v(name, equipment, primary_muscle, secondary_muscles)
on conflict do nothing;
""".format(rows=rows)

import pathlib
pathlib.Path("supabase/migrations/0003_exercise_library.sql").write_text(sql, encoding="utf-8")
print("exercises:", len(LIB))
muscles = sorted({p for _, _, p, _ in LIB} | {m for *_, s in LIB for m in s})
print("muscles:", muscles)

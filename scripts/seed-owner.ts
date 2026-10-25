/**
 * Seeds one user's private training plan.
 *
 * Run once, after signing up in the app:
 *
 *   npm run seed:owner
 *
 * Server-side only. It needs the service-role key because it writes rows on
 * behalf of a user it is not signed in as, which Row Level Security
 * correctly forbids. That key is read from .env.local here and in the
 * account-deletion route, and is never bundled into the client.
 *
 * Idempotent: it looks up which of the days already exist for that user and
 * inserts only the missing ones, so running it twice changes nothing.
 */

import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env", override: false });

interface PlanExercise {
  exercise: string;
  sets: number;
  repMin: number;
  repMax: number;
  rest: number;
  notes?: string;
}

interface PlanDay {
  name: string;
  isRestDay?: boolean;
  exercises: PlanExercise[];
}

/** Rotation order is the array order. A rest day is a day like any other. */
const PLAN: PlanDay[] = [
  {
    name: "Push A",
    exercises: [
      { exercise: "Machine chest press", sets: 3, repMin: 6, repMax: 10, rest: 150 },
      { exercise: "Incline dumbbell press", sets: 3, repMin: 8, repMax: 12, rest: 150 },
      { exercise: "Pec deck", sets: 2, repMin: 10, repMax: 15, rest: 90 },
      { exercise: "Machine shoulder press", sets: 2, repMin: 8, repMax: 12, rest: 120 },
      { exercise: "Cable lateral raise", sets: 3, repMin: 12, repMax: 20, rest: 75 },
      { exercise: "Overhead cable triceps extension", sets: 3, repMin: 8, repMax: 12, rest: 90 },
    ],
  },
  {
    name: "Pull A",
    exercises: [
      { exercise: "Lat pulldown", sets: 3, repMin: 8, repMax: 12, rest: 150 },
      { exercise: "Single-arm cable row", sets: 3, repMin: 8, repMax: 12, rest: 120 },
      { exercise: "Machine mid-back row", sets: 2, repMin: 8, repMax: 12, rest: 120 },
      { exercise: "Reverse pec deck", sets: 3, repMin: 12, repMax: 20, rest: 75 },
      { exercise: "Incline dumbbell curl", sets: 3, repMin: 8, repMax: 12, rest: 90 },
      { exercise: "Hammer curl", sets: 2, repMin: 10, repMax: 12, rest: 90 },
      { exercise: "Cable crunch", sets: 3, repMin: 10, repMax: 15, rest: 60 },
    ],
  },
  {
    name: "Legs A",
    exercises: [
      {
        exercise: "Leg press",
        sets: 3,
        repMin: 10,
        repMax: 15,
        rest: 150,
        notes: "Pain-free depth only",
      },
      { exercise: "Leg extension", sets: 3, repMin: 10, repMax: 15, rest: 90 },
      { exercise: "Seated leg curl", sets: 3, repMin: 8, repMax: 12, rest: 90 },
      { exercise: "Hip thrust machine", sets: 3, repMin: 8, repMax: 12, rest: 120 },
      { exercise: "Seated calf raise", sets: 3, repMin: 10, repMax: 15, rest: 60 },
      { exercise: "Lying leg raise", sets: 3, repMin: 10, repMax: 15, rest: 60 },
    ],
  },
  {
    name: "Push B",
    exercises: [
      { exercise: "Incline machine press", sets: 3, repMin: 8, repMax: 12, rest: 150 },
      { exercise: "Dumbbell shoulder press", sets: 3, repMin: 8, repMax: 12, rest: 120 },
      { exercise: "Pec deck", sets: 2, repMin: 12, repMax: 15, rest: 90 },
      {
        exercise: "Lateral raise",
        sets: 4,
        repMin: 12,
        repMax: 20,
        rest: 75,
        notes: "Drop set on last set",
      },
      { exercise: "Triceps pushdown", sets: 3, repMin: 10, repMax: 15, rest: 90 },
      { exercise: "Overhead dumbbell triceps extension", sets: 2, repMin: 10, repMax: 15, rest: 90 },
    ],
  },
  {
    name: "Pull B",
    exercises: [
      { exercise: "Seated cable mid-back row", sets: 3, repMin: 8, repMax: 12, rest: 120 },
      { exercise: "Close-grip pulldown", sets: 3, repMin: 10, repMax: 12, rest: 120 },
      { exercise: "Machine row", sets: 2, repMin: 10, repMax: 12, rest: 120 },
      { exercise: "Dumbbell shrug", sets: 3, repMin: 10, repMax: 15, rest: 75 },
      { exercise: "Reverse dumbbell fly", sets: 2, repMin: 12, repMax: 20, rest: 75 },
      { exercise: "Cable curl", sets: 3, repMin: 8, repMax: 12, rest: 90 },
    ],
  },
  {
    name: "Legs B",
    exercises: [
      { exercise: "Seated leg curl", sets: 3, repMin: 8, repMax: 12, rest: 90 },
      { exercise: "Dumbbell Romanian deadlift", sets: 3, repMin: 8, repMax: 12, rest: 150 },
      { exercise: "Leg extension", sets: 3, repMin: 12, repMax: 15, rest: 90 },
      { exercise: "Leg press", sets: 2, repMin: 12, repMax: 15, rest: 150 },
      { exercise: "Hip abduction machine", sets: 2, repMin: 12, repMax: 20, rest: 60 },
      { exercise: "Standing calf raise", sets: 3, repMin: 10, repMax: 15, rest: 60 },
      { exercise: "Cable crunch", sets: 3, repMin: 10, repMax: 15, rest: 60 },
    ],
  },
  { name: "Rest", isRestDay: true, exercises: [] },
];

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function findUserByEmail(admin: SupabaseClient, email: string) {
  const target = email.trim().toLowerCase();
  // The admin API has no lookup by email, so page through until it turns up.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Could not list users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.SEED_OWNER_EMAIL;

  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local.");
  if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY is not set. See README.md.");
  if (!email) fail("SEED_OWNER_EMAIL is not set. Put your sign-up email in .env.local.");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n  Looking up ${email}`);
  const user = await findUserByEmail(admin, email);
  if (!user) {
    fail(
      `No account for ${email}.\n  Sign up in the app with that address first, confirm the email, then run this again.`,
    );
  }
  console.log(`  Found user ${user.id}`);

  // Resolve every exercise name against the shared library before writing
  // anything, so a missing library fails loudly rather than half-seeding.
  const { data: library, error: libraryError } = await admin
    .from("exercises")
    .select("id, name")
    .is("owner_id", null);

  if (libraryError) fail(`Could not read the exercise library: ${libraryError.message}`);

  const byName = new Map(
    (library ?? []).map((row: { id: string; name: string }) => [row.name.toLowerCase(), row.id]),
  );

  const needed = [...new Set(PLAN.flatMap((day) => day.exercises.map((e) => e.exercise)))];
  const missing = needed.filter((name) => !byName.has(name.toLowerCase()));
  if (missing.length > 0) {
    fail(
      `The global exercise library is missing ${missing.length} exercise(s):\n` +
        missing.map((m) => `    - ${m}`).join("\n") +
        "\n  Run migration 0003_exercise_library.sql first. See README.md.",
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("templates")
    .select("name")
    .eq("owner_id", user.id);

  if (existingError) fail(`Could not read existing templates: ${existingError.message}`);

  const have = new Set((existing ?? []).map((t: { name: string }) => t.name.toLowerCase()));
  const toInsert = PLAN.filter((day) => !have.has(day.name.toLowerCase()));

  if (toInsert.length === 0) {
    console.log(`\n  All ${PLAN.length} days already exist for ${email}. Nothing to do.\n`);
    return;
  }

  console.log(`  Inserting ${toInsert.length} of ${PLAN.length} days`);

  for (const day of toInsert) {
    const dayOrder = PLAN.indexOf(day);

    const { data: template, error: templateError } = await admin
      .from("templates")
      .insert({
        owner_id: user.id,
        name: day.name,
        day_order: dayOrder,
        is_rest_day: day.isRestDay ?? false,
      })
      .select("id")
      .single();

    if (templateError || !template) {
      fail(`Could not insert "${day.name}": ${templateError?.message ?? "no row returned"}`);
    }

    if (day.exercises.length > 0) {
      const rows = day.exercises.map((exercise, position) => ({
        template_id: template.id,
        exercise_id: byName.get(exercise.exercise.toLowerCase())!,
        position,
        sets: exercise.sets,
        rep_min: exercise.repMin,
        rep_max: exercise.repMax,
        rest_seconds: exercise.rest,
        notes: exercise.notes ?? null,
      }));

      const { error: rowsError } = await admin.from("template_exercises").insert(rows);
      if (rowsError) fail(`Could not insert exercises for "${day.name}": ${rowsError.message}`);
    }

    console.log(`    ${day.name}  (${day.exercises.length} exercises)`);
  }

  console.log(
    `\n  Done. ${toInsert.length} day(s) added for ${email}.` +
      `\n  Open the app and pull to sync, or just reopen it.\n`,
  );
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});

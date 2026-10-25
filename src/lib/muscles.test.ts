import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MUSCLES, MUSCLE_ORDER } from "./muscles";

const MIGRATION = join(process.cwd(), "supabase/migrations/0003_exercise_library.sql");

describe("muscle vocabulary", () => {
  it("orders every muscle exactly once in the chart order", () => {
    expect([...MUSCLE_ORDER].sort()).toEqual([...MUSCLES].sort());
    expect(new Set(MUSCLE_ORDER).size).toBe(MUSCLE_ORDER.length);
  });

  it("covers every muscle the seeded exercise library uses", () => {
    // Guards against the two lists drifting apart. A seeded exercise whose
    // muscle is not in MUSCLES would log volume into a bucket no chart draws.
    const sql = readFileSync(MIGRATION, "utf8");
    const body = sql.slice(sql.indexOf("from (values"));

    const used = new Set<string>();
    for (const [, value] of body.matchAll(/'([^']+)'/g)) {
      used.add(value);
    }

    // The literals in that block are names, equipment and muscles together,
    // so check the direction that matters: no muscle-looking value is missing.
    const known = new Set<string>([...MUSCLES]);
    const muscleLike = [...used].filter((value) => known.has(value));

    expect(muscleLike.length).toBeGreaterThan(10);
    for (const muscle of muscleLike) {
      expect(MUSCLES).toContain(muscle);
    }
  });

  it("uses every muscle it defines at least once in the library", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const unused = MUSCLES.filter((muscle) => !sql.includes(`'${muscle}'`));
    expect(unused).toEqual([]);
  });
});

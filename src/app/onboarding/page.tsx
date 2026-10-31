"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Wordmark } from "@/components/brand/logo";
import { useSession } from "@/components/providers/session-provider";
import { nowIso } from "@/lib/db/outbox";
import { recordBodyweight, saveProfile } from "@/lib/db/repo";
import type { ProfileRow, Unit } from "@/lib/types/database";

export default function OnboardingPage() {
  const router = useRouter();
  const { userId, profile, loading } = useSession();

  const [displayName, setDisplayName] = useState("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [bodyweight, setBodyweight] = useState("");
  const [proteinTarget, setProteinTarget] = useState("1.8");
  const [increment, setIncrement] = useState("2.5");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Someone who already finished setup should not be able to land back here.
  //
  // The ref matters: saving the profile sets onboarded_at, the live query
  // picks it up, and without this the guard would fire and send the user to
  // Today, racing past the Plan editor that setup is supposed to end on.
  const justSaved = useRef(false);
  useEffect(() => {
    if (justSaved.current) return;
    if (!loading && profile?.onboarded_at) router.replace("/today");
  }, [loading, profile?.onboarded_at, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!userId) return;

    const weight = Number(bodyweight);
    const protein = Number(proteinTarget);
    const step = Number(increment);

    if (!displayName.trim()) return setError("Tell us what to call you.");
    if (!Number.isFinite(weight) || weight <= 0) return setError("Enter your bodyweight.");
    if (!Number.isFinite(protein) || protein <= 0) return setError("Enter a protein target.");
    if (!Number.isFinite(step) || step <= 0) return setError("Enter the smallest jump you can load.");

    setBusy(true);
    setError(null);
    justSaved.current = true;

    const row: ProfileRow = {
      id: userId,
      display_name: displayName.trim(),
      unit,
      protein_target_g_per_kg: protein,
      default_increment: step,
      onboarded_at: nowIso(),
      created_at: profile?.created_at ?? nowIso(),
      updated_at: nowIso(),
    };

    await saveProfile(row);
    // The first weigh-in is a bodyweight log like any other, so the chart and
    // the protein target both read from one place rather than two.
    await recordBodyweight(userId, weight);

    router.replace("/plan?first=1");
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-safe pb-safe">
      <header className="flex justify-center pt-10 pb-8">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8">
        <div>
          <h1 className="text-[1.75rem] font-light leading-none tracking-tight">Set up</h1>
          <p className="mt-1.5 text-sm text-muted">
            Five answers. You can change any of them later in Settings.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <Field
            label="What should we call you?"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="given-name"
            enterKeyHint="next"
            required
          />

          <Segmented
            label="Units"
            value={unit}
            onChange={setUnit}
            options={[
              { value: "kg", label: "Kilograms" },
              { value: "lb", label: "Pounds" },
            ]}
          />

          <Field
            label="Bodyweight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            suffix={unit}
            value={bodyweight}
            onChange={(e) => setBodyweight(e.target.value)}
            enterKeyHint="next"
            required
          />

          <Field
            label="Protein target"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            suffix={`g / ${unit}`}
            value={proteinTarget}
            onChange={(e) => setProteinTarget(e.target.value)}
            helper="1.6 to 2.2 covers most lifters. We multiply this by your bodyweight."
            enterKeyHint="next"
          />

          <Field
            label="Smallest weight jump"
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0.25"
            suffix={unit}
            value={increment}
            onChange={(e) => setIncrement(e.target.value)}
            helper="Whatever your gym actually has. Any exercise can override it later."
            enterKeyHint="go"
          />

          {error && (
            <p role="alert" className="rounded-ctl bg-danger-deep px-3.5 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" block disabled={busy || !userId}>
            {busy ? "Saving" : "Build my plan"}
          </Button>
        </form>
      </main>
    </div>
  );
}

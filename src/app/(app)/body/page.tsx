"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { BodyweightChart } from "@/components/body/bodyweight-chart";
import { useSession } from "@/components/providers/session-provider";
import {
  addProtein,
  listBodyweight,
  proteinForDate,
  recordBodyweight,
  setProtein,
  toLocalDateString,
} from "@/lib/db/repo";
import { movingAverage, weeklyRateOfChange } from "@/lib/logic/stats";
import { useClientValue } from "@/lib/hooks/use-now";

const MOVING_AVERAGE_DAYS = 7;

export default function BodyPage() {
  const { userId, profile } = useSession();
  const unit = profile?.unit ?? "kg";

  // The date is read once per render from the browser, never from the server,
  // because this page is part of a statically prerendered shell.
  const today = useClientValue(() => toLocalDateString(), "");

  const weights = useLiveQuery(() => listBodyweight(), []);
  const proteinToday = useLiveQuery(
    async () => (userId && today ? await proteinForDate(userId, today) : undefined),
    [userId, today],
  );

  const series = useMemo(
    () => (weights ?? []).map((row) => ({ date: row.date, value: row.weight })),
    [weights],
  );

  const smoothed = useMemo(() => movingAverage(series, MOVING_AVERAGE_DAYS), [series]);
  const trend = useMemo(() => weeklyRateOfChange(series), [series]);

  const latest = smoothed.length > 0 ? smoothed[smoothed.length - 1] : null;
  const proteinTarget =
    latest && profile ? Math.round(latest.average * profile.protein_target_g_per_kg) : null;
  const proteinSoFar = proteinToday?.grams ?? 0;

  if (!userId) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <header className="py-5">
        <h1 className="text-[1.75rem] font-light leading-none tracking-tight">Body</h1>
        <p className="mt-0.5 text-sm text-muted">Weight and protein, the two that move slowly.</p>
      </header>

      <div className="space-y-6">
        <section className="space-y-3">
          <Headline
            value={latest ? latest.average.toFixed(1) : "--"}
            unit={unit}
            caption={
              trend
                ? `${formatSigned(trend.percentPerWeek, 2)}% of bodyweight per week (${formatSigned(trend.absolutePerWeek, 2)} ${unit})`
                : "Not enough weigh-ins yet to call a direction."
            }
            label={`${MOVING_AVERAGE_DAYS}-day average`}
          />
          <BodyweightChart points={smoothed} unit={unit} windowDays={MOVING_AVERAGE_DAYS} />
          <WeighInCard
            unit={unit}
            existing={weights?.find((w) => w.date === today)?.weight ?? null}
            onSave={(value) => void recordBodyweight(userId, value, today)}
          />
        </section>

        <ProteinCard
          grams={proteinSoFar}
          target={proteinTarget}
          onAdd={(amount) => void addProtein(userId, amount, today)}
          onSet={(amount) => void setProtein(userId, amount, today)}
        />
      </div>
    </div>
  );
}

function Headline({
  value,
  unit,
  caption,
  label,
}: {
  value: string;
  unit: string;
  caption: string;
  label: string;
}) {
  return (
    <div className="pane rounded-surface px-5 py-4">
      <p className="font-mono text-label font-light uppercase text-faint">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        {/* Proportional figures on the hero number: tabular digits make a
            large standalone value read loose. The live-updating readouts in
            a workout are the opposite case and stay tabular. */}
        <span className="text-4xl font-medium tracking-tight text-text">{value}</span>
        <span className="text-base text-muted">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-muted">{caption}</p>
    </div>
  );
}

function WeighInCard({
  unit,
  existing,
  onSave,
}: {
  unit: string;
  existing: number | null;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState("");

  const save = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onSave(parsed);
    setDraft("");
  };

  return (
    <div className="pane rounded-surface px-4 py-4">
      <div className="flex items-end gap-2">
        <Field
          label={existing === null ? "Weigh in today" : "Correct today's weigh-in"}
          type="text"
          inputMode="decimal"
          suffix={unit}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder={existing !== null ? String(existing) : ""}
          enterKeyHint="done"
          className="flex-1"
        />
        <Button variant="primary" size="lg" onClick={save} disabled={draft.trim() === ""}>
          Save
        </Button>
      </div>
      {existing !== null && (
        // No tabular figures here: mono is for readouts and columns, and a
        // monospaced decimal point inside a sentence reads as "81 . 7".
        <p className="mt-2 text-xs text-muted">
          Logged {existing} {unit} today. Saving again replaces it.
        </p>
      )}
    </div>
  );
}

function ProteinCard({
  grams,
  target,
  onAdd,
  onSet,
}: {
  grams: number;
  target: number | null;
  onAdd: (amount: number) => void;
  onSet: (amount: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("");

  const percent = target && target > 0 ? Math.min(100, (grams / target) * 100) : 0;
  const remaining = target ? Math.max(0, target - grams) : null;

  return (
    <section className="pane rounded-surface">
      <div className="px-5 pt-4">
        <p className="font-mono text-label font-light uppercase text-faint">Protein today</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="text-4xl font-medium tracking-tight text-text">{Math.round(grams)}</span>
          <span className="text-base text-muted">
            {target ? `/ ${target} g` : "g"}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {target === null
            ? "Log a bodyweight to get a target."
            : remaining === 0
              ? "Target hit."
              : `${remaining} g to go.`}
        </p>

        <div
          role="progressbar"
          aria-valuenow={Math.round(grams)}
          aria-valuemin={0}
          aria-valuemax={target ?? 0}
          aria-label="Protein against target"
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 px-4 pb-4">
        <Button onClick={() => onAdd(20)}>
          <Plus size={14} weight="bold" />
          20 g
        </Button>
        <Button onClick={() => onAdd(30)}>
          <Plus size={14} weight="bold" />
          30 g
        </Button>
        <Button onClick={() => setCustom(true)}>Custom</Button>
      </div>

      <Sheet
        open={custom}
        title="Protein today"
        onClose={() => setCustom(false)}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              block
              onClick={() => {
                const parsed = Number(draft);
                if (Number.isFinite(parsed)) onAdd(parsed);
                setDraft("");
                setCustom(false);
              }}
            >
              Add to today
            </Button>
            <Button
              size="lg"
              block
              onClick={() => {
                const parsed = Number(draft);
                if (Number.isFinite(parsed)) onSet(parsed);
                setDraft("");
                setCustom(false);
              }}
            >
              Replace today&rsquo;s total
            </Button>
          </div>
        }
      >
        <div className="px-4 py-5">
          <Field
            label="Grams"
            type="text"
            inputMode="decimal"
            suffix="g"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
            autoFocus
            enterKeyHint="done"
          />
          <p className="mt-3 text-xs text-muted">
            Adding stacks onto the running total. Replacing sets it outright, for when you
            mistyped earlier.
          </p>
        </div>
      </Sheet>
    </section>
  );
}

function formatSigned(value: number, digits: number): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

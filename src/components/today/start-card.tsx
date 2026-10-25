"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Barbell, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { db } from "@/lib/db/schema";
import { listTemplates } from "@/lib/db/repo";
import type { TemplateRow } from "@/lib/types/database";

interface Props {
  next: TemplateRow | null;
  hasTemplates: boolean;
  onStart: (templateId: string | null) => void;
  onRestDone: (templateId: string) => void;
}

/**
 * What the Today screen shows when nothing is in progress.
 *
 * One obvious next action, because the user is standing in a gym and has
 * already decided to train. Everything else is one tap further away.
 */
export function StartCard({ next, hasTemplates, onStart, onRestDone }: Props) {
  const [picking, setPicking] = useState(false);
  const templates = useLiveQuery(() => listTemplates(), []);

  if (!hasTemplates) {
    return (
      <section className="rounded-surface bg-surface px-5 py-8 text-center">
        <CalendarBlank size={28} weight="duotone" className="mx-auto text-volt" />
        <h2 className="mt-3 text-lg font-semibold">No plan yet</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
          Build your split first. Any number of days, any order, rest days wherever you want
          them.
        </p>
        <Link href="/plan" className="mt-5 inline-block">
          <Button variant="primary" size="lg">
            Build your first day
          </Button>
        </Link>
        <button
          type="button"
          onClick={() => onStart(null)}
          className="mt-3 block w-full text-sm text-muted underline-offset-4 hover:text-text hover:underline"
        >
          Or just start logging
        </button>
      </section>
    );
  }

  const exerciseCount = templates?.length ?? 0;

  return (
    <>
      <section className="rounded-surface bg-surface p-5">
        <p className="text-label font-medium uppercase tracking-wide text-faint">Next up</p>

        {next?.is_rest_day ? (
          <>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight">{next.name}</h2>
            <p className="mt-1.5 text-sm text-muted">
              Nothing scheduled. Mark it done to move the rotation on, or train anyway.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" size="lg" block onClick={() => onRestDone(next.id)}>
                Mark rest day done
              </Button>
              <Button size="lg" block onClick={() => onStart(null)}>
                Train anyway
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight">
              {next?.name ?? "Empty workout"}
            </h2>
            <TemplateSummary templateId={next?.id} />
            <Button
              variant="primary"
              size="lg"
              block
              className="mt-5"
              onClick={() => onStart(next?.id ?? null)}
            >
              <Barbell size={18} weight="fill" />
              Start {next?.name ?? "workout"}
            </Button>
          </>
        )}

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="text-muted underline-offset-4 hover:text-text hover:underline"
            disabled={exerciseCount === 0}
          >
            Pick another day
          </button>
          <button
            type="button"
            onClick={() => onStart(null)}
            className="text-muted underline-offset-4 hover:text-text hover:underline"
          >
            Empty workout
          </button>
        </div>
      </section>

      <Sheet open={picking} title="Pick a day" onClose={() => setPicking(false)}>
        <ul className="divide-y divide-line">
          {(templates ?? []).map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => {
                  setPicking(false);
                  if (template.is_rest_day) onRestDone(template.id);
                  else onStart(template.id);
                }}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-surface-2"
              >
                <span className="text-sm font-medium">{template.name}</span>
                {template.is_rest_day ? (
                  <span className="text-xs text-faint">Rest</span>
                ) : (
                  <TemplateCount templateId={template.id} />
                )}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function TemplateSummary({ templateId }: { templateId?: string }) {
  const rows = useLiveQuery(
    async () =>
      templateId
        ? db().templateExercises.where("template_id").equals(templateId).toArray()
        : [],
    [templateId],
  );

  if (!rows) return <p className="mt-1.5 h-5" />;
  if (rows.length === 0) {
    return <p className="mt-1.5 text-sm text-muted">No exercises in this day yet.</p>;
  }

  const sets = rows.reduce((total, row) => total + row.sets, 0);
  return (
    <p className="mt-1.5 text-sm text-muted">
      <span className="tnum">{rows.length}</span> exercises,{" "}
      <span className="tnum">{sets}</span> sets
    </p>
  );
}

function TemplateCount({ templateId }: { templateId: string }) {
  const count = useLiveQuery(
    () => db().templateExercises.where("template_id").equals(templateId).count(),
    [templateId],
  );
  return <span className="tnum text-xs text-faint">{count ?? 0} exercises</span>;
}

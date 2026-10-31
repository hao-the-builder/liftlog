"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CaretRight,
  Gear,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { ReorderButtons } from "@/components/plan/reorder-buttons";
import { useSession } from "@/components/providers/session-provider";
import { db } from "@/lib/db/schema";
import { localPut, newId, nowIso } from "@/lib/db/outbox";
import { listTemplates } from "@/lib/db/repo";
import type { TemplateRow } from "@/lib/types/database";

/**
 * The plan: the user's rotation, in order.
 *
 * There is no built-in split. Days are whatever the user makes them, rest
 * days are days like any other, and the order on this screen is the order
 * Today walks through.
 */
export default function PlanPage() {
  const { userId } = useSession();
  const [busy, setBusy] = useState(false);
  const templates = useLiveQuery(() => listTemplates(), []);

  const counts = useLiveQuery(async () => {
    const rows = await db().templateExercises.toArray();
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.template_id, (map.get(row.template_id) ?? 0) + 1);
    return map;
  }, []);

  if (!userId) return null;

  const addDay = async (isRestDay: boolean) => {
    setBusy(true);
    const order = (templates?.length ?? 0);
    const row: TemplateRow = {
      id: newId(),
      owner_id: userId,
      name: isRestDay ? "Rest" : `Day ${order + 1}`,
      day_order: order,
      is_rest_day: isRestDay,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await localPut("templates", row as never);
    setBusy(false);
  };

  /** Reorder by swapping day_order with the neighbour, so it survives sync. */
  const move = async (index: number, direction: -1 | 1) => {
    const list = templates ?? [];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const a = list[index];
    const b = list[target];
    await localPut("templates", { ...a, day_order: target } as never);
    await localPut("templates", { ...b, day_order: index } as never);
  };

  const empty = (templates?.length ?? 0) === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8">
      <header className="flex items-end justify-between gap-3 py-5">
        <div>
          <h1 className="text-[1.75rem] font-light leading-none tracking-tight">Plan</h1>
          <p className="mt-0.5 text-sm text-muted">
            {empty ? "Build your split." : "Today walks these in order."}
          </p>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-ctl text-muted transition-colors duration-150 ease-out hover:bg-surface hover:text-text"
        >
          <Gear size={20} />
        </Link>
      </header>

      {empty ? (
        <section className="pane rounded-surface px-5 py-8 text-center">
          <h2 className="text-lg font-medium">No plan yet</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
            Add a day, fill it with exercises, repeat. Three days or six, rest days wherever
            you want them. Nothing here is fixed.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="primary" size="lg" block disabled={busy} onClick={() => void addDay(false)}>
              Add your first day
            </Button>
          </div>
        </section>
      ) : (
        <ol className="space-y-2">
          {(templates ?? []).map((template, index) => (
            <li
              key={template.id}
              className="flex items-center gap-1 pane rounded-surface pl-1 pr-2"
            >
              <ReorderButtons
                index={index}
                total={templates?.length ?? 0}
                label={template.name}
                onMove={(direction) => void move(index, direction)}
              />
              <Link
                href={`/plan/${template.id}`}
                className="flex min-h-16 flex-1 items-center justify-between gap-3 py-3 pr-1"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{template.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {template.is_rest_day ? (
                      "Rest day"
                    ) : (
                      <>
                        <span className="tnum">{counts?.get(template.id) ?? 0}</span> exercises
                      </>
                    )}
                  </p>
                </div>
                <CaretRight size={16} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ol>
      )}

      {!empty && (
        <div className="mt-4 flex flex-col gap-2">
          <Button block disabled={busy} onClick={() => void addDay(false)}>
            <Plus size={16} weight="bold" />
            Add a training day
          </Button>
          <Button block disabled={busy} onClick={() => void addDay(true)}>
            <Plus size={16} weight="bold" />
            Add a rest day
          </Button>
        </div>
      )}
    </div>
  );
}

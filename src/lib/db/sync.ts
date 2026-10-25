"use client";

/**
 * The sync engine.
 *
 * Pull brings down everything that changed since the last cursor, including
 * tombstones. Push drains the outbox in order. Neither ever blocks the UI:
 * both run in the background and the screens read from IndexedDB regardless
 * of what either is doing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SyncableTable } from "@/lib/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  db,
  getMeta,
  metaCursorKey,
  setMeta,
  type OutboxItem,
} from "./schema";
import { localTableFor, pendingItems, type SyncableRow } from "./outbox";

const PAGE_SIZE = 1000;
const DELETIONS_CURSOR = "cursor:deletions";

/** Pulled in this order so referenced rows land before the rows that use them. */
const PULL_ORDER: SyncableTable[] = [
  "profiles",
  "exercises",
  "templates",
  "template_exercises",
  "workouts",
  "set_logs",
  "bodyweight_logs",
  "protein_logs",
];

export interface SyncStatus {
  pending: number;
  /** True once the head of the queue has failed enough times to be worth saying so. */
  stalled: boolean;
  lastError: string | null;
  lastSyncedAt: string | null;
}

/** Beginning of time, used the first time a table is pulled. */
const EPOCH = "1970-01-01T00:00:00.000Z";

function client(): SupabaseClient<Database> {
  return getSupabaseBrowserClient();
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/**
 * Pulls one table forward from its cursor.
 *
 * The cursor is inclusive (gte) rather than exclusive on purpose: two rows
 * written in the same millisecond would otherwise let the second slip through
 * the gap. Re-reading the boundary row on every pull is cheap, and writing it
 * again is a no-op because it is the same row by id.
 */
async function pullTable(table: SyncableTable): Promise<number> {
  const cursor = (await getMeta<string>(metaCursorKey(table))) ?? EPOCH;
  const target = localTableFor(table);
  let newest = cursor;
  let pulled = 0;
  let offset = 0;

  for (;;) {
    const { data, error } = await client()
      .from(table)
      .select("*")
      .gte("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`pull ${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as SyncableRow[];
    if (rows.length === 0) break;

    await target.bulkPut(rows);
    pulled += rows.length;

    const last = rows[rows.length - 1];
    if (last.updated_at > newest) newest = last.updated_at;

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (newest !== cursor) await setMeta(metaCursorKey(table), newest);
  return pulled;
}

/** Applies tombstones: rows deleted on another device disappear here too. */
async function pullDeletions(): Promise<number> {
  const cursor = (await getMeta<string>(DELETIONS_CURSOR)) ?? EPOCH;

  const { data, error } = await client()
    .from("deletions" as never)
    .select("table_name, row_id, deleted_at")
    .gte("deleted_at", cursor)
    .order("deleted_at", { ascending: true })
    .limit(PAGE_SIZE);

  if (error) throw new Error(`pull deletions: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    table_name: SyncableTable;
    row_id: string;
    deleted_at: string;
  }[];
  if (rows.length === 0) return 0;

  let newest = cursor;
  for (const row of rows) {
    if (!PULL_ORDER.includes(row.table_name)) continue;
    await localTableFor(row.table_name).delete(row.row_id);
    if (row.deleted_at > newest) newest = row.deleted_at;
  }

  if (newest !== cursor) await setMeta(DELETIONS_CURSOR, newest);
  return rows.length;
}

export async function pullAll(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  let total = 0;
  for (const table of PULL_ORDER) {
    total += await pullTable(table);
  }
  total += await pullDeletions();
  return total;
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/**
 * Groups the head of the queue into one network call where it can.
 *
 * A consecutive run of upserts to the same table goes up as a single upsert of
 * an array, which turns a 24-set workout into a handful of requests instead of
 * twenty-four. The run stops at a delete or at a different table, so order is
 * still exactly as the user made the changes.
 */
function headRun(items: OutboxItem[]): OutboxItem[] {
  const first = items[0];
  if (first.op === "delete") return [first];

  const run: OutboxItem[] = [];
  for (const item of items) {
    if (item.op !== "upsert" || item.table !== first.table) break;
    run.push(item);
    if (run.length >= 100) break;
  }
  return run;
}

async function pushRun(run: OutboxItem[]): Promise<void> {
  const first = run[0];

  if (first.op === "delete") {
    const { error } = await client().rpc("delete_row" as never, {
      p_table: first.table,
      p_id: first.rowId,
    } as never);
    if (error) throw new Error(`delete ${first.table}: ${error.message}`);
    return;
  }

  const payloads = run.map((item) => item.payload);
  const { error } = await client()
    .from(first.table)
    .upsert(payloads as never, { onConflict: "id" });
  if (error) throw new Error(`upsert ${first.table}: ${error.message}`);
}

export interface FlushResult {
  flushed: number;
  remaining: number;
  error: string | null;
}

let flushing = false;

/**
 * Drains the queue. Safe to call from anywhere and as often as you like: it
 * is a no-op while a flush is already running, offline, or unconfigured.
 */
export async function flushOutbox(): Promise<FlushResult> {
  if (flushing) return { flushed: 0, remaining: await db().outbox.count(), error: null };
  if (!isSupabaseConfigured) {
    return { flushed: 0, remaining: await db().outbox.count(), error: null };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { flushed: 0, remaining: await db().outbox.count(), error: null };
  }

  flushing = true;
  let flushed = 0;

  try {
    for (;;) {
      const items = await pendingItems();
      if (items.length === 0) break;

      const run = headRun(items);
      try {
        await pushRun(run);
        await db().outbox.bulkDelete(run.map((item) => item.seq!).filter(Boolean));
        flushed += run.length;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        // Stop here rather than skipping. Later writes may depend on this one,
        // and silently dropping a logged set is never the right trade.
        await db().outbox.update(run[0].seq!, {
          attempts: run[0].attempts + 1,
          lastError: message,
        });
        return { flushed, remaining: await db().outbox.count(), error: message };
      }
    }

    await setMeta("lastSyncedAt", new Date().toISOString());
    return { flushed, remaining: 0, error: null };
  } finally {
    flushing = false;
  }
}

/** Push first so local work is safe, then pull so other devices land. */
export async function syncNow(): Promise<FlushResult> {
  const result = await flushOutbox();
  if (!result.error) {
    try {
      await pullAll();
      await setMeta("lastSyncedAt", new Date().toISOString());
    } catch (cause) {
      return {
        ...result,
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }
  return result;
}

export async function readSyncStatus(): Promise<SyncStatus> {
  const head = await db().outbox.orderBy("seq").first();
  return {
    pending: await db().outbox.count(),
    stalled: (head?.attempts ?? 0) >= 3,
    lastError: head?.lastError ?? null,
    lastSyncedAt: (await getMeta<string>("lastSyncedAt")) ?? null,
  };
}

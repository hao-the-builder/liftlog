"use client";

/**
 * The write path.
 *
 * Every mutation in the app goes through here, and every one of them is two
 * local operations in a single IndexedDB transaction: update the table the UI
 * reads from, and append to the outbox. Nothing awaits the network, so a tap
 * is never slower than IndexedDB.
 *
 * The queue is drained in order. Order matters because the rows reference each
 * other: a set log is meaningless until its workout exists. So a failed item
 * stops the flush rather than being skipped, and the whole queue is retried
 * on the next opportunity.
 */

import type { Table } from "dexie";
import type { SyncableTable } from "@/lib/types/database";
import { db, type OutboxItem } from "./schema";

/** Anything the sync queue can carry. */
export interface SyncableRow {
  id: string;
  updated_at: string;
  [key: string]: unknown;
}

/** Maps a Postgres table name to the local table that mirrors it. */
function localTable(table: SyncableTable): Table<SyncableRow, string> {
  const d = db();
  switch (table) {
    case "profiles":
      return d.profiles as unknown as Table<SyncableRow, string>;
    case "exercises":
      return d.exercises as unknown as Table<SyncableRow, string>;
    case "templates":
      return d.templates as unknown as Table<SyncableRow, string>;
    case "template_exercises":
      return d.templateExercises as unknown as Table<SyncableRow, string>;
    case "workouts":
      return d.workouts as unknown as Table<SyncableRow, string>;
    case "set_logs":
      return d.setLogs as unknown as Table<SyncableRow, string>;
    case "bodyweight_logs":
      return d.bodyweightLogs as unknown as Table<SyncableRow, string>;
    case "protein_logs":
      return d.proteinLogs as unknown as Table<SyncableRow, string>;
  }
}

export function localTableFor(table: SyncableTable): Table<SyncableRow, string> {
  return localTable(table);
}

/** A client-generated id, so a write is the same row however often it retries. */
export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Writes a row locally and queues it for Supabase.
 *
 * The row keeps the id it was created with and gets a fresh updated_at, which
 * together make the write idempotent: replaying it upserts the same row, and
 * the database-side last-write-wins trigger ignores it if something newer has
 * already landed.
 */
export async function localPut<T extends SyncableRow>(
  table: SyncableTable,
  row: T,
): Promise<T> {
  const stamped = { ...row, updated_at: nowIso() } as T;
  const target = localTable(table);

  await db().transaction("rw", target, db().outbox, async () => {
    await target.put(stamped);
    // Collapse: a row edited repeatedly offline flushes once, carrying its
    // final state, instead of replaying every intermediate value.
    await db().outbox.where("[table+rowId]").equals([table, stamped.id]).delete();
    await db().outbox.add({
      table,
      op: "upsert",
      rowId: stamped.id,
      payload: stamped as unknown as Record<string, unknown>,
      updatedAt: stamped.updated_at,
      enqueuedAt: nowIso(),
      attempts: 0,
    });
  });

  return stamped;
}

/** Writes several rows of one table in a single transaction. */
export async function localPutMany<T extends SyncableRow>(
  table: SyncableTable,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return [];
  const target = localTable(table);
  const stamped = rows.map((row) => ({ ...row, updated_at: nowIso() }) as T);

  await db().transaction("rw", target, db().outbox, async () => {
    await target.bulkPut(stamped);
    for (const row of stamped) {
      await db().outbox.where("[table+rowId]").equals([table, row.id]).delete();
      await db().outbox.add({
        table,
        op: "upsert",
        rowId: row.id,
        payload: row as unknown as Record<string, unknown>,
        updatedAt: row.updated_at,
        enqueuedAt: nowIso(),
        attempts: 0,
      });
    }
  });

  return stamped;
}

/**
 * Removes a row locally and queues the delete.
 *
 * The row disappears from the UI immediately. On the server the delete goes
 * through delete_row(), which removes it and records a tombstone in the same
 * transaction so the user's other devices learn about it on their next pull.
 */
export async function localDelete(table: SyncableTable, rowId: string): Promise<void> {
  const target = localTable(table);

  await db().transaction("rw", target, db().outbox, async () => {
    await target.delete(rowId);
    // Any queued edits to this row are moot now.
    await db().outbox.where("[table+rowId]").equals([table, rowId]).delete();
    await db().outbox.add({
      table,
      op: "delete",
      rowId,
      payload: {},
      updatedAt: nowIso(),
      enqueuedAt: nowIso(),
      attempts: 0,
    });
  });
}

export async function outboxCount(): Promise<number> {
  return db().outbox.count();
}

export async function pendingItems(limit = 200): Promise<OutboxItem[]> {
  return db().outbox.orderBy("seq").limit(limit).toArray();
}

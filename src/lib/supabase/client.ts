"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";
import type { Database } from "@/lib/types/database";

let cached: SupabaseClient<Database> | null = null;

/**
 * The browser Supabase client.
 *
 * Stores its session in cookies rather than localStorage so that Route
 * Handlers (account deletion, auth callbacks) can read the same session
 * server-side. Created lazily so that a missing .env.local never breaks a
 * static prerender, only the first real call.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const { url, anonKey } = requireSupabaseEnv();
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}

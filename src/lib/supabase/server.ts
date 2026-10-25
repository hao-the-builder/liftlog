import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Route Handlers and Server Actions. Reads the session from
 * the request cookies, so authorization is re-verified on the server rather
 * than trusted from the client.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled in proxy.ts, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Admin client, service-role key, server only. Used by exactly two callers:
 * the owner seed script and the account-deletion route, both of which need to
 * act outside Row Level Security. Never import this from a Client Component.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { url } = requireSupabaseEnv();
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. See README.md.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

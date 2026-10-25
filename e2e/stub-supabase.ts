import type { Page } from "@playwright/test";

/**
 * A stand-in for Supabase, served entirely from Playwright's router.
 *
 * The point of the end-to-end test is the part that actually runs in the gym:
 * tap a check, see the set logged, see the timer start, come back to it after
 * a reload. All of that is IndexedDB and React, and none of it should need a
 * live Postgres to verify.
 *
 * So auth returns a fixed session, reads return nothing (a brand-new account)
 * and writes are accepted and counted. The sync queue drains against this and
 * the UI behaves exactly as it does against the real thing.
 *
 * The host is a .invalid domain on purpose. Playwright can only intercept
 * requests the browser makes, not the ones the Next server makes, and the
 * proxy calls getUser() on every navigation. A name that cannot resolve makes
 * that call throw, which exercises the proxy's deliberate fail-open path
 * rather than letting a wildcard DNS answer turn into a redirect to /login.
 */

export const STUB_USER = {
  id: "11111111-2222-4333-8444-555555555555",
  aud: "authenticated",
  role: "authenticated",
  email: "lifter@example.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
};

function session() {
  return {
    access_token: "stub-access-token",
    token_type: "bearer",
    // Comfortably in the future so nothing tries to refresh mid-test.
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "stub-refresh-token",
    user: STUB_USER,
  };
}

/**
 * A slice of the shared exercise library.
 *
 * In production this arrives from Supabase on the first sync, so the stub has
 * to supply it too: without a library there is nothing to put in a plan.
 */
const GLOBAL_EXERCISES = [
  {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    owner_id: null,
    name: "Lat pulldown",
    equipment: "cable",
    primary_muscle: "lats",
    secondary_muscles: ["biceps", "upper back"],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000002",
    owner_id: null,
    name: "Machine chest press",
    equipment: "machine",
    primary_muscle: "chest",
    secondary_muscles: ["front delts", "triceps"],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "aaaaaaaa-0000-4000-8000-000000000003",
    owner_id: null,
    name: "Leg press",
    equipment: "machine",
    primary_muscle: "quads",
    secondary_muscles: ["glutes"],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

export interface StubState {
  /** Every row the client pushed, by table. */
  writes: Record<string, unknown[]>;
}

export async function stubSupabase(page: Page): Promise<StubState> {
  const state: StubState = { writes: {} };

  // WebKit is stricter than Chromium here: it rejects a wildcard origin on a
  // request that carries credentials, so the real Origin is echoed back.
  const cors = (origin: string) => ({
    "access-control-allow-origin": origin || "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "*, authorization, apikey, content-type, x-client-info, prefer",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-expose-headers": "content-range, x-supabase-api-version",
  });

  const json = (body: unknown, origin: string, status = 200) => ({
    status,
    contentType: "application/json",
    headers: cors(origin),
    body: JSON.stringify(body),
  });

  await page.route("https://stub.supabase.invalid/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = request.headers()["origin"] ?? "*";

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors(origin) });
      return;
    }

    // --- auth -------------------------------------------------------------
    if (url.pathname.startsWith("/auth/v1/")) {
      if (url.pathname.endsWith("/token")) {
        await route.fulfill(json(session(), origin));
        return;
      }
      if (url.pathname.endsWith("/user")) {
        await route.fulfill(json(STUB_USER, origin));
        return;
      }
      if (url.pathname.endsWith("/logout")) {
        await route.fulfill({ status: 204, headers: cors(origin) });
        return;
      }
      await route.fulfill(json({}, origin));
      return;
    }

    // --- data -------------------------------------------------------------
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.replace("/rest/v1/", "").split("?")[0];

      if (request.method() === "GET") {
        // A brand-new account: the shared library exists, nothing else does.
        await route.fulfill(json(table === "exercises" ? GLOBAL_EXERCISES : [], origin));
        return;
      }

      const body = request.postDataJSON?.();
      const rows = Array.isArray(body) ? body : [body];
      state.writes[table] = [...(state.writes[table] ?? []), ...rows];
      await route.fulfill(json(rows, origin));
      return;
    }

    await route.fulfill(json({}, origin));
  });

  return state;
}

import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config.
 *
 * The suite runs against a stubbed Supabase (see e2e/stub-supabase.ts), so it
 * needs no project, no secrets and no network. That keeps the happy path
 * runnable in CI and on a fresh clone, and it is honest about what it covers:
 * the client, the local database and the UI, not the server.
 *
 * iPhone viewport, because that is the device this app is for.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // One long journey rather than many shallow tests, driven against a dev
  // server that compiles routes on first visit. The default 30s is not
  // enough for the first run on a cold .next cache.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "line" : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    ...devices["iPhone 14"],
  },
  projects: [{ name: "mobile-safari", use: { ...devices["iPhone 14"] } }],
  webServer: {
    // Dev rather than a production build: the service worker is disabled in
    // dev, which keeps the test deterministic instead of racing a cache.
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://stub.supabase.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon-key",
    },
  },
});

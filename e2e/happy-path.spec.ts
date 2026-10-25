import { expect, test } from "@playwright/test";
import { stubSupabase } from "./stub-supabase";

/**
 * The happy path, start to finish: sign in, set up, build a day, train it.
 *
 * This is the one end-to-end test, so it covers the sequence that has to work
 * for the app to be worth anything, rather than many shallow ones. Supabase
 * is stubbed, so what is actually exercised is the client, the local
 * database, the sync queue and the UI.
 */
test("a new lifter signs up, builds a day, and logs a set", async ({ page }) => {
  const stub = await stubSupabase(page);

  // --- sign in -----------------------------------------------------------
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  // The submit button stays disabled until the form has hydrated, so waiting
  // for it to enable is both the correct wait and a check on that guard.
  const signIn = page.getByRole("button", { name: "Sign in" });
  await expect(signIn).toBeEnabled();

  await page.getByLabel("Email").fill("lifter@example.test");
  await page.getByLabel("Password").fill("correct-horse-battery");
  await signIn.click();

  // --- onboarding --------------------------------------------------------
  await expect(page.getByRole("heading", { name: "Set up" })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("What should we call you?").fill("Hao");
  await page.getByLabel("Bodyweight").fill("78.5");
  await page.getByLabel("Smallest weight jump").fill("2.5");
  await page.getByRole("button", { name: "Build my plan" }).click();

  // --- build a day -------------------------------------------------------
  await expect(page.getByRole("heading", { name: "No plan yet" })).toBeVisible();
  await page.getByRole("button", { name: "Add your first day" }).click();

  await page.getByRole("link", { name: /Day 1/ }).click();
  await page.getByRole("button", { name: "Add exercise" }).click();

  await page.getByLabel("Search exercises").fill("lat pulldown");
  await page.getByRole("button", { name: /^Lat pulldown/ }).click();

  await expect(page.getByText("3 x 8-12")).toBeVisible();

  // --- train it ----------------------------------------------------------
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByText("Next up")).toBeVisible();
  await page.getByRole("button", { name: /^Start Day 1/ }).click();

  await expect(page.getByText("0 of 3 sets done")).toBeVisible();

  // The first set of a brand-new exercise seeds at zero, so put a load on it.
  await page.getByRole("textbox", { name: "kg" }).first().fill("55");
  await page.getByRole("textbox", { name: "reps" }).first().fill("9");

  await page.getByRole("button", { name: "Log set 1" }).click();

  // Logged, counted, and the first working set of an exercise is a record.
  await expect(page.getByRole("button", { name: "Undo set 1" })).toBeVisible();
  await expect(page.getByText("1 of 3 sets done")).toBeVisible();
  await expect(page.getByText("Heaviest")).toBeVisible();

  // Logging a set starts the rest timer, on every screen.
  await expect(page.getByRole("timer")).toBeVisible();

  // --- the set survives a reload, because it is in IndexedDB -------------
  await page.reload();
  await expect(page.getByText("1 of 3 sets done")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Undo set 1" })).toBeVisible();

  // --- finish ------------------------------------------------------------
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "Session done" })).toBeVisible();
  // The first working set of an exercise is both the heaviest load ever
  // moved and the best estimated 1RM, so it is two records, not one.
  await expect(page.getByText("2 records")).toBeVisible();

  // --- and it was queued for the server ----------------------------------
  expect(stub.writes.set_logs ?? []).toHaveLength(1);
  const logged = (stub.writes.set_logs ?? [])[0] as { weight: number; reps: number };
  expect(logged.weight).toBe(55);
  expect(logged.reps).toBe(9);
});

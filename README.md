# Liftlog

A gym logging PWA for phones. Local-first, so it opens and logs sets with no signal, and syncs to Supabase when there is some.

Next.js 16 (App Router, TypeScript strict) · Tailwind v4 · Supabase (Postgres, Auth, RLS) · Dexie (IndexedDB) · Recharts · Vitest · Playwright.

---

## What it does

- **Today.** The next day in your rotation, set rows prefilled from last session, a progression hint per exercise, and a PR badge the moment a set earns one. Tapping the check logs instantly and starts the rest timer.
- **Rest timer.** Stored as an end timestamp, so locking the phone or backgrounding the app cannot drift it. Visible on every screen, with vibration, a tone and a notification.
- **Progress.** Estimated 1RM and top-set weight per exercise over 4 wk / 12 wk / 6 mo / all, a full session history, and weekly sets per muscle against a 10 to 20 band, this week against last.
- **Body.** Bodyweight with a 7-day moving average and a weekly rate of change as a percentage of bodyweight, plus a daily protein log against a target derived from your weight.
- **Plan.** Build any split. Days, rest days, rotation order, per-exercise sets, rep range, rest and weight step, and custom exercises.
- **Data.** Export everything as CSVs in one zip. Delete your account and every row with it.

Nothing about the split or the weight jumps is hardcoded. A rest day is a template like any other, and the weight step comes from your profile with an optional override per exercise, because gyms differ.

---

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill it in, see below
npm run dev
```

Open http://localhost:3000.

Without credentials the app runs and tells you what is missing rather than failing blank.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest, the logic suite |
| `npm run e2e` | Playwright, the one end-to-end journey |
| `npm run seed:owner` | Writes one user's private plan, see below |

---

## Supabase setup

### 1. Create the project

[database.new](https://database.new). Pick a region near you. Keep the database password.

### 2. Run the migrations

In order, from `supabase/migrations/`. Either paste each into the SQL editor (Dashboard, SQL Editor, New query) or use the CLI:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

| File | What it creates |
| --- | --- |
| `0001_init.sql` | Eight tables, indexes, and a trigger that makes a profile row on sign-up |
| `0002_rls.sql` | Row Level Security on every table. Default deny |
| `0003_exercise_library.sql` | 80 shared exercises on a fixed muscle vocabulary |
| `0004_last_write_wins.sql` | Makes a later edit win over an earlier one that synced after it |
| `0005_deletions.sql` | Tombstones, so a delete on one device reaches the others |
| `0006_deletions_write_grant.sql` | Lets `delete_row()` write the tombstone it records. Required: without it every delete fails |
| `0007_start_weight.sql` | A starting weight per exercise per day, used to seed the first session |

They are idempotent: running them twice is safe.

### 3. Environment

Copy `.env.example` to `.env.local` and fill in the values from Project Settings, API:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # public, protected by RLS
SUPABASE_SERVICE_ROLE_KEY=...            # server only, never shipped to the browser
SEED_OWNER_EMAIL=you@example.com
```

The anon key is meant to be public. The service-role key bypasses RLS and is read by exactly two server-only modules: the owner seed script and the account-deletion route.

### 4. Auth settings

In Authentication, URL Configuration, set **Site URL** to your origin (`http://localhost:3000` in development, your Vercel URL in production) and add both to **Redirect URLs**. Email confirmation is on by default; leave it on.

### 5. Seed the private plan

The 6-day PPL rotation is **not** a global template. It belongs to one account.

1. Sign up in the app with the address in `SEED_OWNER_EMAIL` and confirm the email.
2. Run it once:

```bash
npm run seed:owner
```

It finds that user with the service-role key and inserts Push A, Pull A, Legs A, Push B, Pull B, Legs B and a Rest day, with every set, rep range, rest interval and note. It is idempotent: it inserts only the days that are missing, so running it again does nothing.

---

## Deploying to Vercel

1. Push to GitHub, then import the repo at [vercel.com/new](https://vercel.com/new).
2. Add the environment variables from `.env.local` under Settings, Environment Variables. `SUPABASE_SERVICE_ROLE_KEY` goes in as a plain (not public) variable.
3. Deploy, then add the deployment URL to Supabase's Site URL and Redirect URLs.

The app is a static shell plus two dynamic routes, so it needs no special configuration.

---

## Installing it on a phone

- **iOS Safari.** Share, then Add to Home Screen. The app shows this hint once, on iOS Safari only, and never again after it is dismissed.
- **Android Chrome.** Chrome offers Install once the manifest and service worker are live.

Installed, it runs standalone, paints under the notch, and opens on Today.

---

## How the local-first part works

Supabase is the source of truth. The phone is the fast path.

- Every read on Today comes from IndexedDB. Nothing waits on the network.
- Every write lands in IndexedDB and an outbox in one transaction, then the UI updates. A background queue flushes the outbox.
- Rows carry client-generated UUIDs and an `updated_at`, so a retry upserts the same row rather than duplicating it, and `0004_last_write_wins.sql` makes the newer edit win regardless of which order the two reached the server.
- Deletes write a tombstone through `delete_row()`, so other devices learn about them.
- The queue is drained in order and stops on a failure rather than skipping, because a set log is meaningless without its workout.
- "Offline, will sync" appears only when the queue is non-empty **and** the device is offline.
- Signing out deletes the local database, unless the queue still holds unsynced work, in which case it is kept so nothing is lost and flushed on the next sign-in. Signing in as a different user on the same device always clears it.

---

## Testing

```bash
npm test     # 108 unit tests
npm run e2e  # one end-to-end journey
```

The unit tests cover the logic worth being sure about: the progression hint, Epley e1RM, PR detection (including replaying a session so a record set early in it raises the bar for the rest), fractional sets per muscle, the moving average and weekly rate of change, the CSV escaping, and the zip writer. One test parses the library migration to catch the muscle vocabulary drifting away from the one the volume chart groups on.

The end-to-end test runs the whole journey, sign in through to a finished workout, against a stubbed Supabase, so it needs no project, no secrets and no network.

### Lighthouse

Measured against a production build (`npm run build && npx next start`), mobile emulation:

| Category | Score |
| --- | --- |
| Performance | 92 to 96 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

First Contentful Paint 0.8s, Largest Contentful Paint 2.0s, Cumulative Layout Shift 0.

Lighthouse 12 removed the PWA category, so installability was checked directly: the service worker reaches `active`, the manifest carries name, short_name, `display: standalone`, a start_url and 192/512 icons in both `any` and `maskable`, and going offline then reloading a visited page still renders it while an unvisited route falls back to the offline page.

---

## Decisions worth knowing

- **Cache Components is off.** Next 16 enables it by default. Every authenticated screen here renders from IndexedDB in a Client Component, so there is no server-rendered session data worth caching, and leaving it off keeps the app shell fully static, which is what lets the service worker boot the app offline.
- **The service worker is hand-written** (`public/sw.js`). Next 16 builds with Turbopack and `@serwist/next` hooks into webpack; its Turbopack support is a separate experimental package. The caching here is small enough to state in one file: network-first for navigation, cache-first for content-hashed assets, and never for data.
- **Weight increments are typed in, not inferred.** No 2.5 upper / 5 lower rule. A profile default, overridable per exercise.
- **Charts use a stepped-down volt**, not the UI accent. The accent sits at OKLCH L 0.94 and blooms as a chart fill. The two chart steps were checked against the chart surface for lightness band, chroma, contrast and colour-blind separation.
- **`set_logs` carries `user_id`** even though it could be reached through `workouts`. It keeps the RLS policy a single column comparison instead of a per-row subquery.
- **Reordering is two buttons, not drag.** Drag inside a scrolling list on a phone fights the scroll, and buttons work from a keyboard and a screen reader for free.

## Known limits

- The rest-timer notification fires only while the page is alive. iOS suspends background pages, so a timer that ends while the app is fully backgrounded there shows as finished when you return rather than buzzing at the moment.
- Sync is last-write-wins per row. Two devices editing the same set at once keeps the later edit; there is no merge.
- Nothing has been checked on real hardware. The mobile fixes are correct by construction and were reviewed on a 390px viewport, but a phone is the only real proof.

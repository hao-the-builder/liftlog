-- ============================================================================
-- Liftlog schema.
--
-- Every user-owned table carries user_id (or reaches it through one join) and
-- is protected by Row Level Security, so a user can only ever read and write
-- their own rows. The single shared table is the global exercise library,
-- which is readable by every authenticated user and writable by none of them.
--
-- Every row carries updated_at. The client generates row ids and timestamps so
-- that the offline sync queue can retry a write any number of times without
-- duplicating or losing data: same id means an upsert, newer updated_at wins.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text          not null default '',
  unit                    text          not null default 'kg' check (unit in ('kg', 'lb')),
  protein_target_g_per_kg numeric(4, 2) not null default 1.8 check (protein_target_g_per_kg > 0),
  -- Fallback weight step for the steppers and the progression hint. A template
  -- exercise may override it; the user types whatever their gym actually has.
  default_increment       numeric(5, 2) not null default 2.5 check (default_increment > 0),
  onboarded_at            timestamptz,
  created_at              timestamptz   not null default now(),
  updated_at              timestamptz   not null default now()
);

-- ---------------------------------------------------------------------------
-- exercises. owner_id null means the shared global library.
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references auth.users (id) on delete cascade,
  name              text        not null check (length(trim(name)) > 0),
  equipment         text,
  primary_muscle    text        not null,
  secondary_muscles text[]      not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Keeps the global library free of duplicates and makes the seed idempotent.
create unique index if not exists exercises_global_name_key
  on public.exercises (lower(name)) where owner_id is null;

-- A user cannot create two custom exercises with the same name either.
create unique index if not exists exercises_owner_name_key
  on public.exercises (owner_id, lower(name)) where owner_id is not null;

create index if not exists exercises_owner_idx on public.exercises (owner_id);

-- ---------------------------------------------------------------------------
-- templates. Always private to their owner. A rest day is a template with
-- is_rest_day = true and no exercises, which lets any split be expressed:
-- 3-day full body, 6-day PPL with one rest, two rest days, anything.
-- ---------------------------------------------------------------------------
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  name        text        not null check (length(trim(name)) > 0),
  day_order   integer     not null default 0,
  is_rest_day boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists templates_owner_order_idx
  on public.templates (owner_id, day_order);

-- ---------------------------------------------------------------------------
-- template_exercises
-- ---------------------------------------------------------------------------
create table if not exists public.template_exercises (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid          not null references public.templates (id) on delete cascade,
  exercise_id  uuid          not null references public.exercises (id) on delete restrict,
  position     integer       not null default 0,
  sets         integer       not null default 3 check (sets between 1 and 20),
  rep_min      integer       not null default 8 check (rep_min between 1 and 100),
  rep_max      integer       not null default 12 check (rep_max between 1 and 100),
  rest_seconds integer       not null default 120 check (rest_seconds between 0 and 1800),
  -- Per-exercise weight step. Null falls back to profiles.default_increment.
  increment    numeric(5, 2) check (increment is null or increment > 0),
  notes        text,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  constraint template_exercises_rep_range check (rep_max >= rep_min)
);

create index if not exists template_exercises_template_idx
  on public.template_exercises (template_id, position);

-- ---------------------------------------------------------------------------
-- workouts
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  template_id uuid references public.templates (id) on delete set null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workouts_user_started_idx
  on public.workouts (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- set_logs
--
-- user_id is denormalised from workouts on purpose: it keeps the RLS policy a
-- single column comparison instead of a per-row subquery, and it makes the
-- per-exercise history query an index-only scan.
-- ---------------------------------------------------------------------------
create table if not exists public.set_logs (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid          not null references public.workouts (id) on delete cascade,
  user_id      uuid          not null references auth.users (id) on delete cascade,
  exercise_id  uuid          not null references public.exercises (id) on delete restrict,
  set_index    integer       not null check (set_index >= 0),
  weight       numeric(7, 2) not null check (weight >= 0),
  reps         integer       not null check (reps >= 0),
  rir          integer check (rir is null or rir between 0 and 10),
  is_warmup    boolean       not null default false,
  is_drop_set  boolean       not null default false,
  completed_at timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

create index if not exists set_logs_exercise_completed_idx
  on public.set_logs (exercise_id, completed_at desc);
create index if not exists set_logs_user_completed_idx
  on public.set_logs (user_id, completed_at desc);
create index if not exists set_logs_workout_idx
  on public.set_logs (workout_id);

-- ---------------------------------------------------------------------------
-- bodyweight_logs and protein_logs. One row per user per day, upserted.
-- ---------------------------------------------------------------------------
create table if not exists public.bodyweight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid          not null references auth.users (id) on delete cascade,
  date       date          not null,
  weight     numeric(6, 2) not null check (weight > 0),
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now(),
  unique (user_id, date)
);

create index if not exists bodyweight_logs_user_date_idx
  on public.bodyweight_logs (user_id, date desc);

create table if not exists public.protein_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid          not null references auth.users (id) on delete cascade,
  date       date          not null,
  grams      numeric(7, 2) not null check (grams >= 0),
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now(),
  unique (user_id, date)
);

create index if not exists protein_logs_user_date_idx
  on public.protein_logs (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Create a profile row the moment an auth user is created.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$func$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

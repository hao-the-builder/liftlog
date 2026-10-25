-- ============================================================================
-- Tombstones.
--
-- A pull-based sync can see new and changed rows, because both carry a fresh
-- updated_at. It cannot see a row that is simply gone. Without a record of
-- deletions, a template deleted on the phone reappears the next time the
-- tablet syncs, which is the classic offline-sync data bug.
--
-- So deletes are recorded. The row itself is really deleted (no soft-delete
-- column leaking into every query and every unique index) and a tombstone is
-- written alongside it in the same transaction by delete_row() below.
-- Clients pull tombstones on the same cursor as everything else and drop the
-- matching local rows.
-- ============================================================================

create table if not exists public.deletions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  table_name text        not null,
  row_id     uuid        not null,
  deleted_at timestamptz not null default now(),
  unique (user_id, table_name, row_id)
);

create index if not exists deletions_user_deleted_idx
  on public.deletions (user_id, deleted_at desc);

alter table public.deletions enable row level security;

drop policy if exists deletions_select_own on public.deletions;
create policy deletions_select_own on public.deletions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Tombstones are only ever written through delete_row(), never directly.
revoke all on public.deletions from anon, authenticated;
grant select on public.deletions to authenticated;

-- ---------------------------------------------------------------------------
-- delete_row: delete a row and record the tombstone atomically.
--
-- Deliberately security invoker, so the DELETE runs as the calling user and
-- Row Level Security still decides what they are allowed to remove. The
-- function cannot be used to reach another user's data. The table name is
-- checked against a fixed list before it reaches format(), so it cannot be
-- used to touch an arbitrary table either.
-- ---------------------------------------------------------------------------
create or replace function public.delete_row(p_table text, p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $func$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_table not in (
    'exercises', 'templates', 'template_exercises',
    'workouts', 'set_logs', 'bodyweight_logs', 'protein_logs'
  ) then
    raise exception 'table % is not deletable', p_table;
  end if;

  execute format('delete from public.%I where id = $1', p_table) using p_id;

  insert into public.deletions (user_id, table_name, row_id)
  values (uid, p_table, p_id)
  on conflict (user_id, table_name, row_id)
    do update set deleted_at = now();
end;
$func$;

grant execute on function public.delete_row(text, uuid) to authenticated;

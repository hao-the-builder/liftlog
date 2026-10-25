-- ============================================================================
-- Last write wins, enforced in the database.
--
-- The client queues writes offline and flushes them whenever the phone has
-- signal again, so rows can arrive out of order: a correction made at 10:05
-- can reach Supabase after the original made at 10:00, and two devices can
-- flush the same row in either order.
--
-- This trigger makes the outcome depend on when the user made the change
-- rather than on when the network happened to deliver it. An update carrying
-- an older updated_at than the stored row is skipped. Returning null from a
-- BEFORE UPDATE trigger silently drops that one row update, which is exactly
-- the semantics we want: the retry succeeds, nothing is overwritten, and the
-- client's outbox can clear the entry.
--
-- Insert is untouched, so a first write always lands.
-- ============================================================================

create or replace function public.enforce_last_write_wins()
returns trigger
language plpgsql
as $func$
begin
  if new.updated_at is not null
     and old.updated_at is not null
     and new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$func$;

do $do$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'exercises', 'templates', 'template_exercises',
    'workouts', 'set_logs', 'bodyweight_logs', 'protein_logs'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_lww', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.enforce_last_write_wins()',
      t || '_lww', t
    );
  end loop;
end;
$do$;

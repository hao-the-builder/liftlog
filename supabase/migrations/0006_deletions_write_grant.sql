-- ============================================================================
-- Fix: delete_row() could never write its own tombstone.
--
-- 0005 made two decisions that cannot both hold:
--
--   revoke all on public.deletions from anon, authenticated;   -- line 36
--   ... security invoker ...                                   -- line 51
--   insert into public.deletions (...)                         -- line 70
--
-- "Tombstones are only ever written through delete_row()" is a sentence that
-- assumes the function carries rights of its own. A security invoker function
-- carries none: the INSERT on line 70 executes as the calling user, and that
-- user had just been stripped of every privilege on the table. So every
-- delete in the app failed with
--
--   permission denied for table deletions
--
-- and, because the outbox stops at the first failure rather than skipping
-- past it, one deleted template wedged the whole queue behind it.
--
-- The fix is to grant the write, not to make the function definer. Keeping it
-- security invoker is what makes this safe to reason about: the DELETE is
-- still decided by Row Level Security on the target table, so the function
-- cannot reach a row its caller could not have deleted by hand. A definer
-- function would bypass RLS entirely and would have to re-implement ownership
-- for seven tables with three different ownership columns, which is a larger
-- and much sharper edge than the one being removed.
--
-- Writing a tombstone directly is now possible and is not worth defending
-- against: the check constraint below pins user_id to the caller, every row
-- the caller can see is already their own, and a tombstone only ever tells
-- that same person's other devices to drop a row they own.
--
-- UPDATE is granted alongside INSERT because delete_row() upserts: deleting a
-- row, re-syncing it from another device, and deleting it again must refresh
-- deleted_at rather than collide with the unique constraint.
-- ============================================================================

grant insert, update on public.deletions to authenticated;

drop policy if exists deletions_insert_own on public.deletions;
create policy deletions_insert_own on public.deletions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists deletions_update_own on public.deletions;
create policy deletions_update_own on public.deletions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- anon stays with nothing, exactly as before.
revoke all on public.deletions from anon;

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import type { ProfileRow } from "@/lib/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { clearLocalDatabase, db, getMeta, META_USER_ID, setMeta } from "@/lib/db/schema";
import { readSyncStatus, syncNow, type SyncStatus } from "@/lib/db/sync";

interface SessionValue {
  userId: string | null;
  email: string | null;
  profile: ProfileRow | undefined;
  loading: boolean;
  online: boolean;
  sync: SyncStatus;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const IDLE_SYNC_MS = 60_000;

const EMPTY_STATUS: SyncStatus = {
  pending: 0,
  stalled: false,
  lastError: null,
  lastSyncedAt: null,
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  // Starts false when there is no Supabase to ask, so the unconfigured case
  // needs no state update at all and the guidance screen renders at once.
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [online, setOnline] = useState(true);
  const [syncTick, setSyncTick] = useState(0);
  const signingOut = useRef(false);

  // The profile is read live from IndexedDB, so onboarding and settings
  // changes appear the instant they are written, before any network round trip.
  const profile = useLiveQuery(
    async () => (userId ? await db().profiles.get(userId) : undefined),
    [userId],
  );

  const sync = useLiveQuery(async () => {
    // Depending on syncTick re-reads the status after each sync attempt.
    void syncTick;
    return readSyncStatus();
  }, [syncTick]) ?? EMPTY_STATUS;

  const runSync = useCallback(async () => {
    if (!isSupabaseConfigured || signingOut.current) return;
    try {
      await syncNow();
    } catch {
      // Sync failures are expected offline. The queue keeps the writes and
      // the indicator tells the user; there is nothing to handle here.
    } finally {
      setSyncTick((t) => t + 1);
    }
  }, []);

  // --- session bootstrap ---------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    const adopt = async (id: string | null, mail: string | null) => {
      if (cancelled) return;

      if (id) {
        // A different account on the same device starts from a clean slate,
        // so one person's training is never visible in another's session.
        const previous = await getMeta<string>(META_USER_ID);
        if (previous && previous !== id) {
          await clearLocalDatabase();
        }
        await setMeta(META_USER_ID, id);
      }

      if (cancelled) return;
      setUserId(id);
      setEmail(mail);
      setLoading(false);
      if (id) void runSync();
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => adopt(data.session?.user.id ?? null, data.session?.user.email ?? null));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void adopt(session?.user.id ?? null, session?.user.email ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [runSync]);

  // --- sync triggers -------------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    const update = () => setOnline(navigator.onLine);
    update();

    const onOnline = () => {
      update();
      void runSync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void runSync(), IDLE_SYNC_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [userId, runSync]);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      if (isSupabaseConfigured) {
        // One last attempt to get queued work up before the local copy goes.
        try {
          await syncNow();
        } catch {
          // Offline sign-out still proceeds; the writes are already in Supabase
          // or were never going to make it from this device.
        }
        await getSupabaseBrowserClient().auth.signOut();
      }
      await clearLocalDatabase();
    } finally {
      signingOut.current = false;
      // A full reload rather than a route push: every live query in the tree
      // is bound to a database that no longer exists.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      userId,
      email,
      profile,
      loading,
      online,
      sync,
      signOut,
      refresh: () => router.refresh(),
    }),
    [userId, email, profile, loading, online, sync, signOut, router],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

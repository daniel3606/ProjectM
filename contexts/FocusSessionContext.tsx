import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { usePersistedState } from "@/lib/storage";
import type { FocusMode } from "@/constants/marshmallow";
import {
  notifyBlockEnded,
  scheduleBlockEndNotification,
  cancelBlockEndNotification,
} from "@/lib/notifications";
import { syncCompletedSession, fetchAccountGrowth } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import * as ScreenTime from "@/modules/screen-time";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface FocusSessionConfig {
  durationMinutes: number;
  focusMode: FocusMode;
  expectedGrowthCm: number;
  /** Set when this session was auto-started by a Timed Block plan rather than manually. */
  planId?: string;
  /** Plan label, used to personalize the auto-dismiss notification for Timed Block sessions. */
  label?: string;
}

export interface ActiveSession extends FocusSessionConfig {
  startedAt: number;
}

export interface CompletedSession extends FocusSessionConfig {
  completedAt: number;
}

export interface PendingGrowthResult {
  growthCm: number;
  durationMinutes: number;
  focusMode: FocusMode;
  label?: string;
}

const MAX_HISTORY = 50;

function sumGrowth(sessions: CompletedSession[]) {
  return sessions.reduce((sum, s) => sum + s.expectedGrowthCm, 0);
}

interface FocusSessionContextValue {
  activeSession: ActiveSession | null;
  history: CompletedSession[];
  /**
   * Account-wide growth from completed sessions. Marshmallow size is
   * `3cm + totalGrowthCm`. When signed in this is hydrated from the profile
   * so every device shows the same size.
   */
  totalGrowthCm: number;
  pendingGrowthResult: PendingGrowthResult | null;
  /** `startedAt` defaults to now; pass it explicitly to pin a session to a real scheduled start time. */
  startSession: (config: FocusSessionConfig, startedAt?: number) => void;
  stopSession: () => void;
  /** Patches the running session in place (e.g. duration/growth from an edit) without resetting `startedAt`. No-op if nothing is active. */
  updateSession: (patch: Partial<Omit<ActiveSession, "startedAt">>) => void;
  clearPendingGrowthResult: () => void;
}

const FocusSessionContext = createContext<FocusSessionContextValue | null>(null);

export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [activeSession, setActiveSession] = usePersistedState<ActiveSession | null>(
    "focusSession.active",
    null
  );
  const [history, setHistory] = usePersistedState<CompletedSession[]>(
    "focusSession.history",
    []
  );
  const [totalGrowthCm, setTotalGrowthCm] = usePersistedState(
    "focusSession.totalGrowthCm",
    0
  );
  const [pendingSync, setPendingSync] = usePersistedState<CompletedSession[]>(
    "focusSession.pendingSync",
    []
  );
  const [pendingGrowthResult, setPendingGrowthResult] =
    usePersistedState<PendingGrowthResult | null>("focusSession.pendingGrowthResult", null);
  const presenceRef = useRef<RealtimeChannel | null>(null);
  const endNotificationIdRef = useRef<string | null>(null);
  const hydratingRef = useRef(false);
  const hydrateAgainRef = useRef(false);
  const pendingSyncRef = useRef(pendingSync);
  pendingSyncRef.current = pendingSync;

  // Broadcast focus presence when session starts/stops
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;

      // Clean up previous channel
      if (presenceRef.current) {
        await presenceRef.current.untrack();
        supabase.removeChannel(presenceRef.current);
        presenceRef.current = null;
      }

      if (activeSession) {
        const channel = supabase.channel("focus-presence", {
          config: { presence: { key: session.user.id } },
        });

        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            await channel.track({
              isFocusing: true,
              focusMode: activeSession.focusMode,
              startedAt: activeSession.startedAt,
            });
          }
        });

        presenceRef.current = channel;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSession]);

  const flushPendingSync = useCallback(async () => {
    const queue = pendingSyncRef.current;
    if (queue.length === 0) return;
    const remaining: CompletedSession[] = [];
    for (const session of queue) {
      try {
        await syncCompletedSession(session);
      } catch {
        remaining.push(session);
      }
    }
    pendingSyncRef.current = remaining;
    setPendingSync(remaining);
  }, [setPendingSync]);

  const hydrateFromAccount = useCallback(async (id: string) => {
    if (hydratingRef.current) {
      hydrateAgainRef.current = true;
      return;
    }
    hydratingRef.current = true;
    try {
      do {
        hydrateAgainRef.current = false;
        await flushPendingSync();
        const remote = await fetchAccountGrowth(id);
        setTotalGrowthCm(remote.totalGrowthCm);
        setHistory(remote.sessions.slice(0, MAX_HISTORY));
      } while (hydrateAgainRef.current);
    } catch {
      // Keep local totals if the network is down.
    } finally {
      hydratingRef.current = false;
    }
  }, [flushPendingSync, setHistory, setTotalGrowthCm]);

  // Seed stored growth from local history once, so existing installs don't
  // jump back to 3cm before the first remote hydrate lands.
  useEffect(() => {
    if (totalGrowthCm > 0 || history.length === 0) return;
    setTotalGrowthCm(Math.round(sumGrowth(history) * 10) / 10);
  }, [history, totalGrowthCm, setTotalGrowthCm]);

  // Hydrate growth from the account whenever the signed-in user changes
  // (including restoring an existing session) and again when the app
  // comes to the foreground, so two devices stay in lockstep.
  useEffect(() => {
    if (!userId) return;

    hydrateFromAccount(userId);

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") hydrateFromAccount(userId);
    });

    return () => {
      appState.remove();
    };
  }, [userId, hydrateFromAccount]);

  const startSession = useCallback(
    (config: FocusSessionConfig, startedAt: number = Date.now()) => {
      setActiveSession({ ...config, startedAt });
    },
    [setActiveSession]
  );

  const updateSession = useCallback(
    (patch: Partial<Omit<ActiveSession, "startedAt">>) => {
      setActiveSession((current) => (current ? { ...current, ...patch } : current));
    },
    [setActiveSession]
  );

  const clearPendingGrowthResult = useCallback(() => {
    setPendingGrowthResult(null);
  }, [setPendingGrowthResult]);

  const stopSession = useCallback(() => {
    ScreenTime.clearBlocking().catch(() => {});
    ScreenTime.clearActiveNativeBlock().catch(() => {});

    // Cancel the scheduled end notification — the foreground path handles it.
    cancelBlockEndNotification(endNotificationIdRef.current);
    endNotificationIdRef.current = null;

    // Untrack presence
    if (presenceRef.current) {
      presenceRef.current.untrack().catch(() => {});
      supabase.removeChannel(presenceRef.current);
      presenceRef.current = null;
    }

    setActiveSession((current) => {
      if (current) {
        const { startedAt, ...config } = current;
        const completed: CompletedSession = { ...config, completedAt: Date.now() };
        setHistory((prev) => [completed, ...prev].slice(0, MAX_HISTORY));
        setTotalGrowthCm((prev) => Math.round((prev + current.expectedGrowthCm) * 10) / 10);
        pendingSyncRef.current = [...pendingSyncRef.current, completed];
        setPendingSync(pendingSyncRef.current);
        setPendingGrowthResult({
          growthCm: current.expectedGrowthCm,
          durationMinutes: current.durationMinutes,
          focusMode: current.focusMode,
          label: current.label,
        });
        if (userId) {
          void hydrateFromAccount(userId);
        }
      }
      return null;
    });
  }, [setActiveSession, setHistory, setPendingGrowthResult, setPendingSync, setTotalGrowthCm, userId, hydrateFromAccount]);

  // Auto-dismisses the active session (and unblocks apps) the moment its
  // duration elapses, whether it was started manually or by a Timed Block
  // plan — the user should never have to remember to tap "End Block".
  // Also schedules a future notification so the user is notified even if
  // the app is killed or backgrounded before the timer fires.
  useEffect(() => {
    if (!activeSession) return;

    const endsAt = activeSession.startedAt + activeSession.durationMinutes * 60_000;
    const remainingMs = endsAt - Date.now();

    // Schedule a future notification as a background-safe fallback.
    scheduleBlockEndNotification(endsAt, activeSession.expectedGrowthCm, activeSession.label)
      .then((id) => { endNotificationIdRef.current = id; });

    const autoEnd = () => {
      // Cancel the scheduled notification — we're firing the immediate one instead.
      cancelBlockEndNotification(endNotificationIdRef.current);
      endNotificationIdRef.current = null;
      notifyBlockEnded(activeSession.label, activeSession.expectedGrowthCm);
      stopSession();
    };

    if (remainingMs <= 0) {
      autoEnd();
      return;
    }
    const timer = setTimeout(autoEnd, remainingMs);
    return () => clearTimeout(timer);
  }, [activeSession, stopSession]);

  const value = useMemo(
    () => ({
      activeSession,
      history,
      totalGrowthCm,
      pendingGrowthResult,
      startSession,
      stopSession,
      updateSession,
      clearPendingGrowthResult,
    }),
    [activeSession, history, totalGrowthCm, pendingGrowthResult, startSession, stopSession, updateSession, clearPendingGrowthResult]
  );

  return (
    <FocusSessionContext.Provider value={value}>
      {children}
    </FocusSessionContext.Provider>
  );
}

export function useFocusSession() {
  const ctx = useContext(FocusSessionContext);
  if (!ctx) {
    throw new Error("useFocusSession must be used within a FocusSessionProvider");
  }
  return ctx;
}

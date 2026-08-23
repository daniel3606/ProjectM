import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { usePersistedState } from "@/lib/storage";
import { computeMarshmallowSizeCm, type FocusMode } from "@/constants/marshmallow";
import {
  notifyBlockEnded,
  scheduleBlockEndNotification,
  cancelBlockEndNotification,
} from "@/lib/notifications";
import { syncCompletedSession, fetchRemoteSessions } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
import * as ScreenTime from "@/modules/screen-time";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface FocusSessionConfig {
  durationMinutes: number;
  focusMode: FocusMode;
  expectedGrowthCm: number;
  /** App/category/web IDs to block; empty means block everything. */
  appIds?: string[];
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

interface FocusSessionContextValue {
  activeSession: ActiveSession | null;
  history: CompletedSession[];
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
  const [activeSession, setActiveSession, activeSessionLoaded] = usePersistedState<ActiveSession | null>(
    "focusSession.active",
    null
  );
  const [history, setHistory] = usePersistedState<CompletedSession[]>(
    "focusSession.history",
    []
  );
  const [pendingGrowthResult, setPendingGrowthResult] =
    usePersistedState<PendingGrowthResult | null>("focusSession.pendingGrowthResult", null);
  const presenceRef = useRef<RealtimeChannel | null>(null);
  const endNotificationIdRef = useRef<string | null>(null);

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

  // Mirrors activeSession into the App Group so the MarshmallowWidget
  // extension can show a remaining-time countdown without the app running.
  // Covers Quick Block start, Timed Block adoption, and updateSession edits
  // uniformly, since all of them funnel through this same state.
  useEffect(() => {
    if (activeSession) {
      ScreenTime.setActiveNativeBlock({
        planId: activeSession.planId,
        startedAt: activeSession.startedAt,
        durationMinutes: activeSession.durationMinutes,
        label: activeSession.label ?? "Focus Block",
      }).catch(() => {});
    } else {
      ScreenTime.clearActiveNativeBlock().catch(() => {});
    }
  }, [activeSession]);

  // Keeps the widget's marshmallow size in sync with history-derived size.
  useEffect(() => {
    ScreenTime.setMarshmallowSizeCm(computeMarshmallowSizeCm(history));
  }, [history]);

  // Hydrate session history from Supabase on login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const remoteSessions = await fetchRemoteSessions(session.user.id);
          if (remoteSessions.length > 0) {
            setHistory(remoteSessions);
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [setHistory]);

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
        const endsAt = current.startedAt + current.durationMinutes * 60_000;
        const ranFullDuration = Date.now() >= endsAt;

        // Ended early (cancelled, or the underlying plan changed mid-window):
        // no growth, and it doesn't count as a completed session.
        if (ranFullDuration) {
          const { startedAt, ...config } = current;
          const completed: CompletedSession = { ...config, completedAt: Date.now() };
          setHistory((prev) =>
            [completed, ...prev].slice(0, MAX_HISTORY)
          );
          setPendingGrowthResult({
            growthCm: current.expectedGrowthCm,
            durationMinutes: current.durationMinutes,
            focusMode: current.focusMode,
            label: current.label,
          });
          // Fire-and-forget sync to Supabase
          syncCompletedSession(completed).catch(() => {});
        }
      }
      return null;
    });
  }, [setActiveSession, setHistory, setPendingGrowthResult]);

  // Auto-dismisses the active session (and unblocks apps) the moment its
  // duration elapses, whether it was started manually or by a Timed Block
  // plan — the user should never have to remember to tap "End Block".
  // Also schedules a future notification so the user is notified even if
  // the app is killed or backgrounded before the timer fires.
  useEffect(() => {
    if (!activeSessionLoaded || !activeSession) return;

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
  }, [activeSession, activeSessionLoaded, stopSession]);

  const value = useMemo(
    () => ({
      activeSession,
      history,
      pendingGrowthResult,
      startSession,
      stopSession,
      updateSession,
      clearPendingGrowthResult,
    }),
    [activeSession, history, pendingGrowthResult, startSession, stopSession, updateSession, clearPendingGrowthResult]
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

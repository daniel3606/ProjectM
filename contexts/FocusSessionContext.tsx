import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { usePersistedState } from "@/lib/storage";
import type { FocusMode } from "@/constants/marshmallow";
import { notifyBlockEnded } from "@/lib/notifications";
import { syncCompletedSession } from "@/lib/sync";
import { supabase } from "@/lib/supabase";
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

const MAX_HISTORY = 50;

interface FocusSessionContextValue {
  activeSession: ActiveSession | null;
  history: CompletedSession[];
  /** `startedAt` defaults to now; pass it explicitly to pin a session to a real scheduled start time. */
  startSession: (config: FocusSessionConfig, startedAt?: number) => void;
  stopSession: () => void;
  /** Patches the running session in place (e.g. duration/growth from an edit) without resetting `startedAt`. No-op if nothing is active. */
  updateSession: (patch: Partial<Omit<ActiveSession, "startedAt">>) => void;
}

const FocusSessionContext = createContext<FocusSessionContextValue | null>(null);

export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = usePersistedState<ActiveSession | null>(
    "focusSession.active",
    null
  );
  const [history, setHistory] = usePersistedState<CompletedSession[]>(
    "focusSession.history",
    []
  );
  const presenceRef = useRef<RealtimeChannel | null>(null);

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

  const stopSession = useCallback(() => {
    ScreenTime.clearBlocking().catch(() => {});

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
        setHistory((prev) =>
          [completed, ...prev].slice(0, MAX_HISTORY)
        );
        // Fire-and-forget sync to Supabase
        syncCompletedSession(completed).catch(() => {});
      }
      return null;
    });
  }, [setActiveSession, setHistory]);

  // Auto-dismisses the active session (and unblocks apps) the moment its
  // duration elapses, whether it was started manually or by a Timed Block
  // plan — the user should never have to remember to tap "End Block".
  useEffect(() => {
    if (!activeSession) return;

    const endsAt = activeSession.startedAt + activeSession.durationMinutes * 60_000;
    const remainingMs = endsAt - Date.now();

    const autoEnd = () => {
      notifyBlockEnded(activeSession.label);
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
    () => ({ activeSession, history, startSession, stopSession, updateSession }),
    [activeSession, history, startSession, stopSession, updateSession]
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

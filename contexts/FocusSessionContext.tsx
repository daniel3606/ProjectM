import React, { createContext, useCallback, useContext, useMemo } from "react";
import { usePersistedState } from "@/lib/storage";
import type { FocusMode } from "@/constants/marshmallow";

export interface FocusSessionConfig {
  durationMinutes: number;
  focusMode: FocusMode;
  expectedGrowthCm: number;
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
  startSession: (config: FocusSessionConfig) => void;
  stopSession: () => void;
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

  const startSession = useCallback(
    (config: FocusSessionConfig) => {
      setActiveSession({ ...config, startedAt: Date.now() });
    },
    [setActiveSession]
  );

  const stopSession = useCallback(() => {
    setActiveSession((current) => {
      if (current) {
        const { startedAt, ...config } = current;
        setHistory((prev) =>
          [{ ...config, completedAt: Date.now() }, ...prev].slice(0, MAX_HISTORY)
        );
      }
      return null;
    });
  }, [setActiveSession, setHistory]);

  const value = useMemo(
    () => ({ activeSession, history, startSession, stopSession }),
    [activeSession, history, startSession, stopSession]
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

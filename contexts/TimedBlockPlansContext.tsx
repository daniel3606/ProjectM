import React, { createContext, useCallback, useContext, useMemo } from "react";
import { usePersistedState } from "@/lib/storage";
import type { FocusMode } from "@/constants/marshmallow";

export interface TimedBlockPlan {
  id: string;
  label: string;
  durationMinutes: number;
  focusMode: FocusMode;
  appIds: string[];
  appsSummary: { appCount: number; catCount: number; webCount: number };
}

interface TimedBlockPlansContextValue {
  plans: TimedBlockPlan[];
  addPlan: (plan: Omit<TimedBlockPlan, "id">) => void;
  removePlan: (id: string) => void;
}

const TimedBlockPlansContext = createContext<TimedBlockPlansContextValue | null>(null);

export function TimedBlockPlansProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = usePersistedState<TimedBlockPlan[]>("timedBlockPlans", []);

  const addPlan = useCallback(
    (plan: Omit<TimedBlockPlan, "id">) => {
      setPlans((prev) => [
        { ...plan, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
        ...prev,
      ]);
    },
    [setPlans]
  );

  const removePlan = useCallback(
    (id: string) => {
      setPlans((prev) => prev.filter((p) => p.id !== id));
    },
    [setPlans]
  );

  const value = useMemo(
    () => ({ plans, addPlan, removePlan }),
    [plans, addPlan, removePlan]
  );

  return (
    <TimedBlockPlansContext.Provider value={value}>
      {children}
    </TimedBlockPlansContext.Provider>
  );
}

export function useTimedBlockPlans() {
  const ctx = useContext(TimedBlockPlansContext);
  if (!ctx) {
    throw new Error("useTimedBlockPlans must be used within a TimedBlockPlansProvider");
  }
  return ctx;
}

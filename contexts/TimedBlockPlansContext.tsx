import React, { createContext, useCallback, useContext, useMemo } from "react";
import { usePersistedState } from "@/lib/storage";
import type { FocusMode } from "@/constants/marshmallow";

export interface TimedBlockPlan {
  id: string;
  label: string;
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-23
  endMinute: number; // 0-59
  durationMinutes: number;
  focusMode: FocusMode;
  appIds: string[];
  appsSummary: { appCount: number; catCount: number; webCount: number };
  enabled: boolean;
}

interface TimedBlockPlansContextValue {
  plans: TimedBlockPlan[];
  addPlan: (plan: Omit<TimedBlockPlan, "id">) => void;
  updatePlan: (id: string, plan: Omit<TimedBlockPlan, "id">) => void;
  removePlan: (id: string) => void;
  setPlanEnabled: (id: string, enabled: boolean) => void;
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

  const updatePlan = useCallback(
    (id: string, plan: Omit<TimedBlockPlan, "id">) => {
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...plan, id } : p)));
    },
    [setPlans]
  );

  const removePlan = useCallback(
    (id: string) => {
      setPlans((prev) => prev.filter((p) => p.id !== id));
    },
    [setPlans]
  );

  const setPlanEnabled = useCallback(
    (id: string, enabled: boolean) => {
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
    },
    [setPlans]
  );

  const value = useMemo(
    () => ({ plans, addPlan, updatePlan, removePlan, setPlanEnabled }),
    [plans, addPlan, updatePlan, removePlan, setPlanEnabled]
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

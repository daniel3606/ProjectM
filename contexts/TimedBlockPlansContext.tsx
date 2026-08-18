import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { usePersistedState } from "@/lib/storage";
import { getGrowthForDuration, type FocusMode } from "@/constants/marshmallow";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { findActiveOccurrence } from "@/lib/timedBlockSchedule";
import { notifyBlockStarted } from "@/lib/notifications";
import * as ScreenTime from "@/modules/screen-time";

const SCHEDULE_CHECK_INTERVAL_MS = 15_000;

export interface TimedBlockPlan {
  id: string;
  label: string;
  daysOfWeek: number[]; // 0 = Sunday ... 6 = Saturday
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

// Plans saved before multi-day selection stored a single `dayOfWeek` number
// instead of `daysOfWeek`. Coerce that legacy shape on read so old persisted
// data doesn't crash the app.
function normalizePlan(plan: TimedBlockPlan): TimedBlockPlan {
  if (Array.isArray(plan.daysOfWeek)) return plan;
  const legacyDay = (plan as unknown as { dayOfWeek?: number }).dayOfWeek;
  return { ...plan, daysOfWeek: typeof legacyDay === "number" ? [legacyDay] : [] };
}

export function TimedBlockPlansProvider({ children }: { children: React.ReactNode }) {
  const [rawPlans, setPlans] = usePersistedState<TimedBlockPlan[]>("timedBlockPlans", []);
  const plans = useMemo(() => rawPlans.map(normalizePlan), [rawPlans]);

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

  const { activeSession, startSession, stopSession } = useFocusSession();
  // Occurrences (planId + scheduled start) the user ended early via "End
  // Block" — kept out of the next tick's restart until the window passes.
  const dismissedOccurrencesRef = useRef<Set<string>>(new Set());
  const prevSessionRef = useRef(activeSession);

  // Registers OS-level monitoring (TimedBlockMonitor extension) for every
  // enabled plan, so a scheduled block still starts/ends even if the app is
  // never opened at the scheduled time — the tick() loop below only runs
  // while this JS is alive. Re-registers wholesale on every plan change.
  useEffect(() => {
    const schedulable = plans
      .filter((plan) => plan.enabled && plan.daysOfWeek.length > 0)
      .map((plan) => ({
        id: plan.id,
        label: plan.label,
        daysOfWeek: plan.daysOfWeek,
        startHour: plan.startHour,
        startMinute: plan.startMinute,
        endHour: plan.endHour,
        endMinute: plan.endMinute,
        appIds: plan.appIds,
      }));
    ScreenTime.scheduleTimedBlocks(schedulable).catch(() => {});
  }, [plans]);

  // Adopts a block the TimedBlockMonitor extension already started while the
  // app wasn't running, so the UI (timer, growth preview) reflects reality
  // instead of showing nothing blocked. Only ever fills in a *missing*
  // session — never overrides one the app already knows about.
  useEffect(() => {
    if (activeSession) return;
    let cancelled = false;

    const adoptNativeBlockIfAny = () => {
      ScreenTime.getActiveNativeBlock().then((native) => {
        if (cancelled || !native) return;
        const plan = plans.find((p) => p.id === native.planId);
        if (!plan) return;

        // Re-apply blocking from the main app process — the extension's
        // ManagedSettingsStore may not have persisted across cold launch.
        const applyBlock =
          plan.appIds.length > 0
            ? ScreenTime.applyBlocking(plan.appIds)
            : ScreenTime.blockAll();
        applyBlock.catch(() => {});

        startSession(
          {
            durationMinutes: plan.durationMinutes,
            focusMode: plan.focusMode,
            expectedGrowthCm: getGrowthForDuration(plan.durationMinutes, plan.focusMode),
            planId: plan.id,
            label: plan.label,
          },
          native.startedAt
        );
      }).catch(() => {});
    };

    adoptNativeBlockIfAny();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") adoptNativeBlockIfAny();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [activeSession, plans, startSession]);

  useEffect(() => {
    const prev = prevSessionRef.current;
    prevSessionRef.current = activeSession;

    if (prev?.planId && !activeSession) {
      const occurrence = findActiveOccurrence(plans, Date.now());
      if (occurrence && occurrence.plan.id === prev.planId && occurrence.startsAt === prev.startedAt) {
        dismissedOccurrencesRef.current.add(`${prev.planId}-${prev.startedAt}`);
      }
    }
  }, [activeSession, plans]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const occurrence = findActiveOccurrence(plans, now);

      if (activeSession?.planId) {
        const stillRunning =
          !!occurrence &&
          occurrence.plan.id === activeSession.planId &&
          occurrence.startsAt === activeSession.startedAt;
        if (!stillRunning) {
          // The plan was disabled/edited/deleted mid-window — end early.
          // The normal end-of-window case is instead caught by
          // FocusSessionContext's own duration timer, which also fires the
          // "Block Ended" notification.
          stopSession();
        }
        return;
      }

      // A manual (non-plan) focus session is running — never interrupt it.
      if (activeSession || !occurrence) return;

      const occurrenceKey = `${occurrence.plan.id}-${occurrence.startsAt}`;
      if (dismissedOccurrencesRef.current.has(occurrenceKey)) return;

      const applyBlock =
        occurrence.plan.appIds.length > 0
          ? ScreenTime.applyBlocking(occurrence.plan.appIds)
          : ScreenTime.blockAll();
      applyBlock.catch(() => {});

      startSession(
        {
          durationMinutes: occurrence.plan.durationMinutes,
          focusMode: occurrence.plan.focusMode,
          expectedGrowthCm: getGrowthForDuration(
            occurrence.plan.durationMinutes,
            occurrence.plan.focusMode
          ),
          planId: occurrence.plan.id,
          label: occurrence.plan.label,
        },
        occurrence.startsAt
      );
      notifyBlockStarted(occurrence.plan.label);
    };

    tick();
    const interval = setInterval(tick, SCHEDULE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [plans, activeSession, startSession, stopSession]);

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

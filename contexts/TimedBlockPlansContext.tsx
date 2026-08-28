import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { usePersistedState } from "@/lib/storage";
import { getGrowthForDuration, type FocusMode } from "@/constants/marshmallow";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { findActiveOccurrence, occurrenceKey } from "@/lib/timedBlockSchedule";
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

/** A plan run the user ended early, remembered until its window closes. */
interface DismissedOccurrence {
  key: string;
  /** When the run would have finished; the record is dropped after this. */
  endsAt: number;
}

interface TimedBlockPlansContextValue {
  plans: TimedBlockPlan[];
  /** Max plans this account may keep — `Infinity` on premium. */
  planLimit: number;
  /** False once the free-tier limit is reached; `addPlan` is a no-op then. */
  canAddPlan: boolean;
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
  const [rawPlans, setPlans, plansLoaded] = usePersistedState<TimedBlockPlan[]>("timedBlockPlans", []);
  const plans = useMemo(() => rawPlans.map(normalizePlan), [rawPlans]);
  const { timedBlockLimit } = useSubscription();

  const canAddPlan = plans.length < timedBlockLimit;

  const addPlan = useCallback(
    (plan: Omit<TimedBlockPlan, "id">) => {
      setPlans((prev) => {
        // Re-checked here rather than trusting the caller: this is the only
        // path that can create a plan, so the entitlement holds even if a
        // screen forgets to gate its own button.
        if (prev.length >= timedBlockLimit) return prev;
        return [
          { ...plan, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          ...prev,
        ];
      });
    },
    [setPlans, timedBlockLimit]
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

  const { activeSession, isSessionLoaded, startSession, stopSession } = useFocusSession();

  // Persisted so a stop survives the app being killed — otherwise relaunching
  // mid-window restarts the block the user just ended.
  const [dismissedOccurrences, setDismissedOccurrences, dismissalsLoaded] = usePersistedState<
    DismissedOccurrence[]
  >("timedBlockPlans.dismissedOccurrences", []);

  // Synchronous mirror of the above, keyed by occurrence -> endsAt. Reads go
  // through this, never through the state: recording a stop and the schedule
  // tick happen in the same commit, so the tick would still see the pre-stop
  // state and immediately restart the block the user just ended.
  const dismissedRef = useRef<Map<string, number>>(new Map());

  const prevSessionRef = useRef(activeSession);

  const isReady = plansLoaded && dismissalsLoaded && isSessionLoaded;

  // Declared first so the mirror is filled before any effect below reads it.
  useEffect(() => {
    if (!dismissalsLoaded) return;
    for (const dismissed of dismissedOccurrences) {
      dismissedRef.current.set(dismissed.key, dismissed.endsAt);
    }
  }, [dismissalsLoaded, dismissedOccurrences]);

  // Registers OS-level monitoring (TimedBlockMonitor extension) for every
  // enabled plan, so a scheduled block still starts/ends even if the app is
  // never opened at the scheduled time — the tick() loop below only runs
  // while this JS is alive. Re-registers wholesale on every plan change.
  useEffect(() => {
    if (!plansLoaded) return;
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
        durationMinutes: plan.durationMinutes,
        appIds: plan.appIds,
        expectedGrowthCm: getGrowthForDuration(plan.durationMinutes, plan.focusMode),
        focusMode: plan.focusMode,
      }));
    if (schedulable.length === 0) return;
    ScreenTime.scheduleTimedBlocks(schedulable).catch(() => {});
  }, [plans, plansLoaded]);

  // Drops dismissal records whose window has closed, so the set doesn't grow
  // without bound and the plan runs again at its next occurrence.
  useEffect(() => {
    if (!dismissalsLoaded) return;
    const prune = () => {
      const now = Date.now();
      for (const [key, endsAt] of dismissedRef.current) {
        if (endsAt <= now) dismissedRef.current.delete(key);
      }
      setDismissedOccurrences((prev) =>
        prev.some((d) => d.endsAt <= now) ? prev.filter((d) => d.endsAt > now) : prev
      );
    };
    prune();
    const interval = setInterval(prune, SCHEDULE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dismissalsLoaded, setDismissedOccurrences]);

  // Adopts a block the TimedBlockMonitor extension already started while the
  // app wasn't running, so the UI (timer, growth preview) reflects reality
  // instead of showing nothing blocked. Only ever fills in a *missing*
  // session — never overrides one the app already knows about.
  useEffect(() => {
    if (!isReady || activeSession) return;
    let cancelled = false;

    const adoptNativeBlock = () => {
      ScreenTime.getActiveNativeBlock().then((native) => {
        if (cancelled || !native) return;
        const plan = plans.find((p) => p.id === native.planId);
        if (!plan) return;

        // The user ended this run by hand; the extension's leftover state is
        // stale, so clear it rather than resurrecting the block.
        const occurrence = findActiveOccurrence(plans, Date.now());
        if (
          occurrence &&
          occurrence.plan.id === plan.id &&
          dismissedRef.current.has(occurrenceKey(plan.id, occurrence.startsAt))
        ) {
          ScreenTime.clearActiveNativeBlock().catch(() => {});
          ScreenTime.clearBlocking().catch(() => {});
          ScreenTime.endBlockLiveActivity().catch(() => {});
          return;
        }

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

    adoptNativeBlock();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") adoptNativeBlock();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isReady, activeSession, plans, startSession]);

  // Records the stop when a plan-driven session disappears mid-window.
  useEffect(() => {
    const prev = prevSessionRef.current;
    prevSessionRef.current = activeSession;
    if (!isReady || !prev?.planId || activeSession) return;

    const occurrence = findActiveOccurrence(plans, Date.now());
    if (!occurrence || occurrence.plan.id !== prev.planId) return;
    if (occurrence.startsAt !== prev.startedAt) return;

    const key = occurrenceKey(prev.planId, prev.startedAt);
    // Mirror first: the tick effect below runs later in this same commit.
    dismissedRef.current.set(key, occurrence.endsAt);
    setDismissedOccurrences((current) =>
      current.some((d) => d.key === key)
        ? current
        : [...current, { key, endsAt: occurrence.endsAt }]
    );
  }, [isReady, activeSession, plans, setDismissedOccurrences]);

  useEffect(() => {
    if (!isReady) return;

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
      if (dismissedRef.current.has(occurrenceKey(occurrence.plan.id, occurrence.startsAt))) return;

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
  }, [isReady, plans, activeSession, startSession, stopSession]);

  const value = useMemo(
    () => ({
      plans,
      planLimit: timedBlockLimit,
      canAddPlan,
      addPlan,
      updatePlan,
      removePlan,
      setPlanEnabled,
    }),
    [plans, timedBlockLimit, canAddPlan, addPlan, updatePlan, removePlan, setPlanEnabled]
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

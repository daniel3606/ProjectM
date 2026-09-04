import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import { usePersistedState } from "@/lib/storage";
import { estimateGrowthCm, type FocusMode } from "@/constants/marshmallow";
import { getBlockTypeForPlan } from "@/lib/growthModel";
import {
  useFocusSession,
  type ActiveSession,
  type FocusSessionConfig,
} from "@/contexts/FocusSessionContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  findActiveOccurrence,
  findPlanOccurrence,
  occurrenceKey,
  occurrenceRun,
  planSchedulesRun,
  type OccurrenceRun,
  type PlanOccurrence,
} from "@/lib/timedBlockSchedule";
import { notifyBlockStarted } from "@/lib/notifications";
import {
  scheduledBlockIsHard,
  scheduledBlockMode,
} from "@/lib/timedBlockPremium";
import * as ScreenTime from "@/modules/screen-time";
import type { BlockMode } from "@/modules/screen-time";

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
  /**
   * Marks a plan as covering sleep rather than focus. Sleep blocks still grow
   * the marshmallow, at a lower rate, because hours asleep are not hours of
   * deliberate focus. Absent on plans saved before the flag existed; those fall
   * back to a label check.
   */
  isSleep?: boolean;
  /**
   * Whether `appIds` lists what to block or the only things left open.
   * Allow Only is Premium; a free account's saved value is ignored at start.
   */
  blockMode?: BlockMode;
}

/** A plan run the user ended early, remembered until its window closes. */
interface DismissedOccurrence {
  key: string;
  /** When the run would have finished; the record is dropped after this. */
  endsAt: number;
}

interface TimedBlockPlansContextValue {
  plans: TimedBlockPlan[];
  /** Max plans this account may keep. */
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

/**
 * The session one run of a plan should start with. Everything time-based comes
 * from `run`, not from the plan: a window joined part-way through is a shorter
 * block and earns the growth of the minutes it actually blocks.
 */
function sessionConfigFromRun(
  occurrence: PlanOccurrence,
  run: OccurrenceRun,
  growthPreview: { streakDays: number; rawGrowthTodayCm: number },
  isPremium: boolean
): FocusSessionConfig {
  const { plan } = occurrence;
  const isHardMode = scheduledBlockIsHard(plan, isPremium);
  return {
    durationMinutes: run.durationMinutes,
    focusMode: isHardMode ? "deep" : "flexible",
    blockType: getBlockTypeForPlan(plan),
    expectedGrowthCm: estimateGrowthCm({
      minutes: run.durationMinutes,
      blockType: getBlockTypeForPlan(plan),
      isHardBlock: isHardMode,
      streakDays: growthPreview.streakDays,
      rawGrowthTodayCm: growthPreview.rawGrowthTodayCm,
    }),
    planId: plan.id,
    occurrenceStartsAt: occurrence.startsAt,
    label: plan.label,
    appIds: plan.appIds,
    blockMode: scheduledBlockMode(plan, isPremium),
    isHardMode,
  };
}

/**
 * Which scheduled run a session belongs to. Sessions saved before partial runs
 * existed pinned `startedAt` to the scheduled start, so fall back to it.
 */
function runOccurrenceStartsAt(session: ActiveSession): number {
  return session.occurrenceStartsAt ?? session.startedAt;
}

export function TimedBlockPlansProvider({ children }: { children: React.ReactNode }) {
  const [rawPlans, setPlans, plansLoaded] = usePersistedState<TimedBlockPlan[]>("timedBlockPlans", []);
  const plans = useMemo(() => rawPlans.map(normalizePlan), [rawPlans]);
  const { timedBlockLimit, isPremium } = useSubscription();

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

  const { activeSession, isSessionLoaded, startSession, stopSession, growthPreview } =
    useFocusSession();

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

  const setPlanEnabled = useCallback(
    (id: string, enabled: boolean) => {
      // Switching a plan back on asks for its current window again, so drop
      // the record of the run that switching it off ended. Without this the
      // plan would stay quiet until its next occurrence.
      if (enabled) {
        const prefix = `${id}-`;
        for (const key of dismissedRef.current.keys()) {
          if (key.startsWith(prefix)) dismissedRef.current.delete(key);
        }
        setDismissedOccurrences((current) =>
          current.filter((d) => !d.key.startsWith(prefix))
        );
      }
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, enabled } : p)));
    },
    [setDismissedOccurrences, setPlans]
  );

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
        expectedGrowthCm: estimateGrowthCm({
          minutes: plan.durationMinutes,
          blockType: getBlockTypeForPlan(plan),
          isHardBlock: scheduledBlockIsHard(plan, isPremium),
        }),
        focusMode: plan.focusMode,
        blockMode: scheduledBlockMode(plan, isPremium),
      }));
    // An empty list is a no-op on the native side, so the last plan being
    // turned off or deleted has to unregister explicitly. Otherwise iOS keeps
    // firing the extension and shielding apps for a plan that is switched off.
    if (schedulable.length === 0) {
      ScreenTime.clearScheduledBlocks().catch(() => {});
      return;
    }
    ScreenTime.scheduleTimedBlocks(schedulable).catch(() => {});
  }, [plans, plansLoaded, isPremium]);

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

        // Only adopt a run the schedule still agrees is happening. A plan the
        // user has since turned off, edited or deleted — or one whose window
        // has closed — leaves state behind that must be cleared, not revived;
        // so does a run the user ended by hand.
        const occurrence = findPlanOccurrence(plans, native.planId, Date.now());
        const run = occurrence && occurrenceRun(occurrence, native.startedAt);
        if (
          !occurrence ||
          !run ||
          dismissedRef.current.has(occurrenceKey(native.planId, occurrence.startsAt))
        ) {
          ScreenTime.clearActiveNativeBlock().catch(() => {});
          ScreenTime.clearBlocking().catch(() => {});
          ScreenTime.endBlockLiveActivity().catch(() => {});
          return;
        }

        // Re-apply blocking from the main app process — the extension's
        // ManagedSettingsStore may not have persisted across cold launch.
        ScreenTime.applyBlockMode(
          scheduledBlockMode(occurrence.plan, isPremium),
          occurrence.plan.appIds
        ).catch(() => {});

        startSession(
          sessionConfigFromRun(occurrence, run, growthPreview, isPremium),
          run.startedAt
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
  }, [isReady, activeSession, plans, startSession, growthPreview, isPremium]);

  // Records the stop when a plan-driven session disappears mid-window. Read off
  // the session, not the schedule: the usual reason a run ends early is its plan
  // being turned off or deleted, which erases the run from the schedule.
  useEffect(() => {
    const prev = prevSessionRef.current;
    prevSessionRef.current = activeSession;
    if (!isReady || !prev?.planId || activeSession) return;

    // A run that reached its end needs no record; its window is closed.
    const endsAt = prev.startedAt + prev.durationMinutes * 60_000;
    if (Date.now() >= endsAt) return;

    const key = occurrenceKey(prev.planId, runOccurrenceStartsAt(prev));
    // Mirror first: the tick effect below runs later in this same commit.
    dismissedRef.current.set(key, endsAt);
    setDismissedOccurrences((current) =>
      current.some((d) => d.key === key) ? current : [...current, { key, endsAt }]
    );
  }, [isReady, activeSession, setDismissedOccurrences]);

  useEffect(() => {
    if (!isReady) return;

    const tick = () => {
      const now = Date.now();

      if (activeSession?.planId) {
        // A running block owns its own clock; FocusSessionContext ends it when
        // it is up, and fires the "Block Ended" notification. The schedule only
        // cuts in when the plan behind the run is withdrawn — turned off,
        // deleted, or moved to another time — which ends it early and unpaid.
        const plan = plans.find((p) => p.id === activeSession.planId);
        if (!plan || !planSchedulesRun(plan, runOccurrenceStartsAt(activeSession))) {
          stopSession();
        }
        return;
      }

      // A manual (non-plan) focus session is running — never interrupt it.
      if (activeSession) return;

      const occurrence = findActiveOccurrence(plans, now);
      if (!occurrence) return;
      if (dismissedRef.current.has(occurrenceKey(occurrence.plan.id, occurrence.startsAt))) return;

      // Joining a window already under way runs only what is left of it, and
      // pays out only what that is worth. Under a minute left is not worth
      // starting at all.
      const run = occurrenceRun(occurrence, now);
      if (!run) return;

      ScreenTime.applyBlockMode(
        scheduledBlockMode(occurrence.plan, isPremium),
        occurrence.plan.appIds
      ).catch(() => {});

      startSession(sessionConfigFromRun(occurrence, run, growthPreview, isPremium), run.startedAt);
      notifyBlockStarted(occurrence.plan.label);
    };

    tick();
    const interval = setInterval(tick, SCHEDULE_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isReady, plans, activeSession, startSession, stopSession, growthPreview, isPremium]);

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

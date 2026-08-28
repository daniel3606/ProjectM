import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { usePersistedState } from "@/lib/storage";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useTimedBlockPlans } from "@/contexts/TimedBlockPlansContext";
import {
  baselineMinutesFromOnboarding,
  getUsageSource,
  mergeAttemptHistory,
  suggestGoalMinutes,
} from "@/lib/stats/sources";
import type {
  GoalSetting,
  PersonalBestRecord,
  ScheduleInput,
  SessionAttempt,
  StatsInput,
} from "@/lib/stats/types";

/**
 * How far back the usage source is asked to reach. Everything the screen can
 * show — including the Year period and lifetime reclaimed time — is derived
 * from this one pull, so the source is queried once rather than per section.
 */
const USAGE_LOOKBACK_DAYS = 400;

interface StatsContextValue {
  /**
   * Everything `computeStats` needs, already normalized. `now` is deliberately
   * not in here — callers pass their own so a screen can hold a stable clock
   * while the user scrolls.
   */
  input: Omit<StatsInput, "now">;
  isReady: boolean;
  /** Persists the user's daily screen-time target. */
  setGoalMinutes: (minutes: number) => void;
  /** Marks personal bests as seen, so their reveal doesn't replay. */
  acknowledgePersonalBests: (records: PersonalBestRecord[]) => void;
}

const StatsContext = createContext<StatsContextValue | null>(null);

function toScheduleInputs(
  plans: ReturnType<typeof useTimedBlockPlans>["plans"]
): ScheduleInput[] {
  return plans.map((plan) => ({
    id: plan.id,
    label: plan.label,
    daysOfWeek: plan.daysOfWeek,
    startHour: plan.startHour,
    startMinute: plan.startMinute,
    durationMinutes: plan.durationMinutes,
    enabled: plan.enabled,
  }));
}

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const { attempts, history, isSessionLoaded } = useFocusSession();
  const { onboardingScreenTime, isProfileReady } = useMarshmallowProfile();
  const { isPremium, isSubscriptionLoaded } = useSubscription();
  const { plans } = useTimedBlockPlans();

  const [goalMinutes, setStoredGoalMinutes, goalLoaded] = usePersistedState<number | null>(
    "stats.goalMinutes",
    null
  );
  const [personalBests, setPersonalBests, bestsLoaded] = usePersistedState<PersonalBestRecord[]>(
    "stats.personalBests",
    []
  );
  const [joinedAt, setJoinedAt, joinedLoaded] = usePersistedState<number | null>(
    "stats.joinedAt",
    null
  );

  // Stamped the first time Stats loads for an account that has no join date
  // yet, so lifetime totals have a floor for users who predate this screen.
  useEffect(() => {
    if (!joinedLoaded || joinedAt !== null) return;
    const earliestAttempt = attempts.reduce<number | null>(
      (min, a) => (min === null || a.startedAt < min ? a.startedAt : min),
      null
    );
    setJoinedAt(earliestAttempt ?? Date.now());
  }, [joinedLoaded, joinedAt, attempts, setJoinedAt]);

  const mergedAttempts: SessionAttempt[] = useMemo(
    () => mergeAttemptHistory(attempts, history),
    [attempts, history]
  );

  const baselineMinutesPerDay = useMemo(
    () => baselineMinutesFromOnboarding(onboardingScreenTime),
    [onboardingScreenTime]
  );

  const goal: GoalSetting | null = useMemo(() => {
    if (goalMinutes !== null) return { minutesPerDay: goalMinutes, suggested: false };
    return suggestGoalMinutes(baselineMinutesPerDay);
  }, [goalMinutes, baselineMinutesPerDay]);

  // The usage source is pulled once per render pass rather than memoized on a
  // timestamp: it is a synchronous read today, and pinning it to a clock would
  // make a live source go stale for as long as the screen stays open.
  const usage = useMemo(() => {
    const end = Date.now();
    const start = end - USAGE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
    return getUsageSource().getDailyUsage(start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedAttempts.length, isPremium]);

  const schedules = useMemo(() => toScheduleInputs(plans), [plans]);

  const input = useMemo<Omit<StatsInput, "now">>(
    () => ({
      attempts: mergedAttempts,
      usage,
      baselineMinutesPerDay,
      goal,
      joinedAt,
      schedules,
      personalBests,
      isPremium,
    }),
    [
      mergedAttempts,
      usage,
      baselineMinutesPerDay,
      goal,
      joinedAt,
      schedules,
      personalBests,
      isPremium,
    ]
  );

  const setGoalMinutes = useCallback(
    (minutes: number) => setStoredGoalMinutes(Math.max(15, Math.round(minutes))),
    [setStoredGoalMinutes]
  );

  const acknowledgePersonalBests = useCallback(
    (records: PersonalBestRecord[]) => setPersonalBests(records),
    [setPersonalBests]
  );

  const value = useMemo(
    () => ({
      input,
      isReady:
        isSessionLoaded &&
        isProfileReady &&
        isSubscriptionLoaded &&
        goalLoaded &&
        bestsLoaded &&
        joinedLoaded,
      setGoalMinutes,
      acknowledgePersonalBests,
    }),
    [
      input,
      isSessionLoaded,
      isProfileReady,
      isSubscriptionLoaded,
      goalLoaded,
      bestsLoaded,
      joinedLoaded,
      setGoalMinutes,
      acknowledgePersonalBests,
    ]
  );

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>;
}

export function useStatsData() {
  const ctx = useContext(StatsContext);
  if (!ctx) {
    throw new Error("useStatsData must be used within a StatsProvider");
  }
  return ctx;
}

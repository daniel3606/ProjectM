import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { findSchedulePreset, type SchedulePresetId } from "@/constants/onboarding";
import { useAuth } from "@/contexts/AuthContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useTimedBlockPlans } from "@/contexts/TimedBlockPlansContext";
import { track } from "@/lib/analytics";
import {
  computeReclaimedTime,
  maxTargetMinutes,
  MIN_CURRENT_MINUTES,
  snapScreenTime,
  type ReclaimedTime,
} from "@/lib/onboardingTime";
import { clampScheduleShift, planFromPreset } from "@/lib/onboardingSchedule";
import {
  furthestStep,
  isOnboardingStep,
  stepIndex,
  type OnboardingStepId,
} from "@/lib/onboardingSteps";
import { usePersistedState } from "@/lib/storage";
import * as ScreenTime from "@/modules/screen-time";
import type { AuthorizationStatus, ScreenTimeItem } from "@/modules/screen-time";

interface OnboardingContextValue {
  /** False until persisted answers have loaded; screens shouldn't render inputs before this. */
  isReady: boolean;

  goalIds: string[];
  currentScreenTimeMinutes: number | null;
  targetScreenTimeMinutes: number | null;
  /** Derived from current/target; null until both are set. */
  reclaimedTime: ReclaimedTime | null;

  distractingApps: ScreenTimeItem[];
  screenTimePermission: AuthorizationStatus;

  schedulePresetId: SchedulePresetId | null;
  /** Minutes the chosen preset's window was nudged by, positive = later. */
  scheduleShiftMinutes: number;

  isAuthenticated: boolean;
  isCompleted: boolean;
  hasStartedFirstFocusSession: boolean;

  /** Furthest step reached, used to resume a flow the user closed part-way through. */
  resumeStep: OnboardingStepId | null;
  /** True once the intro's opening sequence has played, so it isn't re-paced on a revisit. */
  hasSeenIntro: boolean;
  hasSeenGrowthExplainer: boolean;

  markStepViewed: (step: OnboardingStepId) => void;
  markIntroSeen: () => void;
  toggleGoal: (goalId: string) => void;
  setCurrentScreenTime: (minutes: number) => void;
  setTargetScreenTime: (minutes: number) => void;
  markReclaimedTimeViewed: () => void;
  markGrowthExplainerSeen: () => void;
  markCustomizationCompleted: () => void;

  requestScreenTimePermission: () => Promise<boolean>;
  setDistractingApps: (apps: ScreenTimeItem[]) => void;

  chooseSchedulePreset: (presetId: SchedulePresetId) => void;
  adjustScheduleShift: (deltaMinutes: number) => void;
  /** Writes the chosen preset as a real Timed Block plan. No-op when nothing is chosen. */
  saveSchedule: () => void;
  skipSchedule: (reason: "explicit" | "custom") => void;

  completeOnboarding: () => Promise<void>;
  markFirstFocusSessionStarted: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { status: authStatus } = useAuth();
  const profile = useMarshmallowProfile();
  const { addPlan } = useTimedBlockPlans();

  const [goalIds, setGoalIds, goalsLoaded] = usePersistedState<string[]>(
    "onboarding.goals",
    []
  );
  const [currentMinutes, setCurrentMinutes, currentLoaded] = usePersistedState<
    number | null
  >("onboarding.currentMinutes", null);
  const [targetMinutes, setTargetMinutes, targetLoaded] = usePersistedState<number | null>(
    "onboarding.targetMinutes",
    null
  );
  const [schedulePresetId, setSchedulePresetId] = usePersistedState<SchedulePresetId | null>(
    "onboarding.schedulePreset",
    null
  );
  const [scheduleShiftMinutes, setScheduleShiftMinutes] = usePersistedState(
    "onboarding.scheduleShift",
    0
  );
  const [rawResumeStep, setResumeStep, resumeLoaded] = usePersistedState<string | null>(
    "onboarding.resumeStep",
    null
  );
  const [hasSeenIntro, setHasSeenIntro] = usePersistedState("onboarding.seenIntro", false);
  const [hasSeenGrowthExplainer, setHasSeenGrowthExplainer] = usePersistedState(
    "onboarding.seenGrowthExplainer",
    false
  );
  const [hasStartedFirstFocusSession, setHasStartedFirstFocusSession] = usePersistedState(
    "onboarding.firstFocusSessionStarted",
    false
  );

  // The OS owns permission state, so it's read rather than stored — a user who
  // revokes access in Settings must not leave us claiming it's still granted.
  const [screenTimePermission, setScreenTimePermission] = useState<AuthorizationStatus>(
    () => ScreenTime.getAuthorizationStatus()
  );

  const resumeStep = isOnboardingStep(rawResumeStep) ? rawResumeStep : null;
  const isReady =
    goalsLoaded && currentLoaded && targetLoaded && resumeLoaded && profile.isProfileReady;

  const reclaimedTime = useMemo(
    () =>
      currentMinutes !== null && targetMinutes !== null
        ? computeReclaimedTime(currentMinutes, targetMinutes)
        : null,
    [currentMinutes, targetMinutes]
  );

  // One `onboarding_started` per flow, not per intro render. A resume point
  // that already exists means the flow started on an earlier launch, and that
  // launch's abandonment is worth reporting on its own.
  const startReportedRef = useRef(false);
  useEffect(() => {
    if (!isReady || startReportedRef.current || profile.onboardingCompleted) return;
    startReportedRef.current = true;

    if (resumeStep) {
      track("onboarding_abandoned", {
        step: resumeStep,
        step_index: stepIndex(resumeStep),
        resumed: true,
      });
      return;
    }
    track("onboarding_started");
  }, [isReady, profile.onboardingCompleted, resumeStep]);

  const markStepViewed = useCallback(
    (step: OnboardingStepId) => {
      track("onboarding_step_viewed", { step, step_index: stepIndex(step) });
      setResumeStep((previous) =>
        furthestStep(isOnboardingStep(previous) ? previous : null, step)
      );
    },
    [setResumeStep]
  );

  const toggleGoal = useCallback(
    (goalId: string) => {
      setGoalIds((previous) => {
        const next = previous.includes(goalId)
          ? previous.filter((id) => id !== goalId)
          : [...previous, goalId];
        track("onboarding_goal_selected", {
          goal: goalId,
          selected: !previous.includes(goalId),
          total_selected: next.length,
        });
        return next;
      });
    },
    [setGoalIds]
  );

  const setCurrentScreenTime = useCallback(
    (minutes: number) => {
      // Clamped here rather than only in the slider, so a value restored from an
      // older build can't land on the floor and leave nothing to reclaim.
      const snapped = Math.max(MIN_CURRENT_MINUTES, snapScreenTime(minutes));
      setCurrentMinutes(snapped);
      // A goal above the new current usage would reclaim nothing, so pull it
      // back into range instead of letting the next screen open on a
      // contradiction.
      setTargetMinutes((previousTarget) =>
        previousTarget === null
          ? null
          : Math.min(previousTarget, maxTargetMinutes(snapped))
      );
    },
    [setCurrentMinutes, setTargetMinutes]
  );

  const setTargetScreenTime = useCallback(
    (minutes: number) => {
      const ceiling = currentMinutes === null ? minutes : maxTargetMinutes(currentMinutes);
      setTargetMinutes(Math.min(snapScreenTime(minutes), ceiling));
    },
    [currentMinutes, setTargetMinutes]
  );

  const markReclaimedTimeViewed = useCallback(() => {
    if (!reclaimedTime) return;
    track("onboarding_reclaimed_time_viewed", {
      daily_minutes: reclaimedTime.dailyMinutes,
      weekly_minutes: reclaimedTime.weeklyMinutes,
    });
  }, [reclaimedTime]);

  const markIntroSeen = useCallback(() => {
    setHasSeenIntro(true);
  }, [setHasSeenIntro]);

  const markGrowthExplainerSeen = useCallback(() => {
    setHasSeenGrowthExplainer(true);
    track("onboarding_growth_explainer_viewed");
  }, [setHasSeenGrowthExplainer]);

  const markCustomizationCompleted = useCallback(() => {
    track("onboarding_customization_completed", {
      color: profile.color,
      named: profile.name.trim().length > 0,
      accessories: Object.keys(profile.items).length,
    });
  }, [profile.color, profile.items, profile.name]);

  const requestScreenTimePermission = useCallback(async () => {
    track("screentime_permission_requested");

    if (!ScreenTime.isAvailable()) {
      setScreenTimePermission("unavailable");
      track("screentime_permission_denied", { reason: "unavailable" });
      return false;
    }

    try {
      const granted = await ScreenTime.requestAuthorization();
      const status = ScreenTime.getAuthorizationStatus();
      setScreenTimePermission(status);
      track(granted ? "screentime_permission_granted" : "screentime_permission_denied", {
        status,
      });
      return granted;
    } catch {
      setScreenTimePermission(ScreenTime.getAuthorizationStatus());
      track("screentime_permission_denied", { reason: "error" });
      return false;
    }
  }, []);

  const setDistractingApps = useCallback(
    (apps: ScreenTimeItem[]) => {
      profile.setDistractingApps(apps);
      // Counts only. Which apps a person struggles with is not our business to
      // report, and isn't needed to understand the funnel.
      track("distracting_apps_selected", {
        app_count: apps.filter((app) => app.type === "application").length,
        category_count: apps.filter((app) => app.type === "category").length,
        web_count: apps.filter((app) => app.type === "webDomain").length,
      });
    },
    [profile]
  );

  const chooseSchedulePreset = useCallback(
    (presetId: SchedulePresetId) => {
      setSchedulePresetId(presetId);
      setScheduleShiftMinutes(0);
    },
    [setSchedulePresetId, setScheduleShiftMinutes]
  );

  const adjustScheduleShift = useCallback(
    (deltaMinutes: number) => {
      setScheduleShiftMinutes((previous) => clampScheduleShift(previous + deltaMinutes));
    },
    [setScheduleShiftMinutes]
  );

  const saveSchedule = useCallback(() => {
    if (!schedulePresetId) return;
    const preset = findSchedulePreset(schedulePresetId);
    if (!preset) return;

    addPlan(planFromPreset(preset, scheduleShiftMinutes, profile.distractingApps));
    track("schedule_created_from_onboarding", {
      preset: preset.id,
      shift_minutes: scheduleShiftMinutes,
    });
  }, [addPlan, profile.distractingApps, schedulePresetId, scheduleShiftMinutes]);

  const skipSchedule = useCallback(
    (reason: "explicit" | "custom") => {
      setSchedulePresetId(null);
      setScheduleShiftMinutes(0);
      track("schedule_skipped", { reason });
    },
    [setSchedulePresetId, setScheduleShiftMinutes]
  );

  const completeOnboarding = useCallback(async () => {
    track("onboarding_completed", {
      goal_count: goalIds.length,
      current_minutes: currentMinutes,
      target_minutes: targetMinutes,
      reclaimed_minutes: reclaimedTime?.dailyMinutes ?? null,
      schedule_preset: schedulePresetId,
      screentime_permission: screenTimePermission,
      authenticated: authStatus === "authenticated",
    });

    setResumeStep(null);
    await profile.completeOnboarding({
      goals: goalIds,
      currentScreenTimeMinutes: currentMinutes,
      targetScreenTimeMinutes: targetMinutes,
    });
  }, [
    authStatus,
    currentMinutes,
    goalIds,
    profile,
    reclaimedTime,
    schedulePresetId,
    screenTimePermission,
    setResumeStep,
    targetMinutes,
  ]);

  const markFirstFocusSessionStarted = useCallback(() => {
    if (hasStartedFirstFocusSession) return;
    setHasStartedFirstFocusSession(true);
    track("first_focus_session_started");
  }, [hasStartedFirstFocusSession, setHasStartedFirstFocusSession]);

  const value = useMemo(
    () => ({
      isReady,
      goalIds,
      currentScreenTimeMinutes: currentMinutes,
      targetScreenTimeMinutes: targetMinutes,
      reclaimedTime,
      distractingApps: profile.distractingApps,
      screenTimePermission,
      schedulePresetId,
      scheduleShiftMinutes,
      isAuthenticated: authStatus === "authenticated",
      isCompleted: profile.onboardingCompleted,
      hasStartedFirstFocusSession,
      resumeStep,
      hasSeenIntro,
      hasSeenGrowthExplainer,
      markStepViewed,
      markIntroSeen,
      toggleGoal,
      setCurrentScreenTime,
      setTargetScreenTime,
      markReclaimedTimeViewed,
      markGrowthExplainerSeen,
      markCustomizationCompleted,
      requestScreenTimePermission,
      setDistractingApps,
      chooseSchedulePreset,
      adjustScheduleShift,
      saveSchedule,
      skipSchedule,
      completeOnboarding,
      markFirstFocusSessionStarted,
    }),
    [
      isReady,
      goalIds,
      currentMinutes,
      targetMinutes,
      reclaimedTime,
      profile.distractingApps,
      profile.onboardingCompleted,
      screenTimePermission,
      schedulePresetId,
      scheduleShiftMinutes,
      authStatus,
      hasStartedFirstFocusSession,
      resumeStep,
      hasSeenIntro,
      hasSeenGrowthExplainer,
      markStepViewed,
      markIntroSeen,
      toggleGoal,
      setCurrentScreenTime,
      setTargetScreenTime,
      markReclaimedTimeViewed,
      markGrowthExplainerSeen,
      markCustomizationCompleted,
      requestScreenTimePermission,
      setDistractingApps,
      chooseSchedulePreset,
      adjustScheduleShift,
      saveSchedule,
      skipSchedule,
      completeOnboarding,
      markFirstFocusSessionStarted,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}

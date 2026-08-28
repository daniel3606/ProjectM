import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  nextStep,
  onboardingRoute,
  previousStep,
  stepProgress,
  type OnboardingStepId,
} from "@/lib/onboardingSteps";

interface OnboardingStepControls {
  /** 0–1, for the layout's progress bar. */
  progress: number;
  /** Advances to whatever step follows this one in the flow order. */
  goNext: () => void;
  /** Undefined on the first step, so the layout simply omits the back affordance. */
  goBack?: () => void;
}

/**
 * Wires a screen into the flow: reports the view once, resolves its progress,
 * and hands back navigation that follows the order in `onboardingSteps` rather
 * than a route hard-coded in the screen.
 */
export function useOnboardingStep(step: OnboardingStepId): OnboardingStepControls {
  const router = useRouter();
  const { markStepViewed } = useOnboarding();
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    markStepViewed(step);
  }, [markStepViewed, step]);

  const goNext = useCallback(() => {
    const next = nextStep(step);
    if (next) router.push(onboardingRoute(next));
  }, [router, step]);

  const previous = previousStep(step);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Resuming a saved flow lands here without history behind it.
    if (previous) router.replace(onboardingRoute(previous));
  }, [previous, router]);

  return {
    progress: stepProgress(step),
    goBack: previous ? goBack : undefined,
    goNext,
  };
}

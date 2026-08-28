/**
 * The onboarding running order, in one place.
 *
 * Screens read their neighbours from here rather than hard-coding the next
 * route, so resequencing the flow is an edit to this array. Progress, resume
 * and drop-off reporting are all derived from the same list.
 */

export const ONBOARDING_STEPS = [
  "intro",
  "goal",
  "age",
  "current-time",
  "target-time",
  "reclaimed",
  "how-it-works",
  "customize",
  "apps",
  "schedule",
  "ready",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

const ROUTES = {
  intro: "/onboarding",
  goal: "/onboarding/goal",
  age: "/onboarding/age",
  "current-time": "/onboarding/current-time",
  "target-time": "/onboarding/target-time",
  reclaimed: "/onboarding/reclaimed",
  "how-it-works": "/onboarding/how-it-works",
  customize: "/onboarding/customize",
  apps: "/onboarding/apps",
  schedule: "/onboarding/schedule",
  ready: "/onboarding/ready",
} as const satisfies Record<OnboardingStepId, string>;

export type OnboardingRoute = (typeof ROUTES)[OnboardingStepId];

/**
 * The last step that asks the user for something. The progress bar fills to
 * exactly here, so reaching the final question reads as "the setup is done"
 * rather than leaving a stub of bar behind.
 */
const FINAL_INPUT_STEP: OnboardingStepId = "schedule";

export function onboardingRoute(step: OnboardingStepId): OnboardingRoute {
  return ROUTES[step];
}

export function stepIndex(step: OnboardingStepId): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function isOnboardingStep(value: unknown): value is OnboardingStepId {
  return (
    typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value)
  );
}

export function nextStep(step: OnboardingStepId): OnboardingStepId | null {
  return ONBOARDING_STEPS[stepIndex(step) + 1] ?? null;
}

export function previousStep(step: OnboardingStepId): OnboardingStepId | null {
  const index = stepIndex(step);
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}

/** 0 on the intro, 1 by the time the user reaches account creation. */
export function stepProgress(step: OnboardingStepId): number {
  const span = stepIndex(FINAL_INPUT_STEP);
  return Math.min(1, stepIndex(step) / span);
}

/**
 * Whichever of the two steps comes later in the flow. Used to keep the
 * resume point monotonic when a user walks back to change an answer.
 */
export function furthestStep(
  a: OnboardingStepId | null,
  b: OnboardingStepId
): OnboardingStepId {
  if (!a) return b;
  return stepIndex(a) >= stepIndex(b) ? a : b;
}

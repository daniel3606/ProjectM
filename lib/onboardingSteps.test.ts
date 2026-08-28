/** @jest-environment node */

import {
  furthestStep,
  isOnboardingStep,
  nextStep,
  onboardingRoute,
  ONBOARDING_STEPS,
  previousStep,
  stepProgress,
} from "@/lib/onboardingSteps";

describe("flow order", () => {
  it("walks forwards and backwards through the running order", () => {
    expect(nextStep("intro")).toBe("goal");
    expect(previousStep("goal")).toBe("intro");
    expect(previousStep("intro")).toBeNull();
    expect(nextStep("ready")).toBeNull();
  });

  it("chains every step to the next without a gap", () => {
    ONBOARDING_STEPS.forEach((step, index) => {
      expect(nextStep(step)).toBe(ONBOARDING_STEPS[index + 1] ?? null);
    });
  });

  it("gives every step a route", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(onboardingRoute(step)).toMatch(/^\/onboarding/);
    }
  });
});

describe("progress", () => {
  it("runs from empty on the intro to full once setup is done", () => {
    expect(stepProgress("intro")).toBe(0);
    expect(stepProgress("schedule")).toBe(1);
    expect(stepProgress("ready")).toBe(1);
  });

  it("advances monotonically", () => {
    const values = ONBOARDING_STEPS.map(stepProgress);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe("resume point", () => {
  it("keeps the furthest step when the user walks back to change an answer", () => {
    expect(furthestStep("customize", "goal")).toBe("customize");
    expect(furthestStep("goal", "customize")).toBe("customize");
    expect(furthestStep(null, "intro")).toBe("intro");
  });

  it("rejects stored values that are no longer steps", () => {
    expect(isOnboardingStep("goal")).toBe(true);
    expect(isOnboardingStep("onboarding-purpose")).toBe(false);
    expect(isOnboardingStep(null)).toBe(false);
  });
});

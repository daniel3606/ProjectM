/** @jest-environment node */

import {
  resetAnalytics,
  setAnalyticsTransport,
  track,
  type AnalyticsEvent,
} from "@/lib/analytics";

describe("analytics", () => {
  beforeEach(() => {
    resetAnalytics();
  });

  it("replays events fired before a transport exists, in order", () => {
    track("onboarding_started");
    track("onboarding_step_viewed", { step: "goal" });

    const received: AnalyticsEvent[] = [];
    setAnalyticsTransport((event) => received.push(event));

    expect(received.map((event) => event.name)).toEqual([
      "onboarding_started",
      "onboarding_step_viewed",
    ]);
    expect(received[1].props).toEqual({ step: "goal" });
  });

  it("delivers straight through once a transport is installed", () => {
    const received: AnalyticsEvent[] = [];
    setAnalyticsTransport((event) => received.push(event));

    track("onboarding_completed");

    expect(received).toHaveLength(1);
    expect(received[0].timestamp).toBeGreaterThan(0);
  });

  it("delivers each event only once", () => {
    track("onboarding_started");
    const received: AnalyticsEvent[] = [];
    setAnalyticsTransport((event) => received.push(event));
    setAnalyticsTransport((event) => received.push(event));

    expect(received).toHaveLength(1);
  });

  it("survives a transport that throws", () => {
    setAnalyticsTransport(() => {
      throw new Error("network down");
    });

    expect(() => track("first_focus_session_started")).not.toThrow();
  });
});

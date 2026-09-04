/** @jest-environment node */

import {
  applyOverrides,
  EMPTY_OVERRIDES,
  isDistracting,
  setDistracting,
} from "@/lib/stats/distractingApps";
import type { DailyUsageSample } from "@/lib/stats/types";

function sample(): DailyUsageSample {
  return {
    day: 0,
    totalMinutes: 90,
    apps: [
      { appId: "youtube", label: "YouTube", minutes: 60, distracting: false },
      { appId: "tiktok", label: "TikTok", minutes: 30, distracting: true },
    ],
  };
}

describe("setDistracting", () => {
  it("flags an app the source didn't", () => {
    const next = setDistracting(EMPTY_OVERRIDES, "youtube", true);

    expect(next.added).toEqual(["youtube"]);
    expect(isDistracting(next, "youtube", false)).toBe(true);
  });

  it("unflagging survives a source that keeps calling the app distracting", () => {
    const next = setDistracting(EMPTY_OVERRIDES, "tiktok", false);

    expect(next.removed).toEqual(["tiktok"]);
    expect(isDistracting(next, "tiktok", true)).toBe(false);
  });

  it("never leaves an app in both lists when the user changes their mind", () => {
    const added = setDistracting(EMPTY_OVERRIDES, "youtube", true);
    const removed = setDistracting(added, "youtube", false);
    const readded = setDistracting(removed, "youtube", true);

    expect(removed.added).toEqual([]);
    expect(removed.removed).toEqual(["youtube"]);
    expect(readded.added).toEqual(["youtube"]);
    expect(readded.removed).toEqual([]);
  });

  it("flagging the same app twice doesn't duplicate it", () => {
    const once = setDistracting(EMPTY_OVERRIDES, "youtube", true);

    expect(setDistracting(once, "youtube", true).added).toEqual(["youtube"]);
  });

  it("defers to the source for an app the user has never touched", () => {
    expect(isDistracting(EMPTY_OVERRIDES, "tiktok", true)).toBe(true);
    expect(isDistracting(EMPTY_OVERRIDES, "youtube", false)).toBe(false);
  });
});

describe("applyOverrides", () => {
  it("resolves every sample against the user's list", () => {
    const overrides = setDistracting(
      setDistracting(EMPTY_OVERRIDES, "youtube", true),
      "tiktok",
      false
    );
    const [applied] = applyOverrides([sample()], overrides)!;

    expect(applied.apps[0].distracting).toBe(true);
    expect(applied.apps[1].distracting).toBe(false);
  });

  it("hands back the same array when the user has flagged nothing", () => {
    const usage = [sample()];

    expect(applyOverrides(usage, EMPTY_OVERRIDES)).toBe(usage);
  });

  it("keeps no-source as null rather than turning it into an empty list", () => {
    expect(applyOverrides(null, setDistracting(EMPTY_OVERRIDES, "a", true))).toBeNull();
  });

  it("leaves the samples it was given untouched", () => {
    const usage = [sample()];
    applyOverrides(usage, setDistracting(EMPTY_OVERRIDES, "youtube", true));

    expect(usage[0].apps[0].distracting).toBe(false);
  });
});

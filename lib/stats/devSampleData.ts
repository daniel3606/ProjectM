import { addDays, startOfDay } from "./time";
import { setUsageSource, type UsageSource } from "./sources";
import type { DailyUsageSample } from "./types";

/**
 * Synthetic usage for working on the Stats UI before a real screen-time source
 * exists. The numbers are invented.
 *
 * Off by default, no caller in the app, and `enableDevSampleUsage` is a no-op
 * outside `__DEV__`, so it cannot reach a shipped build.
 */

const APPS = [
  { appId: "tiktok", label: "TikTok", distracting: true, weight: 0.34 },
  { appId: "instagram", label: "Instagram", distracting: true, weight: 0.25 },
  { appId: "youtube", label: "YouTube", distracting: true, weight: 0.18 },
  { appId: "x", label: "X", distracting: true, weight: 0.09 },
  { appId: "reddit", label: "Reddit", distracting: true, weight: 0.06 },
  { appId: "messages", label: "Messages", distracting: false, weight: 0.08 },
];

/** Deterministic so the sample screen doesn't reshuffle on every reload. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function hourlyShape(dayIndex: number, distractingMinutes: number): number[] {
  // Weighted towards late evening, which is what makes the "protect your
  // evenings" recommendation appear in dev.
  const weights = Array.from({ length: 24 }, (_, h) => {
    if (h < 7) return 0.1;
    if (h < 12) return 0.5;
    if (h < 18) return 0.8;
    if (h < 22) return 1.6;
    return 2.4;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  return weights.map((w, h) =>
    Math.round((w / total) * distractingMinutes * (0.85 + pseudoRandom(dayIndex * 24 + h) * 0.3))
  );
}

export function buildSampleUsage(days: number, now: number = Date.now()): DailyUsageSample[] {
  const today = startOfDay(now);
  const samples: DailyUsageSample[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    // A gentle downward trend, plus day-to-day variation.
    const trend = 380 - (days - i) * 1.6;
    const total = Math.round(trend * (0.82 + pseudoRandom(i) * 0.36));
    const distracting = Math.round(total * 0.62);

    samples.push({
      day,
      totalMinutes: total,
      apps: APPS.map((app) => ({
        appId: app.appId,
        label: app.label,
        distracting: app.distracting,
        minutes: Math.round(total * app.weight * (0.8 + pseudoRandom(i * 7 + app.weight) * 0.4)),
      })),
      hourlyDistractingMinutes: hourlyShape(i, distracting),
    });
  }

  return samples;
}

/** Development only. Returns false (and does nothing) in a release build. */
export function enableDevSampleUsage(days: number = 120): boolean {
  if (!__DEV__) return false;

  const source: UsageSource = {
    getDailyUsage: (start, end) =>
      buildSampleUsage(days).filter((s) => s.day >= start && s.day < end),
  };
  setUsageSource(source);
  return true;
}

export function disableDevSampleUsage(): void {
  if (!__DEV__) return;
  setUsageSource(null);
}

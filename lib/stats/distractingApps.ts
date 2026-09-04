import type { DailyUsageSample } from "./types";

/**
 * The apps the user has flagged from the App Usage list.
 *
 * A usage source reports its own guess at what is distracting, but the user's
 * answer is the one that counts, so their list is stored separately and laid
 * over every sample before anything is computed. Removals are stored too:
 * unflagging an app the source calls distracting has to survive the next pull.
 */
export interface DistractingOverrides {
  added: string[];
  removed: string[];
}

export const EMPTY_OVERRIDES: DistractingOverrides = { added: [], removed: [] };

function without(ids: string[], appId: string): string[] {
  return ids.filter((id) => id !== appId);
}

function withId(ids: string[], appId: string): string[] {
  return ids.includes(appId) ? ids : [...ids, appId];
}

/** Flagging and unflagging are exclusive — an app is never in both lists. */
export function setDistracting(
  overrides: DistractingOverrides,
  appId: string,
  distracting: boolean
): DistractingOverrides {
  return distracting
    ? { added: withId(overrides.added, appId), removed: without(overrides.removed, appId) }
    : { added: without(overrides.added, appId), removed: withId(overrides.removed, appId) };
}

export function isDistracting(
  overrides: DistractingOverrides,
  appId: string,
  fromSource: boolean
): boolean {
  if (overrides.added.includes(appId)) return true;
  if (overrides.removed.includes(appId)) return false;
  return fromSource;
}

/**
 * Returns the same samples with `distracting` resolved against the user's
 * list. The original array is handed straight back when nothing is flagged, so
 * the common case adds no work and no new references for memos to chase.
 */
export function applyOverrides(
  usage: DailyUsageSample[] | null,
  overrides: DistractingOverrides
): DailyUsageSample[] | null {
  if (usage === null) return null;
  if (overrides.added.length === 0 && overrides.removed.length === 0) return usage;

  return usage.map((sample) => ({
    ...sample,
    apps: sample.apps.map((app) => ({
      ...app,
      distracting: isDistracting(overrides, app.appId, app.distracting),
    })),
  }));
}

/** Static content for the onboarding flow: what we ask, and what we offer. */

export interface OnboardingGoal {
  id: string;
  label: string;
}

/** Screen 2. Multi-select — most people are trying to fix more than one thing. */
export const ONBOARDING_GOALS: readonly OnboardingGoal[] = [
  { id: "doomscrolling", label: "Stop doomscrolling" },
  { id: "study", label: "Study better" },
  { id: "work", label: "Get more work done" },
  { id: "present", label: "Be more present" },
  { id: "bedtime", label: "Use my phone less before bed" },
] as const;

export type AgeRangeId = "under-18" | "18-24" | "25-34" | "35-44" | "45-54" | "55-plus";

export interface AgeRange {
  id: AgeRangeId;
  label: string;
  /**
   * The age we do the arithmetic from. A band is a range, and the middle of it
   * is the only defensible single number to take out of one — the edges would
   * flatter or scare whoever sits at the other end.
   */
  midpointAge: number;
}

/**
 * Screen 3. Asked for one reason: a phone habit costs a 20-year-old far more
 * of their life than it costs a 60-year-old, and quoting them the same figure
 * would make both of them wrong.
 */
export const AGE_RANGES: readonly AgeRange[] = [
  { id: "under-18", label: "Under 18", midpointAge: 16 },
  { id: "18-24", label: "18 to 24", midpointAge: 21 },
  { id: "25-34", label: "25 to 34", midpointAge: 30 },
  { id: "35-44", label: "35 to 44", midpointAge: 40 },
  { id: "45-54", label: "45 to 54", midpointAge: 50 },
  { id: "55-plus", label: "55 or over", midpointAge: 62 },
] as const;

export function findAgeRange(id: string | null): AgeRange | undefined {
  return AGE_RANGES.find((range) => range.id === id);
}

/**
 * Screen 8. A single app is easy to give up and proves nothing; the habit
 * lives across a handful of them. Asking for five up front means the first
 * Focus Session actually meets resistance, which is the point of it.
 */
export const MIN_DISTRACTING_APPS = 5;

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export type SchedulePresetId = "study" | "work" | "bedtime";

export interface SchedulePreset {
  id: SchedulePresetId;
  label: string;
  daysOfWeek: number[];
  /** Minutes since midnight. Windows may run past midnight; duration carries them over. */
  startMinuteOfDay: number;
  durationMinutes: number;
}

/**
 * Screen 9. Three windows that cover the situations people actually name,
 * each saved as a single scheduled block. Anything beyond this belongs in the
 * full Timed Block screen.
 */
export const SCHEDULE_PRESETS: readonly SchedulePreset[] = [
  {
    id: "study",
    label: "Study",
    daysOfWeek: WEEKDAYS,
    startMinuteOfDay: 19 * 60,
    durationMinutes: 3 * 60,
  },
  {
    id: "work",
    label: "Work",
    daysOfWeek: WEEKDAYS,
    startMinuteOfDay: 9 * 60,
    durationMinutes: 8 * 60,
  },
  {
    id: "bedtime",
    label: "Bedtime",
    daysOfWeek: EVERY_DAY,
    startMinuteOfDay: 23 * 60,
    durationMinutes: 8 * 60,
  },
] as const;

export function findSchedulePreset(id: SchedulePresetId): SchedulePreset | undefined {
  return SCHEDULE_PRESETS.find((preset) => preset.id === id);
}

/** How far a preset's window can be nudged in either direction, and by how much. */
export const SCHEDULE_SHIFT_STEP_MINUTES = 30;
export const SCHEDULE_SHIFT_LIMIT_MINUTES = 180;

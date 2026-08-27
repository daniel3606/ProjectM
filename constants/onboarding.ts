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

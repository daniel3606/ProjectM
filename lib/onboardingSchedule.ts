import {
  SCHEDULE_SHIFT_LIMIT_MINUTES,
  type SchedulePreset,
} from "@/constants/onboarding";
import { formatClockTime } from "@/constants/marshmallow";
import type { TimedBlockPlan } from "@/contexts/TimedBlockPlansContext";
import type { ScreenTimeItem } from "@/modules/screen-time";

const MINUTES_PER_DAY = 24 * 60;

function wrapMinuteOfDay(minuteOfDay: number): number {
  return ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function clampScheduleShift(shiftMinutes: number): number {
  return Math.min(
    SCHEDULE_SHIFT_LIMIT_MINUTES,
    Math.max(-SCHEDULE_SHIFT_LIMIT_MINUTES, shiftMinutes)
  );
}

function splitMinuteOfDay(minuteOfDay: number): { hour: number; minute: number } {
  const wrapped = wrapMinuteOfDay(minuteOfDay);
  return { hour: Math.floor(wrapped / 60), minute: wrapped % 60 };
}

/** "Weekdays" / "Every day" / "Mon, Wed" — the shortest true description. */
export function describeDays(daysOfWeek: number[]): string {
  const sorted = [...daysOfWeek].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "0,6") return "Weekends";

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return sorted.map((day) => labels[day]).join(", ");
}

/** "7:00 PM – 10:00 PM", with `shiftMinutes` applied to both ends. */
export function describePresetWindow(preset: SchedulePreset, shiftMinutes = 0): string {
  const start = splitMinuteOfDay(preset.startMinuteOfDay + shiftMinutes);
  const end = splitMinuteOfDay(
    preset.startMinuteOfDay + shiftMinutes + preset.durationMinutes
  );
  return `${formatClockTime(start.hour, start.minute)} – ${formatClockTime(end.hour, end.minute)}`;
}

function summarizeApps(apps: ScreenTimeItem[]): TimedBlockPlan["appsSummary"] {
  return {
    appCount: apps.filter((app) => app.type === "application").length,
    catCount: apps.filter((app) => app.type === "category").length,
    webCount: apps.filter((app) => app.type === "webDomain").length,
  };
}

/**
 * Turns an onboarding preset into a real Timed Block plan, so the block the
 * user chose here is the same object the Timed Block screen edits later —
 * there is no separate "onboarding schedule" concept to reconcile.
 */
export function planFromPreset(
  preset: SchedulePreset,
  shiftMinutes: number,
  apps: ScreenTimeItem[]
): Omit<TimedBlockPlan, "id"> {
  const shift = clampScheduleShift(shiftMinutes);
  const start = splitMinuteOfDay(preset.startMinuteOfDay + shift);
  const end = splitMinuteOfDay(preset.startMinuteOfDay + shift + preset.durationMinutes);

  return {
    label: preset.label,
    daysOfWeek: [...preset.daysOfWeek],
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
    durationMinutes: preset.durationMinutes,
    focusMode: "flexible",
    appIds: apps.map((app) => app.id),
    appsSummary: summarizeApps(apps),
    enabled: true,
  };
}

import type { MetricDelta } from "./types";

/** "12h 34m", "48m", "3h". Rounds to whole minutes. */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "2d 17h" — used for lifetime totals, where hours alone stop meaning anything. */
export function formatLongDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const days = Math.floor(minutes / (60 * 24));
  if (days < 1) return formatMinutes(minutes);
  const hours = Math.floor((minutes - days * 60 * 24) / 60);
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

/** "4h 21m/day". */
export function formatPerDay(minutesPerDay: number): string {
  return `${formatMinutes(minutesPerDay)}/day`;
}

/** Signed minute change, e.g. "43m" — the arrow carries the sign. */
export function formatMinuteChange(change: number): string {
  return formatMinutes(Math.abs(change));
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

const UP = "↑";
const DOWN = "↓";

/**
 * "↑ 18% vs last week" / "↓ 43m/day". Percent is preferred because it survives
 * period changes; callers pass a unit formatter for the cases where the
 * absolute change is the more legible number.
 */
export function formatComparison(
  delta: MetricDelta | null,
  comparisonLabel: string,
  options: { unit?: "percent" | "minutes" | "minutesPerDay" | "count" } = {}
): string | null {
  if (!delta) return null;
  const unit = options.unit ?? "percent";

  if (unit === "percent") {
    if (delta.percent === null) return null;
    if (Math.round(Math.abs(delta.percent) * 100) === 0) {
      return `No change vs ${comparisonLabel}`;
    }
    const arrow = delta.percent > 0 ? UP : DOWN;
    return `${arrow} ${formatPercent(Math.abs(delta.percent))} vs ${comparisonLabel}`;
  }

  if (Math.round(Math.abs(delta.change)) === 0) {
    return `No change vs ${comparisonLabel}`;
  }

  if (unit === "count") {
    const arrow = delta.change > 0 ? UP : DOWN;
    return `${arrow} ${Math.abs(Math.round(delta.change))} vs ${comparisonLabel}`;
  }

  const arrow = delta.change > 0 ? UP : DOWN;
  const suffix = unit === "minutesPerDay" ? "/day" : "";
  return `${arrow} ${formatMinuteChange(delta.change)}${suffix}`;
}

/** "+1h 24m vs last week" — the additive framing used for reclaimed time. */
export function formatGain(delta: MetricDelta | null, comparisonLabel: string): string | null {
  if (!delta || Math.round(Math.abs(delta.change)) === 0) return null;
  const sign = delta.change > 0 ? "+" : "−";
  return `${sign}${formatMinuteChange(delta.change)} vs ${comparisonLabel}`;
}

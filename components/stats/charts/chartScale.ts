import type { ChartReference, SeriesPoint } from "@/lib/stats/types";

/** Headroom above the tallest value so the top bar never touches the frame. */
const HEADROOM = 1.12;

export interface ChartScale {
  max: number;
  /** Fraction of the plot height a value sits at, 0–1. */
  ratio: (value: number) => number;
}

/**
 * One scale for the series and its reference lines together, so the goal line
 * can never fall outside the frame it is meant to be compared against.
 */
export function buildScale(
  points: SeriesPoint[],
  references: ChartReference[] = []
): ChartScale {
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null)
    .concat(references.map((r) => r.value));

  const peak = values.length > 0 ? Math.max(...values) : 0;
  const max = peak > 0 ? peak * HEADROOM : 1;

  return { max, ratio: (value) => Math.max(0, Math.min(1, value / max)) };
}

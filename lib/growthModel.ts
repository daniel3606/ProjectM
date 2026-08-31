import { DAY_MS, startOfDay } from "./stats/time";

/**
 * The Marshmallow growth model. A completed block earns
 * `G_raw = K × √M × Q × S × B × H`, then a daily soft cap thins out — without
 * ever stopping — the growth earned later in the same day.
 *
 * Two invariants a retune must keep. √M gives diminishing returns in session
 * length, so all-day blocking cannot out-earn deliberate short blocks. And
 * there is no Premium term: Hard Block's bonus is earned by completing the
 * stricter mode, so the same normal block is worth the same on either tier.
 * `growthModel.simulation.test.ts` holds both to the tuned numbers.
 */

/** Which kind of block earned the growth. Sets the `B` multiplier. */
export type GrowthBlockType = "quick" | "scheduled" | "sleep";

// ─────────────────────────────────────────────────────────────────────────────
// Tunable constants
//
// All growth tuning lives here. Nothing downstream hard-codes a multiplier.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `K` — the global growth scale, in cm per √minute. Tuned so a user running
 * four 30-minute Quick Blocks a day reaches about 180 cm in 30 days.
 *
 * `K` scales raw growth, which the soft cap then flattens, so a change here
 * does not move the monthly sizes proportionally. Re-run the scenario test.
 */
export const GROWTH_TUNING_CONSTANT_K = 0.37;

/**
 * `Q` — session-quality multiplier, keyed by inclusive upper duration bound.
 * Marathon blocks are worth less per minute than a focused hour.
 *
 * The first band also covers blocks under 10 minutes, which √M already prices
 * down on its own.
 */
export const SESSION_QUALITY_TIERS: readonly { maxMinutes: number; multiplier: number }[] = [
  { maxMinutes: 120, multiplier: 1.0 },
  { maxMinutes: 240, multiplier: 0.85 },
  { maxMinutes: Infinity, multiplier: 0.65 },
];

/** `S` — streak multiplier, keyed by minimum consecutive days (inclusive). */
export const STREAK_TIERS: readonly { minDays: number; multiplier: number }[] = [
  { minDays: 30, multiplier: 1.1 },
  { minDays: 7, multiplier: 1.05 },
  { minDays: 0, multiplier: 1.0 },
];

/** `B` — block-type multiplier. Intentional Quick Blocks are the baseline. */
export const BLOCK_TYPE_MULTIPLIERS: Record<GrowthBlockType, number> = {
  quick: 1.0,
  scheduled: 0.7,
  sleep: 0.5,
};

/**
 * `H` — Hard Block multiplier, awarded only on a completed Hard Block.
 *
 * Keep it at or below ~1.15 unless retention data supports more. The larger it
 * gets, the more it reads as the Premium growth multiplier the model must not have.
 */
export const HARD_BLOCK_MULTIPLIER = 1.1;

/**
 * The daily soft cap, as efficiency bands over the day's raw growth. The last
 * band is unbounded: there is no hard cap, growth just thins out.
 */
export const DAILY_SOFT_CAP_BANDS: readonly { widthCm: number; efficiency: number }[] = [
  { widthCm: 4, efficiency: 1.0 },
  { widthCm: 2, efficiency: 0.6 },
  { widthCm: Infinity, efficiency: 0.3 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Multipliers
// ─────────────────────────────────────────────────────────────────────────────

/** `Q` for a block of `minutes`. */
export function getQualityMultiplier(minutes: number): number {
  const tier = SESSION_QUALITY_TIERS.find((t) => minutes <= t.maxMinutes);
  return tier?.multiplier ?? 1;
}

/** `S` for a streak of `consecutiveDays`. */
export function getStreakMultiplier(consecutiveDays: number): number {
  const tier = STREAK_TIERS.find((t) => consecutiveDays >= t.minDays);
  return tier?.multiplier ?? 1;
}

/** `B` for a block type. */
export function getBlockTypeMultiplier(blockType: GrowthBlockType): number {
  return BLOCK_TYPE_MULTIPLIERS[blockType] ?? BLOCK_TYPE_MULTIPLIERS.quick;
}

/**
 * `H`. Takes completion explicitly rather than trusting the caller to only ask
 * about finished blocks: a Hard Block that was exited or failed earns no bonus.
 */
export function getHardBlockMultiplier(isHardBlock: boolean, completed: boolean): number {
  return isHardBlock && completed ? HARD_BLOCK_MULTIPLIER : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Growth
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionGrowthInput {
  /** Length of the block in minutes — the `M` in the formula. */
  minutes: number;
  blockType: GrowthBlockType;
  /** True only for a Hard Block. Ignored unless `completed`. */
  isHardBlock?: boolean;
  /** Consecutive days the user has completed at least one block, before today. */
  streakDays?: number;
  /**
   * Whether the block ran to the end. A block that was ended early earns no
   * growth at all, and specifically no Hard Block bonus.
   */
  completed?: boolean;
}

/** `G_raw` for one block, before the daily soft cap. */
export function computeRawSessionGrowth({
  minutes,
  blockType,
  isHardBlock = false,
  streakDays = 0,
  completed = true,
}: SessionGrowthInput): number {
  if (!completed || minutes <= 0) return 0;

  return (
    GROWTH_TUNING_CONSTANT_K *
    Math.sqrt(minutes) *
    getQualityMultiplier(minutes) *
    getStreakMultiplier(streakDays) *
    getBlockTypeMultiplier(blockType) *
    getHardBlockMultiplier(isHardBlock, completed)
  );
}

/**
 * `F(R)` — total awarded growth for a day whose raw growth is `R`.
 *
 * Piecewise-linear, so awarding each block its marginal slice is
 * order-independent: a day's blocks total the same in any sequence.
 */
export function applyDailySoftCap(rawGrowthCm: number): number {
  let remaining = Math.max(0, rawGrowthCm);
  let awarded = 0;

  for (const band of DAILY_SOFT_CAP_BANDS) {
    if (remaining <= 0) break;
    const inBand = Math.min(remaining, band.widthCm);
    awarded += inBand * band.efficiency;
    remaining -= inBand;
  }

  return awarded;
}

export interface SessionGrowthResult {
  /** What the block earned before the day's soft cap. Stored as-is. */
  rawGrowthCm: number;
  /** What the marshmallow actually grew by, after the soft cap. */
  awardedGrowthCm: number;
}

/**
 * Growth for one block, before and after the daily soft cap. The award is the
 * block's marginal value within the day, `F(R_before + raw) - F(R_before)`, so
 * the same block is worth less once the day is already several cm deep.
 */
export function computeSessionGrowth(
  input: SessionGrowthInput & {
    /** Total raw growth already earned today, before this block. */
    rawGrowthTodayCm?: number;
  }
): SessionGrowthResult {
  const before = Math.max(0, input.rawGrowthTodayCm ?? 0);
  const rawGrowthCm = computeRawSessionGrowth(input);

  return {
    rawGrowthCm,
    awardedGrowthCm: applyDailySoftCap(before + rawGrowthCm) - applyDailySoftCap(before),
  };
}

/** Growth as the UI shows it: one decimal place of centimetres. */
export function roundGrowthCm(cm: number): number {
  return Math.round(cm * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading the model's day-dependent inputs out of session history
//
// `R_before` and the streak are derived rather than counted. A counter drifts
// when a session syncs in from another device or the day rolls over while the
// app is asleep; history is already the source of truth for the size.
// ─────────────────────────────────────────────────────────────────────────────

/** The shape both helpers below need. Satisfied by `CompletedSession`. */
export interface CompletedGrowthSession {
  completedAt: number;
  /** Absent on sessions completed before this model shipped. */
  rawGrowthCm?: number;
}

/** `R_before`: total raw growth earned on `now`'s calendar day so far. */
export function getRawGrowthToday(
  sessions: CompletedGrowthSession[],
  now: number = Date.now()
): number {
  const dayStart = startOfDay(now);
  const dayEnd = dayStart + DAY_MS;

  return sessions.reduce((sum, session) => {
    if (session.completedAt < dayStart || session.completedAt >= dayEnd) return sum;
    return sum + (session.rawGrowthCm ?? 0);
  }, 0);
}

/**
 * Consecutive days ending yesterday on which the user completed a block — the
 * streak today's sessions build on.
 *
 * Today is excluded so every block completed today earns the same `S`.
 * Including it would make the first block of the day worth less than the second.
 */
export function getStreakDays(
  sessions: CompletedGrowthSession[],
  now: number = Date.now()
): number {
  const days = new Set(sessions.map((session) => startOfDay(session.completedAt)));

  let streak = 0;
  let day = startOfDay(now) - DAY_MS;
  while (days.has(day)) {
    streak += 1;
    // Rebuilt from a Date each step: subtracting a fixed DAY_MS drifts across
    // a daylight-saving boundary and would silently break the streak.
    day = startOfDay(day - DAY_MS / 2);
  }

  return streak;
}

/** Plan fields the block type is read from. Satisfied by `TimedBlockPlan`. */
export interface GrowthPlanShape {
  label: string;
  isSleep?: boolean;
}

/** Labels that mark a pre-`isSleep` plan as covering sleep. */
const SLEEP_LABEL_PATTERN = /\b(sleep|bedtime|bed time|overnight|night)\b/i;

/**
 * `B` for a scheduled plan. Falls back to the label for plans saved before
 * `isSleep` existed, so an existing Bedtime plan still grows at the sleep rate.
 */
export function getBlockTypeForPlan(plan: GrowthPlanShape): GrowthBlockType {
  if (plan.isSleep ?? SLEEP_LABEL_PATTERN.test(plan.label)) return "sleep";
  return "scheduled";
}

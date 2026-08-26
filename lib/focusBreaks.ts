/**
 * Break policy for focus blocks.
 *
 * A break unblocks the shielded apps for a few minutes without ending the
 * block: the session clock keeps running, so expected growth is unaffected.
 *
 * The numbers below were picked against how comparable products do it:
 *
 *  - Pomodoro is 25m of work to a 5m break, and nobody breaks a single
 *    pomodoro in half. DeskTime's 2014 study of its most productive 10%
 *    found a 52m/17m work-break rhythm (re-measured as 112m/26m in 2021).
 *    Both put the first natural break somewhere near the hour mark, which
 *    is where `BREAK_ELIGIBILITY_MINUTES` sits — under an hour, a break is
 *    not recovery, it's just an escape hatch.
 *  - Freedom hands out one five-minute break per day; Pomodoro's short
 *    break is also five minutes. Hence `BREAK_LENGTH_MINUTES`.
 *  - Opal ("you have to wait more before each break") and Jomo (a cool-off
 *    timer before a break unlocks) both put friction in front of the
 *    button rather than removing it. That's `MIN_ELAPSED_BEFORE_FIRST_BREAK_MINUTES`
 *    and `MIN_GAP_BETWEEN_BREAKS_MINUTES`.
 *  - Opal's "No way, I'm hardcore" tier removes breaks entirely and is
 *    paid-only. Hard Mode here matches: zero breaks, no early end.
 *
 * The one place this is deliberately stingier than the research: 5 minutes
 * per hour is an ~8% break ratio, well under 52/17's 33%. That gap is on
 * purpose — 17 minutes away from the desk is the *point* of the block, and
 * only a slice of it should be spent back inside the apps being blocked.
 */

/** Blocks shorter than this earn no breaks at all. */
export const BREAK_ELIGIBILITY_MINUTES = 60;

/** How long a single break unblocks apps for. */
export const BREAK_LENGTH_MINUTES = 5;

/** One break is earned per this many minutes of block duration. */
export const BREAK_INTERVAL_MINUTES = 60;

/** Hard ceiling, so a very long block can't become half-open (4 x 5m = 20m). */
export const MAX_BREAKS_PER_SESSION = 4;

/** Friction: the block has to have actually started before the first break. */
export const MIN_ELAPSED_BEFORE_FIRST_BREAK_MINUTES = 15;

/** Friction: breaks can't be chained back-to-back. */
export const MIN_GAP_BETWEEN_BREAKS_MINUTES = 20;

/** A break inside the final stretch is just quitting early, so it's refused. */
export const MIN_MINUTES_BEFORE_END = 10;

const MINUTE_MS = 60_000;

/** Break bookkeeping carried on the active session. */
export interface BreakState {
  /** Breaks already started during this block, including one in progress. */
  breaksTaken: number;
  /** Epoch ms the in-progress break ends at, or null when not on a break. */
  breakEndsAt: number | null;
  /** Epoch ms the most recent break ended (or will end), or null if none yet. */
  lastBreakEndedAt: number | null;
}

export const INITIAL_BREAK_STATE: BreakState = {
  breaksTaken: 0,
  breakEndsAt: null,
  lastBreakEndedAt: null,
};

/**
 * Total breaks a block of this length is entitled to. Hard Mode gets none,
 * and neither does anything under the eligibility threshold.
 */
export function getBreakAllowance(durationMinutes: number, isHardMode: boolean): number {
  if (isHardMode) return 0;
  if (durationMinutes < BREAK_ELIGIBILITY_MINUTES) return 0;
  const earned = Math.floor(durationMinutes / BREAK_INTERVAL_MINUTES);
  return Math.min(earned, MAX_BREAKS_PER_SESSION);
}

/** Whether the sheet should advertise breaks for a block of this length. */
export function supportsBreaks(durationMinutes: number, isHardMode: boolean): boolean {
  return getBreakAllowance(durationMinutes, isHardMode) > 0;
}

export type BreakBlockedReason =
  | "hardMode"
  | "tooShort"
  | "onBreak"
  | "exhausted"
  | "tooEarly"
  | "tooSoon"
  | "tooCloseToEnd";

export interface BreakAvailability {
  canTakeBreak: boolean;
  /** Why the button is disabled; undefined when `canTakeBreak` is true. */
  reason?: BreakBlockedReason;
  /** Breaks left after the one in progress, if any. */
  breaksRemaining: number;
  /** Epoch ms the break button unlocks at, when the block is only temporal. */
  availableAt?: number;
}

export interface BreakAvailabilityInput {
  startedAt: number;
  durationMinutes: number;
  isHardMode: boolean;
  breakState: BreakState;
  now: number;
}

/**
 * Single source of truth for "can this session take a break right now?",
 * shared by the sheet's preview copy and the running block's break button.
 */
export function getBreakAvailability({
  startedAt,
  durationMinutes,
  isHardMode,
  breakState,
  now,
}: BreakAvailabilityInput): BreakAvailability {
  const allowance = getBreakAllowance(durationMinutes, isHardMode);
  const breaksRemaining = Math.max(0, allowance - breakState.breaksTaken);

  if (isHardMode) return { canTakeBreak: false, reason: "hardMode", breaksRemaining: 0 };
  if (allowance === 0) return { canTakeBreak: false, reason: "tooShort", breaksRemaining: 0 };

  if (breakState.breakEndsAt != null && now < breakState.breakEndsAt) {
    return { canTakeBreak: false, reason: "onBreak", breaksRemaining };
  }
  if (breaksRemaining === 0) {
    return { canTakeBreak: false, reason: "exhausted", breaksRemaining: 0 };
  }

  const endsAt = startedAt + durationMinutes * MINUTE_MS;
  if (now > endsAt - MIN_MINUTES_BEFORE_END * MINUTE_MS) {
    return { canTakeBreak: false, reason: "tooCloseToEnd", breaksRemaining };
  }

  const firstBreakAt = startedAt + MIN_ELAPSED_BEFORE_FIRST_BREAK_MINUTES * MINUTE_MS;
  if (now < firstBreakAt) {
    return {
      canTakeBreak: false,
      reason: "tooEarly",
      breaksRemaining,
      availableAt: firstBreakAt,
    };
  }

  if (breakState.lastBreakEndedAt != null) {
    const nextBreakAt =
      breakState.lastBreakEndedAt + MIN_GAP_BETWEEN_BREAKS_MINUTES * MINUTE_MS;
    if (now < nextBreakAt) {
      return {
        canTakeBreak: false,
        reason: "tooSoon",
        breaksRemaining,
        availableAt: nextBreakAt,
      };
    }
  }

  return { canTakeBreak: true, breaksRemaining };
}

/**
 * Break state after starting a break at `now`. A break never runs past the
 * end of the block, so a short tail is truncated rather than overhanging.
 */
export function startBreak(
  breakState: BreakState,
  now: number,
  sessionEndsAt: number
): BreakState {
  const endsAt = Math.min(now + BREAK_LENGTH_MINUTES * MINUTE_MS, sessionEndsAt);
  return {
    breaksTaken: breakState.breaksTaken + 1,
    breakEndsAt: endsAt,
    lastBreakEndedAt: endsAt,
  };
}

/** Break state once the in-progress break is over (or cut short by the user). */
export function endBreak(breakState: BreakState, now: number): BreakState {
  return {
    ...breakState,
    breakEndsAt: null,
    lastBreakEndedAt:
      breakState.breakEndsAt == null
        ? breakState.lastBreakEndedAt
        : Math.min(breakState.breakEndsAt, now),
  };
}

export function isOnBreak(breakState: BreakState, now: number): boolean {
  return breakState.breakEndsAt != null && now < breakState.breakEndsAt;
}

/** One-line summary of the break entitlement, for the sheet row. */
export function describeBreakAllowance(
  durationMinutes: number,
  isHardMode: boolean
): string {
  if (isHardMode) return "No breaks in Hard Mode";
  const allowance = getBreakAllowance(durationMinutes, isHardMode);
  if (allowance === 0) {
    return `Unlocks at ${BREAK_ELIGIBILITY_MINUTES / 60}h`;
  }
  return `${allowance} x ${BREAK_LENGTH_MINUTES}m`;
}

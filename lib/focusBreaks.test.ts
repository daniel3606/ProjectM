/** @jest-environment node */

import {
  BREAK_ELIGIBILITY_MINUTES,
  BREAK_LENGTH_MINUTES,
  INITIAL_BREAK_STATE,
  MAX_BREAKS_PER_SESSION,
  MIN_ELAPSED_BEFORE_FIRST_BREAK_MINUTES,
  MIN_GAP_BETWEEN_BREAKS_MINUTES,
  MIN_MINUTES_BEFORE_END,
  describeBreakAllowance,
  endBreak,
  getBreakAllowance,
  getBreakAvailability,
  isOnBreak,
  startBreak,
  supportsBreaks,
  type BreakState,
} from "@/lib/focusBreaks";

const MINUTE = 60_000;
const START = 1_700_000_000_000;

function availabilityAt(
  minutesElapsed: number,
  overrides: Partial<{
    durationMinutes: number;
    isHardMode: boolean;
    breakState: BreakState;
  }> = {}
) {
  return getBreakAvailability({
    startedAt: START,
    durationMinutes: overrides.durationMinutes ?? 120,
    isHardMode: overrides.isHardMode ?? false,
    breakState: overrides.breakState ?? INITIAL_BREAK_STATE,
    now: START + minutesElapsed * MINUTE,
  });
}

describe("getBreakAllowance", () => {
  it("gives no breaks below the eligibility threshold", () => {
    expect(getBreakAllowance(BREAK_ELIGIBILITY_MINUTES - 5, false)).toBe(0);
    expect(getBreakAllowance(25, false)).toBe(0);
    expect(supportsBreaks(45, false)).toBe(false);
  });

  it("earns one break per hour from the threshold up", () => {
    expect(getBreakAllowance(60, false)).toBe(1);
    expect(getBreakAllowance(119, false)).toBe(1);
    expect(getBreakAllowance(120, false)).toBe(2);
    expect(getBreakAllowance(180, false)).toBe(3);
    expect(supportsBreaks(60, false)).toBe(true);
  });

  it("caps the allowance so a long block can't go half-open", () => {
    expect(getBreakAllowance(8 * 60, false)).toBe(MAX_BREAKS_PER_SESSION);
    expect(getBreakAllowance(24 * 60, false)).toBe(MAX_BREAKS_PER_SESSION);
  });

  it("gives Hard Mode no breaks at any duration", () => {
    expect(getBreakAllowance(60, true)).toBe(0);
    expect(getBreakAllowance(8 * 60, true)).toBe(0);
    expect(supportsBreaks(8 * 60, true)).toBe(false);
  });
});

describe("getBreakAvailability", () => {
  it("refuses a break before the lead-in has elapsed", () => {
    const result = availabilityAt(MIN_ELAPSED_BEFORE_FIRST_BREAK_MINUTES - 1);
    expect(result.canTakeBreak).toBe(false);
    expect(result.reason).toBe("tooEarly");
    expect(result.availableAt).toBe(
      START + MIN_ELAPSED_BEFORE_FIRST_BREAK_MINUTES * MINUTE
    );
  });

  it("allows a break once the lead-in has elapsed", () => {
    const result = availabilityAt(MIN_ELAPSED_BEFORE_FIRST_BREAK_MINUTES);
    expect(result.canTakeBreak).toBe(true);
    expect(result.breaksRemaining).toBe(2);
  });

  it("refuses a break on a block too short to earn one", () => {
    const result = availabilityAt(30, { durationMinutes: 45 });
    expect(result.canTakeBreak).toBe(false);
    expect(result.reason).toBe("tooShort");
  });

  it("refuses a break in Hard Mode regardless of duration", () => {
    const result = availabilityAt(60, { durationMinutes: 240, isHardMode: true });
    expect(result.canTakeBreak).toBe(false);
    expect(result.reason).toBe("hardMode");
    expect(result.breaksRemaining).toBe(0);
  });

  it("refuses a second break inside the cool-off gap", () => {
    const breakState: BreakState = {
      breaksTaken: 1,
      breakEndsAt: null,
      lastBreakEndedAt: START + 25 * MINUTE,
    };
    const result = availabilityAt(30, { breakState });
    expect(result.canTakeBreak).toBe(false);
    expect(result.reason).toBe("tooSoon");
    expect(result.availableAt).toBe(
      START + (25 + MIN_GAP_BETWEEN_BREAKS_MINUTES) * MINUTE
    );
  });

  it("allows a second break once the cool-off gap has passed", () => {
    const breakState: BreakState = {
      breaksTaken: 1,
      breakEndsAt: null,
      lastBreakEndedAt: START + 25 * MINUTE,
    };
    const result = availabilityAt(25 + MIN_GAP_BETWEEN_BREAKS_MINUTES, { breakState });
    expect(result.canTakeBreak).toBe(true);
    expect(result.breaksRemaining).toBe(1);
  });

  it("refuses a break while one is already running", () => {
    const breakState: BreakState = {
      breaksTaken: 1,
      breakEndsAt: START + 35 * MINUTE,
      lastBreakEndedAt: START + 35 * MINUTE,
    };
    const result = availabilityAt(32, { breakState });
    expect(result.canTakeBreak).toBe(false);
    expect(result.reason).toBe("onBreak");
  });

  it("refuses a break once the allowance is spent", () => {
    const breakState: BreakState = {
      breaksTaken: 2,
      breakEndsAt: null,
      lastBreakEndedAt: START + 20 * MINUTE,
    };
    const result = availabilityAt(90, { breakState });
    expect(result.canTakeBreak).toBe(false);
    expect(result.reason).toBe("exhausted");
    expect(result.breaksRemaining).toBe(0);
  });

  it("refuses a break inside the final stretch of the block", () => {
    const result = availabilityAt(120 - MIN_MINUTES_BEFORE_END + 1);
    expect(result.canTakeBreak).toBe(false);
    expect(result.reason).toBe("tooCloseToEnd");
  });

  it("still allows a break at the edge of the final stretch", () => {
    const result = availabilityAt(120 - MIN_MINUTES_BEFORE_END);
    expect(result.canTakeBreak).toBe(true);
  });
});

describe("startBreak / endBreak", () => {
  const sessionEndsAt = START + 120 * MINUTE;

  it("spends one break and sets the end timestamp", () => {
    const now = START + 20 * MINUTE;
    const next = startBreak(INITIAL_BREAK_STATE, now, sessionEndsAt);
    expect(next.breaksTaken).toBe(1);
    expect(next.breakEndsAt).toBe(now + BREAK_LENGTH_MINUTES * MINUTE);
    expect(isOnBreak(next, now + MINUTE)).toBe(true);
    expect(isOnBreak(next, now + (BREAK_LENGTH_MINUTES + 1) * MINUTE)).toBe(false);
  });

  it("truncates a break that would overhang the end of the block", () => {
    const now = sessionEndsAt - 2 * MINUTE;
    const next = startBreak(INITIAL_BREAK_STATE, now, sessionEndsAt);
    expect(next.breakEndsAt).toBe(sessionEndsAt);
  });

  it("clears the running break and records when it actually ended", () => {
    const now = START + 20 * MINUTE;
    const started = startBreak(INITIAL_BREAK_STATE, now, sessionEndsAt);
    const endedEarly = endBreak(started, now + 2 * MINUTE);
    expect(endedEarly.breakEndsAt).toBeNull();
    expect(endedEarly.lastBreakEndedAt).toBe(now + 2 * MINUTE);
    expect(endedEarly.breaksTaken).toBe(1);
  });

  it("keeps the scheduled end when the break runs its full length", () => {
    const now = START + 20 * MINUTE;
    const started = startBreak(INITIAL_BREAK_STATE, now, sessionEndsAt);
    const ended = endBreak(started, now + (BREAK_LENGTH_MINUTES + 3) * MINUTE);
    expect(ended.lastBreakEndedAt).toBe(now + BREAK_LENGTH_MINUTES * MINUTE);
  });
});

describe("describeBreakAllowance", () => {
  it("describes the entitlement for an eligible block", () => {
    expect(describeBreakAllowance(120, false)).toBe(`2 x ${BREAK_LENGTH_MINUTES}m`);
  });

  it("points at the unlock threshold for a short block", () => {
    expect(describeBreakAllowance(30, false)).toBe("Unlocks at 1h");
  });

  it("says Hard Mode has none", () => {
    expect(describeBreakAllowance(240, true)).toBe("No breaks in Hard Mode");
  });
});

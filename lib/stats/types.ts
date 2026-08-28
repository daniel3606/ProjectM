import type { FocusMode } from "@/constants/marshmallow";

// ─────────────────────────────────────────────────────────────────────────────
// Raw inputs
//
// Every source normalizes into the shapes below before any maths runs, so
// nothing downstream of `computeStats` knows where the data came from.
// ─────────────────────────────────────────────────────────────────────────────

/** One focus block the user actually started, whether or not they finished it. */
export interface SessionAttempt {
  startedAt: number;
  endedAt: number;
  /** Planned length of the block. */
  durationMinutes: number;
  /** Minutes actually spent in the block (== durationMinutes when completed). */
  focusedMinutes: number;
  focusMode: FocusMode;
  completed: boolean;
  /** Set when the block came from a Timed Block plan rather than a Quick Block. */
  planId?: string;
  planLabel?: string;
  /** Apps/categories the block hid. Empty means it blocked everything. */
  appIds?: string[];
}

/** Per-app usage for a single calendar day. */
export interface AppUsageSample {
  appId: string;
  label: string;
  minutes: number;
  /** True when the user has flagged this app as one they want less of. */
  distracting: boolean;
}

/** One calendar day of device usage. Absent days mean "no data", never zero. */
export interface DailyUsageSample {
  /** Local midnight of the day this sample covers, in ms. */
  day: number;
  totalMinutes: number;
  apps: AppUsageSample[];
  /**
   * Distracting minutes per hour-of-day, index 0–23. Optional because a source
   * may only be able to report daily totals; insights that need it degrade to
   * "not enough data" rather than guessing.
   */
  hourlyDistractingMinutes?: number[];
}

/**
 * The complete raw input to the Stats layer. `usage` is `null` — not `[]` —
 * when no usage source is connected at all, so the UI can tell "we have no
 * way to measure this yet" apart from "you have no usage yet".
 */
export interface StatsInput {
  now: number;
  attempts: SessionAttempt[];
  usage: DailyUsageSample[] | null;
  /** Typical daily screen time before Marshmallow, in minutes. */
  baselineMinutesPerDay: number | null;
  /** Daily screen-time target, in minutes. */
  goal: GoalSetting | null;
  /** First day the user had Marshmallow, in ms. */
  joinedAt: number | null;
  /** Enabled Timed Block plans, used to attribute prevented usage to a schedule. */
  schedules: ScheduleInput[];
  personalBests: PersonalBestRecord[];
  isPremium: boolean;
}

export interface GoalSetting {
  minutesPerDay: number;
  /** True when the target was suggested from the user's baseline, not chosen. */
  suggested: boolean;
}

export interface ScheduleInput {
  id: string;
  label: string;
  daysOfWeek: number[];
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Periods
// ─────────────────────────────────────────────────────────────────────────────

export type StatsPeriodId = "today" | "week" | "month" | "year";

export type BucketUnit = "hour" | "day" | "week" | "month";

export interface PeriodRange {
  id: StatsPeriodId;
  label: string;
  /** Inclusive, ms. */
  start: number;
  /** Exclusive, ms. */
  end: number;
  /** The equally sized window immediately before, used for every comparison. */
  previousStart: number;
  previousEnd: number;
  bucketUnit: BucketUnit;
  /** How the previous window is described in copy, e.g. "last week". */
  comparisonLabel: string;
  /** Number of days the window covers, used for per-day averages. */
  dayCount: number;
  requiresPremium: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output models
// ─────────────────────────────────────────────────────────────────────────────

/** Why a section has nothing to show. `null` means it does have something. */
export type UnavailableReason =
  /** No source is connected that could produce this at all. */
  | "no-source"
  /** A source exists but the user hasn't generated enough history yet. */
  | "not-enough-data"
  /** The data exists but this period is a paid tier. */
  | "premium";

export interface SeriesPoint {
  /** Bucket start, ms. */
  at: number;
  /** Axis label; empty string renders an unlabelled tick. */
  label: string;
  /** Minutes. `null` means no data for this bucket — never draw it as zero. */
  value: number | null;
}

export interface MetricDelta {
  /** Signed change in the metric's own unit. */
  change: number;
  /** Signed percent change, or null when the previous window was empty. */
  percent: number | null;
  /** Whether a rise is an improvement for this particular metric. */
  polarity: "up-is-good" | "down-is-good";
  /** Reads as progress, a step back, or neither. */
  tone: "positive" | "negative" | "neutral";
}

export interface OverviewMetric {
  id: "focus" | "screenTime" | "reclaimed" | "sessions";
  label: string;
  /** Formatted headline value, e.g. "12h 34m". */
  value: string;
  /** Formatted comparison, e.g. "↑ 18% vs last week". Absent when incomparable. */
  comparison: string | null;
  tone: "positive" | "negative" | "neutral";
  /** Extra line under the value, e.g. "87% completion". */
  caption?: string;
  unavailable: UnavailableReason | null;
}

export interface OverviewModel {
  /** The single number the screen leads with. */
  hero: OverviewMetric;
  /** The three supporting numbers under the hero. */
  supporting: OverviewMetric[];
}

export interface ChartReference {
  /** Minutes the line sits at. */
  value: number;
  label: string;
  style: "goal" | "baseline";
}

export interface ScreenTimeModel {
  unavailable: UnavailableReason | null;
  series: SeriesPoint[];
  references: ChartReference[];
  averageMinutesPerDay: number;
  delta: MetricDelta | null;
  /** The one sentence that explains the chart. */
  interpretation: string | null;
}

export interface FocusModel {
  unavailable: UnavailableReason | null;
  series: SeriesPoint[];
  totalMinutes: number;
  averageMinutesPerDay: number;
  delta: MetricDelta | null;
  interpretation: string | null;
}

export interface ReclaimedModel {
  unavailable: UnavailableReason | null;
  /**
   * How the number was arrived at. `below-baseline` compares real usage to the
   * user's starting point; `blocked-time` falls back to time spent inside
   * blocks when no usage source is connected. The copy differs, so the UI must
   * not assume one meaning.
   */
  basis: "below-baseline" | "blocked-time";
  periodMinutes: number;
  lifetimeMinutes: number;
  delta: MetricDelta | null;
  interpretation: string | null;
}

export interface DistractingApp {
  appId: string;
  label: string;
  minutes: number;
  averageMinutesPerDay: number;
  delta: MetricDelta | null;
  /** Hour-of-day this app is used most, 0–23. Null without hourly data. */
  peakHour: number | null;
  /** Minutes this app spent blocked by a focus session during the period. */
  blockedMinutes: number;
}

export interface DistractionsModel {
  unavailable: UnavailableReason | null;
  /** Ranked, longest first. The screen shows the leading few; `apps` holds all. */
  apps: DistractingApp[];
  totalMinutes: number;
}

export interface GoalModel {
  unavailable: UnavailableReason | null;
  targetMinutesPerDay: number;
  currentMinutesPerDay: number;
  /** 0–1, clamped. 1 means at or under target. */
  progress: number;
  /** Signed minutes relative to target; negative means under. */
  differenceMinutes: number;
  suggested: boolean;
  /** Calm, non-punitive phrasing of where the user stands. */
  interpretation: string;
}

export interface SessionsModel {
  unavailable: UnavailableReason | null;
  started: number;
  completed: number;
  /** 0–1. */
  completionRate: number;
  totalFocusedMinutes: number;
  averageSessionMinutes: number;
  longestSessionMinutes: number;
}

export type PersonalBestId =
  | "longestSession"
  | "mostFocusedDay"
  | "bestWeek"
  | "lowestScreenTime"
  | "mostTimeReclaimed";

/** A best that has been achieved and acknowledged, as persisted between runs. */
export interface PersonalBestRecord {
  id: PersonalBestId;
  value: number;
  achievedAt: number;
  /** True once the user has seen the "NEW" state for this value. */
  seen: boolean;
}

export interface PersonalBest {
  id: PersonalBestId;
  label: string;
  /** Minutes, or 0 when never achieved. */
  value: number;
  /** Formatted for display; null when the record has never been set. */
  display: string | null;
  achievedAt: number | null;
  /** True when this beat the stored record and hasn't been acknowledged yet. */
  isNew: boolean;
  unavailable: UnavailableReason | null;
}

export interface RecordsModel {
  unavailable: UnavailableReason | null;
  bests: PersonalBest[];
  /** Bests that are newly set and not yet acknowledged. */
  newlySet: PersonalBestId[];
}

export type InsightId =
  | "strongestFocusWindow"
  | "biggestDistractionWindow"
  | "mostEffectiveSchedule"
  | "deepFocusPerformance";

export interface Insight {
  id: InsightId;
  /** Section-style label, e.g. "Your strongest focus window". */
  title: string;
  /** The finding itself, e.g. "9 AM – 11 AM". */
  headline: string;
  /** Why it matters, one sentence. */
  detail: string;
  requiresPremium: boolean;
  /** Shown in place of `headline`/`detail` when locked. */
  teaser: string;
}

export interface InsightsModel {
  unavailable: UnavailableReason | null;
  /** At most four, most useful first. */
  insights: Insight[];
  /** True when the insights exist but the account can't see the real values. */
  locked: boolean;
}

export type RecommendationActionId = "create-schedule" | "schedule-focus";

export interface RecommendationAction {
  id: RecommendationActionId;
  label: string;
  /** Prefill for the Timed Block plan sheet this action opens. */
  draft: {
    label: string;
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
  };
}

export interface Recommendation {
  id: string;
  title: string;
  /** What the data says. */
  reason: string;
  /** What acting on it would be worth. */
  benefit: string;
  action: RecommendationAction;
}

export interface StatsModel {
  period: PeriodRange;
  /** True when the whole period is behind the paywall for this account. */
  periodLocked: boolean;
  overview: OverviewModel;
  screenTime: ScreenTimeModel;
  focus: FocusModel;
  reclaimed: ReclaimedModel;
  distractions: DistractionsModel;
  goal: GoalModel;
  sessions: SessionsModel;
  records: RecordsModel;
  insights: InsightsModel;
  recommendation: Recommendation | null;
  /** True when the account has produced so little data the screen leads with onboarding copy. */
  isNewUser: boolean;
}

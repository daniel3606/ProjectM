import type { StatsPeriodId } from "./types";

/**
 * Every event the Stats experience emits. Names are frozen here rather than
 * written inline at call sites so the set stays reviewable — screen-time data
 * is sensitive, and nothing below carries an app name, a raw duration, or
 * anything else that identifies what the user does on their phone.
 */
export const STATS_EVENTS = {
  viewed: "stats_viewed",
  periodChanged: "stats_period_changed",
  appBreakdownOpened: "stats_app_breakdown_opened",
  goalViewed: "stats_goal_viewed",
  personalBestViewed: "stats_personal_best_viewed",
  premiumInsightPreviewed: "stats_premium_insight_previewed",
  premiumCtaPressed: "stats_premium_cta_pressed",
  recommendationViewed: "stats_recommendation_viewed",
  recommendationActioned: "stats_recommendation_actioned",
  scheduleCreatedFromInsight: "stats_schedule_created_from_insight",
} as const;

export type StatsEventName = (typeof STATS_EVENTS)[keyof typeof STATS_EVENTS];

/**
 * Properties are deliberately narrow: buckets, ids and booleans only. If a new
 * event needs a number, prefer a bucket ("0-2", "3-5") over the value itself.
 */
export interface StatsEventProps {
  period?: StatsPeriodId;
  /** Where the user came from, e.g. "tab", "insight". */
  source?: string;
  /** Stable identifier of a record/insight/recommendation — never a label. */
  itemId?: string;
  isPremium?: boolean;
  /** Whether the section had anything to show, without saying what. */
  hasData?: boolean;
}

type Sink = (name: StatsEventName, props: StatsEventProps) => void;

const noopSink: Sink = () => {};

let sink: Sink = __DEV__
  ? (name, props) => {
      // Until an analytics provider is wired up, events are visible in dev only.
      console.log(`[stats] ${name}`, props);
    }
  : noopSink;

/** Point Stats analytics at a real provider. Pass null to silence it. */
export function setStatsAnalyticsSink(next: Sink | null): void {
  sink = next ?? noopSink;
}

export function trackStats(name: StatsEventName, props: StatsEventProps = {}): void {
  try {
    sink(name, props);
  } catch {
    // Analytics must never take the screen down with it.
  }
}

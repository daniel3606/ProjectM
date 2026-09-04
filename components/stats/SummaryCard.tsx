import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Theme from "@/constants/theme";
import type {
  GrowthModel,
  PeriodRange,
  SummaryModel,
  SummaryStat,
  TrendModel,
  UsageApp,
} from "@/lib/stats/types";
import AppIcon from "./AppIcon";
import UsageReport, { USAGE_REPORT } from "./UsageReport";
import GroupedBarChart from "./charts/GroupedBarChart";

const ENTER_DURATION_MS = 240;
const MOST_USED_ICON = 34;
/** Roughly a third of the icon, so they read as a stack rather than a row. */
const ICON_OVERLAP = -13;
/** Three is what fits the narrowest column at this size. */
const MOST_USED_COUNT = 3;

/** Windows this recent are named relatively, so the caption can exclaim. */
const EXCLAIM_ABOVE_OFFSET = -2;
/**
 * Every column is this tall, so the two drawn by the Screen Time report line
 * up with the one React Native draws — a report can't report its own size.
 */
const STAT_COLUMN_HEIGHT = 80;

const TONE_COLORS = {
  positive: Theme.colors.positive,
  negative: Theme.colors.attention,
  neutral: Theme.colors.textSecondary,
} as const;

interface SummaryCardProps {
  summary: SummaryModel;
  range: PeriodRange;
  /** What the window is called; the navigator above prints the same thing. */
  title: string;
  /** True when the Screen Time report can draw the columns only iOS can fill. */
  reportReady: boolean;
  /** Index of today's column in the trend chart, when the window contains one. */
  highlightIndex?: number;
}

/**
 * The card the screen leads with. A day headlines the growth the marshmallow
 * earned; longer windows headline the daily chart instead. Both then carry the
 * same row: time blocked, screen time, and the apps used most.
 */
export default function SummaryCard({
  summary,
  range,
  title,
  reportReady,
  highlightIndex,
}: SummaryCardProps) {
  const animationKey = `${range.id}:${range.offset}`;

  return (
    <Animated.View
      key={animationKey}
      entering={FadeIn.duration(ENTER_DURATION_MS)}
      style={styles.card}
      testID="stats-summary-card"
    >
      {summary.trend ? (
        <TrendHeadline
          trend={summary.trend}
          animationKey={animationKey}
          highlightIndex={highlightIndex}
        />
      ) : (
        <GrowthHeadline growth={summary.growth} title={title} offset={range.offset} />
      )}

      <View style={styles.statRow}>
        <StatColumn stat={summary.stats[0]} />
        <View style={styles.statDivider} />

        {/* Screen Time and Most Used come from one report rather than two:
            each one on screen is a separate extension instance. */}
        {reportReady ? (
          <UsageReport
            context={USAGE_REPORT.summaryStats}
            range={range}
            height={STAT_COLUMN_HEIGHT}
            flex={2}
          />
        ) : (
          <>
            <StatColumn stat={summary.stats[1]} />
            <View style={styles.statDivider} />
            <MostUsedColumn apps={summary.mostUsed} />
          </>
        )}
      </View>
    </Animated.View>
  );
}

const GrowthHeadline = React.memo(function GrowthHeadline({
  growth,
  title,
  offset,
}: {
  growth: GrowthModel;
  title: string;
  offset: number;
}) {
  // "Today!" and "Yesterday!" carry the exclamation; a dated title reads badly
  // with one.
  const caption = offset > EXCLAIM_ABOVE_OFFSET ? `${title}!` : title;

  return (
    <View style={styles.headline}>
      <Text style={styles.headlineLabel}>Your Marshmallow Grew</Text>
      <Text style={styles.headlineValue} testID="stats-growth-value">
        {growth.display}
      </Text>
      <Text style={styles.headlineCaption}>{caption}</Text>

      {growth.unavailable ? (
        <Text style={styles.headlineNote}>No completed blocks yet</Text>
      ) : growth.comparison ? (
        <Text style={[styles.headlineNote, { color: TONE_COLORS[growth.tone] }]}>
          {growth.comparison}
        </Text>
      ) : null}
    </View>
  );
});

const TrendHeadline = React.memo(function TrendHeadline({
  trend,
  animationKey,
  highlightIndex,
}: {
  trend: TrendModel;
  animationKey: string;
  highlightIndex?: number;
}) {
  return (
    <View style={styles.trend}>
      {trend.unavailable ? (
        <Text style={styles.trendEmpty}>
          {trend.unavailable === "no-source"
            ? "Daily screen time isn't connected yet."
            : "Not enough days to chart yet."}
        </Text>
      ) : (
        <GroupedBarChart
          series={trend.series}
          highlightIndex={highlightIndex}
          animationKey={animationKey}
        />
      )}
    </View>
  );
});

const StatColumn = React.memo(function StatColumn({ stat }: { stat: SummaryStat }) {
  return (
    <View style={styles.stat} testID={`stats-summary-${stat.id}`}>
      <Text style={styles.statLabel}>{stat.label}</Text>
      <Text style={styles.statValue}>{stat.value}</Text>
      {stat.unavailable ? (
        <Text style={styles.statChange}>
          {stat.unavailable === "no-source" ? "Not tracked" : "No data"}
        </Text>
      ) : (
        <Text style={[styles.statChange, { color: TONE_COLORS[stat.tone] }]}>
          {stat.change ?? "—"}
        </Text>
      )}
    </View>
  );
});

const MostUsedColumn = React.memo(function MostUsedColumn({
  apps,
}: {
  apps: UsageApp[];
}) {
  return (
    <View style={styles.stat} testID="stats-summary-mostUsed">
      <Text style={styles.statLabel}>Most Used Apps</Text>

      {apps.length === 0 ? (
        <Text style={styles.statChange}>Not tracked</Text>
      ) : (
        <View style={styles.icons}>
          {apps.slice(0, MOST_USED_COUNT).map((app, index) => (
            <View
              key={app.appId}
              // Later siblings paint on top by default, which would stack the
              // least-used app over the rest.
              style={[
                index > 0 && styles.iconStacked,
                { zIndex: MOST_USED_COUNT - index },
              ]}
            >
              <AppIcon
                token={app.token}
                itemType={app.itemType}
                label={app.label}
                size={MOST_USED_ICON}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: Theme.spacing.lg,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xxl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.xl,
  },
  headline: {
    alignItems: "center",
    paddingVertical: Theme.spacing.md,
  },
  headlineLabel: {
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  headlineValue: {
    fontSize: 54,
    lineHeight: 62,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.secondary,
    letterSpacing: -1.6,
  },
  headlineCaption: {
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  headlineNote: {
    marginTop: Theme.spacing.xs,
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  trend: {
    paddingBottom: Theme.spacing.xs,
  },
  trendEmpty: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    paddingVertical: Theme.spacing.xxl,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: Theme.spacing.xl,
    paddingTop: Theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.divider,
  },
  statDivider: {
    width: 1,
    backgroundColor: Theme.colors.divider,
    marginHorizontal: Theme.spacing.sm,
  },
  stat: {
    flex: 1,
    height: STAT_COLUMN_HEIGHT,
    alignItems: "center",
    gap: 3,
  },
  statLabel: {
    fontSize: 12.5,
    lineHeight: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    textAlign: "center",
  },
  statValue: {
    marginTop: Theme.spacing.xxs,
    fontSize: 17,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  statChange: {
    fontSize: 12.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  icons: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Theme.spacing.xs,
  },
  iconStacked: {
    marginLeft: ICON_OVERLAP,
  },
});

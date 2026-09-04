import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Theme from "@/constants/theme";
import { useStatsData } from "@/contexts/StatsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { computeStats } from "@/lib/stats/compute";
import { STATS_EVENTS, trackStats } from "@/lib/stats/analytics";
import {
  FREE_PERIODS,
  PERIOD_ORDER,
  periodTitle,
  startOfDay,
} from "@/lib/stats/time";
import type { StatsModel, StatsPeriodId, UsageApp } from "@/lib/stats/types";
import {
  AppUsageCard,
  PeriodNavigator,
  PeriodSelector,
  StatsSkeleton,
  SummaryCard,
} from "@/components/stats";
import { canShowUsageReport } from "@/components/stats/UsageReport";
import LockedPeriod from "@/components/stats/LockedPeriod";

const DEFAULT_PERIOD: StatsPeriodId = "today";

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isReady } = useStatsData();
  const { isPremium } = useSubscription();

  const { period, offset, now, model, title, canGoBack, setPeriod, stepPeriod } =
    useStatsWindow();
  const reportReady = useReportReadyOnFocus(period, isPremium);

  const lockedPeriods = useMemo(
    () => (isPremium ? [] : PERIOD_ORDER.filter((id) => !FREE_PERIODS.includes(id))),
    [isPremium]
  );


  const handleUnlock = useCallback(() => {
    trackStats(STATS_EVENTS.premiumCtaPressed, { period, source: "stats" });
    router.push("/premium");
  }, [period, router]);

  const contentStyle = useMemo(
    () => [styles.content, { paddingBottom: insets.bottom + 48 }],
    [insets.bottom]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        testID="stats-scroll"
      >
        <Text style={styles.title}>Stats</Text>

        <View style={styles.selector}>
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            lockedPeriods={lockedPeriods}
          />
        </View>

        {!isReady ? (
          <StatsSkeleton />
        ) : model.periodLocked ? (
          <LockedPeriod period={period} onUnlock={handleUnlock} />
        ) : (
          <StatsCards
            model={model}
            now={now}
            period={period}
            title={title}
            canGoBack={canGoBack}
            canGoForward={offset < 0}
            reportReady={reportReady}
            onStep={stepPeriod}
          />
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Whether the Screen Time report can draw, re-checked whenever the tab is
 * opened — the answer changes when the user comes back from granting access
 * in Settings. The screen's "viewed" event rides along, since it is the same
 * moment.
 */
function useReportReadyOnFocus(period: StatsPeriodId, isPremium: boolean): boolean {
  const [ready, setReady] = useState(canShowUsageReport);

  useFocusEffect(
    useCallback(() => {
      setReady(canShowUsageReport());
      trackStats(STATS_EVENTS.viewed, { period, isPremium, source: "tab" });
    }, [period, isPremium])
  );

  return ready;
}

interface StatsCardsProps {
  model: StatsModel;
  /** The screen's pinned clock, used to find today's column in the chart. */
  now: number;
  period: StatsPeriodId;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  reportReady: boolean;
  onStep: (step: -1 | 1) => void;
}

/** Everything below the period tabs once there is a window worth drawing. */
const StatsCards = React.memo(function StatsCards({
  model,
  now,
  period,
  title,
  canGoBack,
  canGoForward,
  reportReady,
  onStep,
}: StatsCardsProps) {
  const { setAppDistracting } = useStatsData();

  const handleToggleDistracting = useCallback(
    (app: UsageApp) => {
      Haptics.selectionAsync();
      setAppDistracting(app.appId, !app.distracting);
      // Which app someone wants less of is exactly what stats analytics must
      // not carry, so only the direction of the change is reported.
      trackStats(STATS_EVENTS.appFlagged, {
        period,
        source: app.distracting ? "unflag" : "flag",
      });
    },
    [period, setAppDistracting]
  );

  // The trend chart draws today's column at full strength. -1 from findIndex
  // means the window doesn't contain today, so nothing is highlighted.
  const todayIndex = useMemo(() => {
    const points = model.summary.trend?.series[0]?.points;
    const index = points?.findIndex((point) => point.at === startOfDay(now)) ?? -1;
    return index >= 0 ? index : undefined;
  }, [model.summary.trend, now]);

  return (
    <>
      <PeriodNavigator
        title={title}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onChange={onStep}
      />

      <SummaryCard
        summary={model.summary}
        range={model.period}
        title={title}
        reportReady={reportReady}
        highlightIndex={todayIndex}
      />

      <AppUsageCard
        model={model.appUsage}
        range={model.period}
        reportReady={reportReady}
        onToggleDistracting={handleToggleDistracting}
      />
    </>
  );
});

/**
 * Which window the screen is showing, and everything derived from it. Kept out
 * of the component so the screen itself is only layout and handlers.
 */
function useStatsWindow() {
  const { input } = useStatsData();

  const [period, setStoredPeriod] = useState<StatsPeriodId>(DEFAULT_PERIOD);
  // How far back the shown window is stepped, in the period's own unit.
  const [offset, setOffset] = useState(0);

  // Pinned so window boundaries don't shift under the user mid-scroll; it is
  // refreshed whenever they come back to the tab.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const model = useMemo(
    () => computeStats({ ...input, now }, period, offset),
    [input, now, period, offset]
  );

  // Changing the size of the window drops back to the current one; a week three
  // steps back has no meaningful counterpart in months.
  const setPeriod = useCallback((next: StatsPeriodId) => {
    setStoredPeriod(next);
    setOffset(0);
    trackStats(STATS_EVENTS.periodChanged, { period: next });
  }, []);

  const stepPeriod = useCallback(
    (step: -1 | 1) => {
      setOffset((current) => Math.min(0, current + step));
      trackStats(STATS_EVENTS.periodStepped, {
        period,
        source: step === -1 ? "back" : "forward",
      });
    },
    [period]
  );

  return {
    period,
    offset,
    now,
    model,
    title: periodTitle(model.period, now),
    // Nothing was measured before the account existed, so stepping back stops
    // at the window holding the join date rather than running on forever.
    canGoBack:
      input.joinedAt === null || model.period.start > startOfDay(input.joinedAt),
    setPeriod,
    stepPeriod,
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    paddingHorizontal: Theme.spacing.xxl,
  },
  title: {
    fontSize: 30,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    letterSpacing: -0.6,
    marginTop: Theme.spacing.sm,
  },
  selector: {
    marginTop: Theme.spacing.xl,
  },
});

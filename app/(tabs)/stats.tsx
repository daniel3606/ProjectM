import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Theme from "@/constants/theme";
import { useStatsData } from "@/contexts/StatsContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { computeStats } from "@/lib/stats/compute";
import { acknowledgeRecords } from "@/lib/stats/records";
import {
  STATS_EVENTS,
  trackStats,
  type StatsEventName,
} from "@/lib/stats/analytics";
import { FREE_PERIODS, PERIOD_ORDER, startOfDay } from "@/lib/stats/time";
import type {
  DistractingApp,
  Recommendation,
  StatsModel,
  StatsPeriodId,
} from "@/lib/stats/types";
import {
  DistractionsSection,
  FocusSection,
  GoalSection,
  InsightsSection,
  OverviewPanel,
  PeriodSelector,
  RecommendationSection,
  RecordsSection,
  ReclaimedSection,
  ScreenTimeSection,
  SessionsSection,
  StatsSkeleton,
} from "@/components/stats";
import LockedPeriod from "@/components/stats/LockedPeriod";

const DEFAULT_PERIOD: StatsPeriodId = "week";
const SCROLL_THROTTLE_MS = 16;

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { input, isReady, acknowledgePersonalBests } = useStatsData();
  const { isPremium } = useSubscription();

  const [period, setPeriod] = useState<StatsPeriodId>(DEFAULT_PERIOD);
  const [viewportHeight, setViewportHeight] = useState(0);
  const scrollY = useSharedValue(0);

  // Pinned so period boundaries don't shift under the user mid-scroll; it is
  // refreshed whenever they come back to the tab.
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      trackStats(STATS_EVENTS.viewed, { period, isPremium, source: "tab" });
    }, [period, isPremium])
  );

  const model = useMemo(
    () => computeStats({ ...input, now }, period),
    [input, now, period]
  );

  const lockedPeriods = useMemo(
    () => (isPremium ? [] : PERIOD_ORDER.filter((id) => !FREE_PERIODS.includes(id))),
    [isPremium]
  );

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const handlePeriodChange = useCallback((next: StatsPeriodId) => {
    setPeriod(next);
    scrollY.value = 0;
    trackStats(STATS_EVENTS.periodChanged, { period: next });
  }, [scrollY]);

  const handleUnlock = useCallback(() => {
    trackStats(STATS_EVENTS.premiumCtaPressed, { period, source: "stats" });
    router.push("/onboarding-premium");
  }, [period, router]);

  const handleSeeAllApps = useCallback(() => {
    trackStats(STATS_EVENTS.appBreakdownOpened, { period, source: "see-all" });
    router.push({ pathname: "/stats/apps", params: { period } });
  }, [period, router]);

  const handleSelectApp = useCallback(
    (app: DistractingApp) => {
      Haptics.selectionAsync();
      trackStats(STATS_EVENTS.appBreakdownOpened, {
        period,
        source: "row",
        itemId: app.appId,
      });
      router.push({ pathname: "/stats/apps", params: { period, focus: app.appId } });
    },
    [period, router]
  );

  const handleRecommendation = useCallback(
    (recommendation: Recommendation) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      trackStats(STATS_EVENTS.recommendationActioned, {
        period,
        itemId: recommendation.action.id,
      });
      const { draft } = recommendation.action;
      router.push({
        pathname: "/(tabs)/timed-block",
        params: {
          draftLabel: draft.label,
          draftStartHour: String(draft.startHour),
          draftEndHour: String(draft.endHour),
          draftDays: draft.daysOfWeek.join(","),
          draftSource: "stats-recommendation",
        },
      });
    },
    [period, router]
  );

  // Guards the haptic against replaying: the bests are marked seen the moment
  // the grid appears, and `computeRecords` only flags what beats what's stored.
  const acknowledgedRef = useRef(false);
  const handleRecordsRevealed = useCallback(() => {
    if (acknowledgedRef.current) return;
    acknowledgedRef.current = true;

    if (model.records.newlySet.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    trackStats(STATS_EVENTS.personalBestViewed, {
      period,
      itemId: model.records.newlySet[0],
    });
    acknowledgePersonalBests(acknowledgeRecords(model.records.bests, now));
  }, [model.records, period, now, acknowledgePersonalBests]);

  useSectionImpressions(model, period, isReady);

  const todayIndex = useMemo(
    () => model.focus.series.findIndex((point) => point.at === startOfDay(now)),
    [model.focus.series, now]
  );

  const contentStyle = useMemo(
    () => [styles.content, { paddingBottom: insets.bottom + 48 }],
    [insets.bottom]
  );

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top }]}
      onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
    >
      <Animated.ScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={SCROLL_THROTTLE_MS}
        testID="stats-scroll"
      >
        <Text style={styles.title}>Stats</Text>

        <View style={styles.selector}>
          <PeriodSelector
            value={period}
            onChange={handlePeriodChange}
            lockedPeriods={lockedPeriods}
          />
        </View>

        {!isReady ? (
          <StatsSkeleton />
        ) : model.periodLocked ? (
          <LockedPeriod period={period} onUnlock={handleUnlock} />
        ) : (
          <>
            <OverviewPanel overview={model.overview} period={period} />

            <ScreenTimeSection model={model.screenTime} period={period} />

            <FocusSection
              model={model.focus}
              range={model.period}
              highlightIndex={todayIndex >= 0 ? todayIndex : undefined}
            />

            <ReclaimedSection
              model={model.reclaimed}
              range={model.period}
              scrollY={scrollY}
              viewportHeight={viewportHeight}
            />

            <DistractionsSection
              model={model.distractions}
              onSeeAll={handleSeeAllApps}
              onSelectApp={handleSelectApp}
            />

            <GoalSection model={model.goal} animationKey={period} />

            <SessionsSection model={model.sessions} />

            <RecordsSection
              model={model.records}
              scrollY={scrollY}
              viewportHeight={viewportHeight}
              onReveal={handleRecordsRevealed}
            />

            <InsightsSection model={model.insights} onUnlock={handleUnlock} />

            <RecommendationSection
              recommendation={model.recommendation}
              onAction={handleRecommendation}
            />
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * Fires the once-per-period impression events. Deduped by a key set so a
 * re-render, a scroll or a return to the tab doesn't resend them.
 */
function useSectionImpressions(
  model: StatsModel,
  period: StatsPeriodId,
  isReady: boolean
) {
  const sent = useRef(new Set<string>());

  useEffect(() => {
    if (!isReady || model.periodLocked) return;

    const send = (name: StatsEventName, key: string, props: Parameters<typeof trackStats>[1]) => {
      const dedupeKey = `${name}:${key}`;
      if (sent.current.has(dedupeKey)) return;
      sent.current.add(dedupeKey);
      trackStats(name, props);
    };

    if (model.goal.unavailable === null) {
      send(STATS_EVENTS.goalViewed, period, { period, hasData: true });
    }
    if (model.insights.locked) {
      send(STATS_EVENTS.premiumInsightPreviewed, period, { period, isPremium: false });
    }
    if (model.recommendation) {
      send(STATS_EVENTS.recommendationViewed, model.recommendation.action.id, {
        period,
        itemId: model.recommendation.action.id,
      });
    }
  }, [model, period, isReady]);
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

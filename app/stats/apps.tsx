import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Theme from "@/constants/theme";
import { useStatsData } from "@/contexts/StatsContext";
import { computeStats } from "@/lib/stats/compute";
import { formatMinutes, formatPercent } from "@/lib/stats/format";
import { formatHourWindow, periodCaption } from "@/lib/stats/time";
import type { DistractingApp, StatsPeriodId } from "@/lib/stats/types";
import EmptyState from "@/components/stats/EmptyState";
import LockedPeriod from "@/components/stats/LockedPeriod";

const FALLBACK_PERIOD: StatsPeriodId = "week";

/**
 * The full ranking behind "See all". Detail per app lives here rather than on
 * the Stats screen, which stays a summary.
 */
export default function AppBreakdownScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ period?: string; focus?: string }>();
  const { input } = useStatsData();

  const period = (params.period as StatsPeriodId) ?? FALLBACK_PERIOD;
  const [now] = useState(() => Date.now());
  const [expandedId, setExpandedId] = useState<string | null>(params.focus ?? null);

  const model = useMemo(
    () => computeStats({ ...input, now }, period),
    [input, now, period]
  );

  const handleToggle = useCallback((appId: string) => {
    Haptics.selectionAsync();
    setExpandedId((current) => (current === appId ? null : appId));
  }, []);

  const contentStyle = useMemo(
    () => [styles.content, { paddingBottom: insets.bottom + 32 }],
    [insets.bottom]
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "App Breakdown",
          headerBackTitle: "Stats",
          headerStyle: { backgroundColor: Theme.colors.background },
          headerTitleStyle: {
            fontFamily: Theme.fonts.semibold,
            color: Theme.colors.text,
          },
          headerTintColor: Theme.colors.secondary,
        }}
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.caption}>{periodCaption(period)}</Text>

        {model.periodLocked ? (
          <LockedPeriod
            period={period}
            onUnlock={() => {
              router.push("/premium");
            }}
          />
        ) : model.distractions.unavailable ? (
          <EmptyState
            icon="apps-outline"
            title="Nothing to break down yet"
            body="App-level usage will appear here once there's enough of it to rank."
          />
        ) : (
          <View style={styles.list}>
            {model.distractions.apps.map((app, index) => (
              <AppRow
                key={app.appId}
                app={app}
                rank={index + 1}
                expanded={expandedId === app.appId}
                onToggle={handleToggle}
              />
            ))}
          </View>
        )}

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.done, pressed && styles.donePressed]}
          testID="stats-apps-done"
        >
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

interface AppRowProps {
  app: DistractingApp;
  rank: number;
  expanded: boolean;
  onToggle: (appId: string) => void;
}

const AppRow = React.memo(function AppRow({
  app,
  rank,
  expanded,
  onToggle,
}: AppRowProps) {
  const handlePress = useCallback(() => onToggle(app.appId), [onToggle, app.appId]);

  return (
    <Pressable
      onPress={handlePress}
      testID={`stats-app-row-${app.appId}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.rank}>{rank}</Text>
        <Text style={styles.appLabel} numberOfLines={1}>
          {app.label}
        </Text>
        <Text style={styles.appMinutes}>{formatMinutes(app.minutes)}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={15}
          color={Theme.colors.textSecondary}
        />
      </View>

      {expanded ? (
        <View style={styles.detail}>
          <DetailRow
            label="Average per day"
            value={formatMinutes(app.averageMinutesPerDay)}
          />
          <DetailRow label="Change vs previous period" value={changeLabel(app)} />
          <DetailRow
            label="Most active window"
            value={
              app.peakHour === null
                ? "Not enough data"
                : formatHourWindow(app.peakHour, app.peakHour + 1)
            }
          />
          <DetailRow
            label="Blocked by focus sessions"
            value={
              app.blockedMinutes > 0 ? formatMinutes(app.blockedMinutes) : "None yet"
            }
          />
        </View>
      ) : null}
    </Pressable>
  );
});

function changeLabel(app: DistractingApp): string {
  if (!app.delta || app.delta.percent === null) return "No comparison yet";
  const rounded = Math.round(app.delta.percent * 100);
  if (rounded === 0) return "No change";
  return `${rounded > 0 ? "↑" : "↓"} ${formatPercent(Math.abs(app.delta.percent))}`;
}

const DetailRow = React.memo(function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    paddingHorizontal: Theme.spacing.xxl,
    paddingTop: Theme.spacing.lg,
  },
  caption: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginBottom: Theme.spacing.lg,
  },
  list: {
    gap: Theme.spacing.sm,
  },
  row: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  rank: {
    width: 16,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  appLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  appMinutes: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  detail: {
    marginTop: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.divider,
    gap: Theme.spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Theme.spacing.lg,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  done: {
    marginTop: Theme.spacing.xxxl,
    alignItems: "center",
    paddingVertical: Theme.spacing.md,
  },
  donePressed: {
    opacity: 0.6,
  },
  doneLabel: {
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
  },
});

import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import { formatMinutes, formatPercent } from "@/lib/stats/format";
import type { DistractingApp, DistractionsModel } from "@/lib/stats/types";
import EmptyState from "./EmptyState";
import StatsSection from "./StatsSection";

/** The main screen stays a summary; the rest live behind "See all". */
const PREVIEW_COUNT = 3;

interface DistractionsSectionProps {
  model: DistractionsModel;
  onSeeAll: () => void;
  onSelectApp: (app: DistractingApp) => void;
}

export default function DistractionsSection({
  model,
  onSeeAll,
  onSelectApp,
}: DistractionsSectionProps) {
  if (model.unavailable) {
    return (
      <StatsSection title="Top Distractions">
        {model.unavailable === "no-source" ? (
          <EmptyState
            icon="apps-outline"
            title="App usage isn't connected yet"
            body="When Marshmallow can see per-app usage, your biggest pulls will be ranked here."
          />
        ) : (
          <EmptyState
            icon="apps-outline"
            title="Nothing stands out yet"
            body="A few more days of usage and your top distractions will appear."
          />
        )}
      </StatsSection>
    );
  }

  const preview = model.apps.slice(0, PREVIEW_COUNT);
  const hasMore = model.apps.length > preview.length;

  return (
    <StatsSection
      title="Top Distractions"
      actionLabel={hasMore ? "See all" : undefined}
      onActionPress={hasMore ? onSeeAll : undefined}
    >
      <View style={styles.list}>
        {preview.map((app, index) => (
          <DistractionRow
            key={app.appId}
            app={app}
            rank={index + 1}
            share={model.totalMinutes > 0 ? app.minutes / model.totalMinutes : 0}
            onPress={onSelectApp}
          />
        ))}
      </View>
    </StatsSection>
  );
}

interface DistractionRowProps {
  app: DistractingApp;
  rank: number;
  share: number;
  onPress: (app: DistractingApp) => void;
}

export const DistractionRow = React.memo(function DistractionRow({
  app,
  rank,
  share,
  onPress,
}: DistractionRowProps) {
  const handlePress = useCallback(() => onPress(app), [onPress, app]);
  const changeText = changeLabel(app);

  return (
    <Pressable
      onPress={handlePress}
      testID={`stats-distraction-${app.appId}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.rank}>{rank}</Text>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.appLabel} numberOfLines={1}>
            {app.label}
          </Text>
          <Text style={styles.appMinutes}>{formatMinutes(app.minutes)}</Text>
        </View>

        <View style={styles.rowBottom}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
          </View>
          {changeText ? (
            <Text
              style={[
                styles.change,
                app.delta?.tone === "positive" && styles.changePositive,
                app.delta?.tone === "negative" && styles.changeNegative,
              ]}
            >
              {changeText}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

function changeLabel(app: DistractingApp): string | null {
  if (!app.delta || app.delta.percent === null) return null;
  const rounded = Math.round(app.delta.percent * 100);
  if (rounded === 0) return null;
  return `${rounded > 0 ? "↑" : "↓"} ${formatPercent(Math.abs(app.delta.percent))}`;
}

const styles = StyleSheet.create({
  list: {
    gap: Theme.spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Theme.spacing.md,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rank: {
    width: 16,
    paddingTop: 1,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  rowBody: {
    flex: 1,
    gap: Theme.spacing.sm,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Theme.spacing.md,
  },
  appLabel: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  appMinutes: {
    fontSize: 15.5,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.track,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Theme.colors.secondaryLight,
  },
  change: {
    minWidth: 46,
    textAlign: "right",
    fontSize: 12.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  changePositive: {
    color: Theme.colors.positive,
  },
  changeNegative: {
    color: Theme.colors.attention,
  },
});

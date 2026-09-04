import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import type { AppUsageModel, PeriodRange, UsageApp } from "@/lib/stats/types";
import AppIcon from "./AppIcon";
import EmptyState from "./EmptyState";
import StatsSection from "./StatsSection";
import UsageReport, {
  REPORT_ROW_HEIGHT,
  REPORT_ROWS,
  USAGE_REPORT,
} from "./UsageReport";

const ROW_ICON = 38;
const FLAG_BUTTON = 30;

interface AppUsageCardProps {
  model: AppUsageModel;
  /** The window being shown, which the Screen Time report is filtered to. */
  range: PeriodRange;
  /** True when the Screen Time report can draw the list only iOS can fill. */
  reportReady: boolean;
  /** Adds or removes an app from the user's distracting list. */
  onToggleDistracting: (app: UsageApp) => void;
}

/**
 * The period's per-app usage, ranked like the Screen Time list it mirrors.
 * Each row can be flagged as distracting, which is what feeds the blocks the
 * rest of the app builds.
 */
export default function AppUsageCard({
  model,
  range,
  reportReady,
  onToggleDistracting,
}: AppUsageCardProps) {
  // Where iOS will hand over real figures, it draws the list itself — the
  // numbers cannot reach this process, so neither can the rows.
  if (reportReady) {
    return <ReportedUsage range={range} />;
  }

  if (model.unavailable) {
    return (
      <StatsSection title="App Usage" style={styles.section}>
        {model.unavailable === "no-source" ? (
          <EmptyState
            icon="apps-outline"
            title="App usage isn't connected yet"
            body="Once Marshmallow can read per-app screen time, every app you used will be listed here."
          />
        ) : (
          <EmptyState
            icon="apps-outline"
            title="Nothing to list yet"
            body="Your apps will appear here as soon as there's usage to rank."
          />
        )}
      </StatsSection>
    );
  }

  return (
    <StatsSection title="App Usage" style={styles.section}>
      <View style={styles.card}>
        {model.apps.map((app, index) => (
          <AppUsageRow
            key={app.appId}
            app={app}
            showDivider={index > 0}
            onToggleDistracting={onToggleDistracting}
          />
        ))}
      </View>
    </StatsSection>
  );
}

/**
 * The Screen Time report standing in for the list. Rows are drawn by the
 * extension, so the only thing left here is reserving their height.
 */
const ReportedUsage = React.memo(function ReportedUsage({
  range,
}: {
  range: PeriodRange;
}) {
  return (
    <StatsSection title="App Usage" style={styles.section}>
      <View style={styles.card}>
        <UsageReport
          context={USAGE_REPORT.appUsageList}
          range={range}
          height={REPORT_ROWS * REPORT_ROW_HEIGHT}
        />
      </View>
    </StatsSection>
  );
});

interface AppUsageRowProps {
  app: UsageApp;
  showDivider: boolean;
  onToggleDistracting: (app: UsageApp) => void;
}

export const AppUsageRow = React.memo(function AppUsageRow({
  app,
  showDivider,
  onToggleDistracting,
}: AppUsageRowProps) {
  const handleToggle = useCallback(
    () => onToggleDistracting(app),
    [onToggleDistracting, app]
  );

  return (
    <View style={[styles.row, showDivider && styles.rowDivided]}>
      <AppIcon
        token={app.token}
        itemType={app.itemType}
        label={app.label}
        size={ROW_ICON}
      />

      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>
          {app.label}
        </Text>

        <View style={styles.meter}>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.max(2, Math.round(app.share * 100))}%` }]}
            />
          </View>
          <Text style={styles.minutes}>{app.display}</Text>
        </View>
      </View>

      <Pressable
        onPress={handleToggle}
        hitSlop={8}
        testID={`stats-flag-${app.appId}`}
        accessibilityRole="button"
        accessibilityState={{ selected: app.distracting }}
        accessibilityLabel={
          app.distracting
            ? `Remove ${app.label} from your distracting apps`
            : `Add ${app.label} to your distracting apps`
        }
        style={({ pressed }) => [
          styles.flag,
          app.distracting && styles.flagOn,
          pressed && styles.flagPressed,
        ]}
      >
        <Ionicons
          name={app.distracting ? "checkmark" : "add"}
          size={17}
          color={app.distracting ? Theme.colors.white : Theme.colors.secondary}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginTop: Theme.spacing.xxxl,
  },
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xxl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    paddingHorizontal: Theme.spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  rowDivided: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.divider,
  },
  body: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  label: {
    fontSize: 15.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  meter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
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
  minutes: {
    minWidth: 56,
    textAlign: "right",
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  flag: {
    width: FLAG_BUTTON,
    height: FLAG_BUTTON,
    borderRadius: FLAG_BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    backgroundColor: Theme.colors.background,
  },
  flagOn: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  flagPressed: {
    opacity: 0.6,
  },
});

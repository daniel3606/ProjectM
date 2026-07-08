import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import {
  useTimedBlockPlans,
  type TimedBlockPlan,
} from "@/contexts/TimedBlockPlansContext";
import { ensureScreenTimeAuthorized } from "@/lib/screenTimeAuth";
import * as ScreenTime from "@/modules/screen-time";
import {
  formatDuration,
  formatTimeRemaining,
  getGrowthForDuration,
} from "@/constants/marshmallow";
import TimedBlockPlanSheet from "@/components/TimedBlockPlanSheet";

function appsSummaryText(summary: TimedBlockPlan["appsSummary"]): string {
  const parts = [
    summary.appCount > 0 && `${summary.appCount} app${summary.appCount !== 1 ? "s" : ""}`,
    summary.catCount > 0 && `${summary.catCount} categor${summary.catCount !== 1 ? "ies" : "y"}`,
    summary.webCount > 0 && `${summary.webCount} web domain${summary.webCount !== 1 ? "s" : ""}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Everything";
}

export default function TimedBlockScreen() {
  const insets = useSafeAreaInsets();
  const { activeSession, startSession, stopSession, history } = useFocusSession();
  const { plans, addPlan, removePlan } = useTimedBlockPlans();
  const planSheetRef = useRef<BottomSheetModal>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!activeSession) return;
    const endsAt = activeSession.startedAt + activeSession.durationMinutes * 60_000;
    const tick = () => setRemainingMs(Math.max(0, endsAt - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleEndBlock = useCallback(async () => {
    try {
      await ScreenTime.clearBlocking();
      stopSession();
    } catch (error) {
      Alert.alert("Error", `Failed to end block: ${error}`);
    }
  }, [stopSession]);

  const handleStartPlan = useCallback(
    async (plan: TimedBlockPlan) => {
      const authorized = await ensureScreenTimeAuthorized();
      if (!authorized) return;

      setIsStarting(true);
      try {
        if (plan.appIds.length > 0) {
          await ScreenTime.applyBlocking(plan.appIds);
        } else {
          await ScreenTime.blockAll();
        }
        startSession({
          durationMinutes: plan.durationMinutes,
          focusMode: plan.focusMode,
          expectedGrowthCm: getGrowthForDuration(plan.durationMinutes, plan.focusMode),
        });
      } catch (error) {
        Alert.alert("Error", `Failed to start block: ${error}`);
      } finally {
        setIsStarting(false);
      }
    },
    [startSession]
  );

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Timed Block</Text>
      <Text style={styles.subtitle}>Plan blocks ahead, start them when you&apos;re ready</Text>

      {activeSession && (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>Block in progress</Text>
          <Text style={styles.activeTime}>{formatTimeRemaining(remainingMs)}</Text>
          <Text style={styles.activeDesc}>
            {formatDuration(activeSession.durationMinutes)} ·{" "}
            {activeSession.focusMode === "deep" ? "Deep Focus" : "Flexible"} · +
            {activeSession.expectedGrowthCm}cm
          </Text>
          <Pressable
            onPress={handleEndBlock}
            style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}
          >
            <Ionicons name="stop-circle-outline" size={18} color={Theme.colors.white} />
            <Text style={styles.endButtonText}>End Block</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Saved Blocks</Text>
        <Pressable
          onPress={() => planSheetRef.current?.present()}
          hitSlop={8}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons name="add-circle" size={26} color={Theme.colors.secondary} />
        </Pressable>
      </View>

      {plans.length === 0 ? (
        <Text style={styles.emptyText}>No saved blocks yet. Tap + to create one.</Text>
      ) : (
        plans.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planInfo}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planMeta}>
                {formatDuration(plan.durationMinutes)} ·{" "}
                {plan.focusMode === "deep" ? "Deep Focus" : "Flexible"} ·{" "}
                {appsSummaryText(plan.appsSummary)}
              </Text>
            </View>
            <View style={styles.planActions}>
              <Pressable
                onPress={() => handleStartPlan(plan)}
                disabled={!!activeSession || isStarting}
                style={({ pressed }) => [
                  styles.startButton,
                  (!!activeSession || isStarting) && styles.startButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="play" size={16} color={Theme.colors.white} />
              </Pressable>
              <Pressable onPress={() => removePlan(plan.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={Theme.colors.gray} />
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>History</Text>
      {history.length === 0 ? (
        <Text style={styles.emptyText}>No completed blocks yet.</Text>
      ) : (
        history.map((entry, i) => (
          <View key={i} style={styles.historyRow}>
            <Ionicons name="checkmark-circle" size={18} color={Theme.colors.success} />
            <Text style={styles.historyText}>
              {formatDuration(entry.durationMinutes)} ·{" "}
              {entry.focusMode === "deep" ? "Deep Focus" : "Flexible"} · +
              {entry.expectedGrowthCm}cm
            </Text>
            <Text style={styles.historyDate}>
              {new Date(entry.completedAt).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}

      <TimedBlockPlanSheet sheetRef={planSheetRef} onSave={addPlan} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  activeCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Theme.colors.secondary,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
  },
  activeLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activeTime: {
    fontSize: 36,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: 6,
  },
  activeDesc: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  endButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Theme.colors.danger,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  endButtonText: {
    fontSize: 15,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  addButton: {},
  emptyText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    marginBottom: 8,
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  planMeta: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  planActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  startButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  startButtonDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.cardBorder,
  },
  historyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  historyDate: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
});

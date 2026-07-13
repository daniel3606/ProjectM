import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import {
  useTimedBlockPlans,
  type TimedBlockPlan,
} from "@/contexts/TimedBlockPlansContext";
import * as ScreenTime from "@/modules/screen-time";
import {
  DAY_LABELS_FULL,
  formatClockTime,
  formatTimeRemaining,
} from "@/constants/marshmallow";
import TimedBlockPlanSheet from "@/components/TimedBlockPlanSheet";
import { Screen, ScreenTitle, ScreenSubtitle, Card, SelectableCard, Button } from "@/components/ui";

export default function TimedBlockScreen() {
  const { activeSession, stopSession } = useFocusSession();
  const { plans, addPlan, updatePlan, removePlan, setPlanEnabled } = useTimedBlockPlans();
  const planSheetRef = useRef<BottomSheetModal>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [editingPlan, setEditingPlan] = useState<TimedBlockPlan | null>(null);

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

  const handleAddPlan = useCallback(() => {
    setEditingPlan(null);
    planSheetRef.current?.present();
  }, []);

  const handleEditPlan = useCallback((plan: TimedBlockPlan) => {
    setEditingPlan(plan);
    planSheetRef.current?.present();
  }, []);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <ScreenTitle style={styles.title}>Timed Block</ScreenTitle>
          <ScreenSubtitle style={styles.subtitle}>
            Plan blocks ahead, start them when you&apos;re ready
          </ScreenSubtitle>
        </View>
        <Pressable
          onPress={handleAddPlan}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="add-circle" size={30} color={Theme.colors.secondary} />
        </Pressable>
      </View>

      {activeSession && (
        <Card style={styles.activeCard}>
          <Text style={styles.activeLabel}>Block in progress</Text>
          <Text style={styles.activeTime}>{formatTimeRemaining(remainingMs)}</Text>
          <Text style={styles.activeDesc}>
            {activeSession.focusMode === "deep" ? "Deep Focus" : "Flexible"} · +
            {activeSession.expectedGrowthCm}cm
          </Text>
          <Button
            variant="danger"
            onPress={handleEndBlock}
            icon="stop-circle-outline"
            iconSize={18}
            label="End Block"
            style={styles.endButton}
          />
        </Card>
      )}

      {plans.length === 0 ? (
        <Text style={styles.emptyText}>No blocks yet. Tap + to create one.</Text>
      ) : (
        plans.map((plan) => (
          <SelectableCard
            key={plan.id}
            onLongPress={() => handleEditPlan(plan)}
            style={styles.planCard}
          >
            <View style={styles.planInfo}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planMeta}>
                {DAY_LABELS_FULL[plan.dayOfWeek]} ·{" "}
                {formatClockTime(plan.startHour, plan.startMinute)} –{" "}
                {formatClockTime(plan.endHour, plan.endMinute)}
              </Text>
            </View>
            <Switch
              value={plan.enabled}
              onValueChange={(value) => setPlanEnabled(plan.id, value)}
              trackColor={{ false: Theme.colors.cardBorder, true: Theme.colors.secondary }}
              thumbColor={Theme.colors.white}
            />
          </SelectableCard>
        ))
      )}

      <TimedBlockPlanSheet
        sheetRef={planSheetRef}
        editingPlan={editingPlan}
        onSave={addPlan}
        onUpdate={updatePlan}
        onDelete={removePlan}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
  },
  subtitle: {
    maxWidth: 260,
  },
  activeCard: {
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
    marginTop: 16,
  },
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
    borderWidth: 1,
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
  pressed: {
    opacity: 0.7,
  },
});

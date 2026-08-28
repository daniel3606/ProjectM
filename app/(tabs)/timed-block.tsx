import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Theme from "@/constants/theme";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  useTimedBlockPlans,
  type TimedBlockPlan,
} from "@/contexts/TimedBlockPlansContext";
import {
  formatClockTime,
  formatDaysOfWeek,
  formatDuration,
  formatTimeRemaining,
  getGrowthForDuration,
} from "@/constants/marshmallow";
import TimedBlockPlanSheet, {
  type TimedBlockPlanDraft,
} from "@/components/TimedBlockPlanSheet";
import EndSessionConfirmModal from "@/components/EndSessionConfirmModal";
import NameGateModal from "@/components/NameGateModal";
import EditBlockSheet from "@/components/EditBlockSheet";
import { Screen, ScreenTitle, ScreenSubtitle, Card, SelectableCard, Button } from "@/components/ui";
import { useEditBlockFlow } from "@/lib/useEditBlockFlow";
import { STATS_EVENTS, trackStats } from "@/lib/stats/analytics";

const SWITCH_TRACK_COLOR = {
  false: Theme.colors.cardBorder,
  true: Theme.colors.secondary,
} as const;

interface PlanDraftParams {
  draftLabel?: string;
  draftStartHour?: string;
  draftEndHour?: string;
  draftDays?: string;
  draftSource?: string;
}

/**
 * Reads the prefill a Stats recommendation navigated here with. Returns null
 * for a plain visit, so the sheet only opens when a draft was actually passed.
 */
function draftFromParams(params: PlanDraftParams): TimedBlockPlanDraft | null {
  const { draftLabel, draftStartHour, draftEndHour, draftDays } = params;
  if (!draftLabel || draftStartHour === undefined || draftEndHour === undefined) {
    return null;
  }

  const startHour = Number(draftStartHour);
  const endHour = Number(draftEndHour);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return null;

  const daysOfWeek = (draftDays ?? "")
    .split(",")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return {
    label: draftLabel,
    startHour,
    endHour,
    daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [new Date().getDay()],
  };
}

interface PlanCardProps {
  plan: TimedBlockPlan;
  onEdit: (plan: TimedBlockPlan) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

const PlanCard = React.memo(function PlanCard({ plan, onEdit, onToggle }: PlanCardProps) {
  const handleLongPress = useCallback(() => onEdit(plan), [onEdit, plan]);
  const handleToggle = useCallback(
    (value: boolean) => onToggle(plan.id, value),
    [onToggle, plan.id]
  );

  return (
    <SelectableCard
      onLongPress={handleLongPress}
      style={styles.planCard}
      testID={`plan-card-${plan.id}`}
    >
      <View style={[styles.planBody, !plan.enabled && styles.planBodyOff]}>
        <View style={styles.planTopRow}>
          <View style={styles.planInfo}>
            <Text style={styles.planLabel} numberOfLines={1}>
              {plan.label}
            </Text>
            <Text style={styles.planTime}>
              {formatClockTime(plan.startHour, plan.startMinute)} –{" "}
              {formatClockTime(plan.endHour, plan.endMinute)}
            </Text>
          </View>
          <Switch
            value={plan.enabled}
            onValueChange={handleToggle}
            trackColor={SWITCH_TRACK_COLOR}
            thumbColor={Theme.colors.white}
          />
        </View>

        <Text style={styles.planDays}>{formatDaysOfWeek(plan.daysOfWeek)}</Text>

        <View style={styles.planDivider} />

        <View style={styles.planStats}>
          <PlanStat icon="time-outline" text={formatDuration(plan.durationMinutes)} />
          <PlanStat
            icon="trending-up-outline"
            text={`+${getGrowthForDuration(plan.durationMinutes, plan.focusMode)}cm`}
          />
          <PlanStat
            icon="apps-outline"
            text={
              plan.appIds.length > 0 ? `${plan.appIds.length} blocked` : "All apps"
            }
          />
        </View>
      </View>
    </SelectableCard>
  );
});

function PlanStat({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={styles.planStat}>
      <Ionicons name={icon} size={14} color={Theme.colors.textSecondary} />
      <Text style={styles.planStatText}>{text}</Text>
    </View>
  );
}

export default function TimedBlockScreen() {
  const router = useRouter();
  const { activeSession, stopSession } = useFocusSession();
  const profile = useMarshmallowProfile();
  const { plans, planLimit, canAddPlan, addPlan, updatePlan, removePlan, setPlanEnabled } =
    useTimedBlockPlans();
  const { isPremium } = useSubscription();
  const planSheetRef = useRef<BottomSheetModal>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [editingPlan, setEditingPlan] = useState<TimedBlockPlan | null>(null);
  const [isEndConfirmVisible, setIsEndConfirmVisible] = useState(false);

  const params = useLocalSearchParams() as PlanDraftParams;
  const [draft, setDraft] = useState<TimedBlockPlanDraft | null>(null);
  const draftSourceRef = useRef<string | null>(null);
  const handledDraftRef = useRef<string | null>(null);

  const {
    editBlockSheetRef,
    isEditGateVisible,
    openEditGate,
    cancelEditGate,
    confirmEditGate,
    saveEditedBlock,
  } = useEditBlockFlow();

  // Opens the sheet prefilled when Stats sends the user here with a suggested
  // window. Keyed on the params so returning to the tab doesn't reopen it.
  useEffect(() => {
    const key = `${params.draftLabel ?? ""}-${params.draftStartHour ?? ""}-${params.draftSource ?? ""}`;
    if (handledDraftRef.current === key) return;

    const next = draftFromParams(params);
    if (!next) return;

    handledDraftRef.current = key;
    draftSourceRef.current = params.draftSource ?? null;
    setEditingPlan(null);
    setDraft(next);
    planSheetRef.current?.present();
  }, [params]);

  const handleSavePlan = useCallback(
    (plan: Omit<TimedBlockPlan, "id">) => {
      addPlan(plan);
      if (draftSourceRef.current === "stats-recommendation") {
        trackStats(STATS_EVENTS.scheduleCreatedFromInsight, {
          source: draftSourceRef.current,
        });
      }
      draftSourceRef.current = null;
      setDraft(null);
    },
    [addPlan]
  );

  useEffect(() => {
    if (!activeSession) return;
    const endsAt = activeSession.startedAt + activeSession.durationMinutes * 60_000;
    const tick = () => setRemainingMs(Math.max(0, endsAt - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleEndBlock = useCallback(() => {
    setIsEndConfirmVisible(true);
  }, []);

  const handleConfirmEndBlock = useCallback(() => {
    setIsEndConfirmVisible(false);
    stopSession();
  }, [stopSession]);

  const handleAddPlan = useCallback(() => {
    if (!canAddPlan) {
      router.push("/onboarding-premium");
      return;
    }
    setEditingPlan(null);
    setDraft(null);
    planSheetRef.current?.present();
  }, [canAddPlan, router]);

  const handleEditPlan = useCallback((plan: TimedBlockPlan) => {
    setDraft(null);
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
          testID="add-block-button"
        >
          <Ionicons
            name={canAddPlan ? "add-circle" : "lock-closed"}
            size={canAddPlan ? 30 : 24}
            color={Theme.colors.secondary}
          />
        </Pressable>
      </View>

      {activeSession?.planId && (
        <Card style={styles.activeCard}>
          <Text style={styles.activeLabel}>Block in progress</Text>
          <Text style={styles.activeTime}>{formatTimeRemaining(remainingMs)}</Text>
          <Text style={styles.activeDesc}>
            {activeSession.focusMode === "deep" ? "Deep Focus" : "Flexible"} · +
            {activeSession.expectedGrowthCm}cm
          </Text>
          <View style={styles.activeCardActions}>
            <Button
              variant="outline"
              onPress={openEditGate}
              icon="create-outline"
              iconSize={16}
              label="Edit Block"
              style={styles.actionButton}
            />
            <Button
              variant="danger"
              onPress={handleEndBlock}
              icon="stop-circle-outline"
              iconSize={18}
              label="End Block"
              style={styles.actionButton}
            />
          </View>
        </Card>
      )}

      {activeSession && !activeSession.planId && (
        <Card style={styles.quickBlockNoticeCard}>
          <Text style={styles.quickBlockNoticeText}>
            A Quick Block is active — manage it from Home
          </Text>
        </Card>
      )}

      {plans.length === 0 ? (
        <Text style={styles.emptyText}>No blocks yet. Tap + to create one.</Text>
      ) : (
        plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={handleEditPlan}
            onToggle={setPlanEnabled}
          />
        ))
      )}

      {canAddPlan ? (
        <SelectableCard
          onPress={handleAddPlan}
          style={styles.addCard}
          testID="add-block-card"
        >
          <Ionicons name="add" size={20} color={Theme.colors.secondary} />
          <Text style={styles.addCardText}>New block</Text>
        </SelectableCard>
      ) : (
        <SelectableCard
          onPress={handleAddPlan}
          style={styles.upgradeCard}
          testID="upgrade-blocks-card"
        >
          <Ionicons name="lock-closed" size={18} color={Theme.colors.secondary} />
          <View style={styles.upgradeTextGroup}>
            <Text style={styles.upgradeTitle}>
              {planLimit} scheduled blocks on the free plan
            </Text>
            <Text style={styles.upgradeDesc}>Go Premium for unlimited blocks</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Theme.colors.gray} />
        </SelectableCard>
      )}

      {!isPremium && plans.length > 0 && (
        <Text style={styles.limitCount}>
          {plans.length} of {planLimit} blocks used
        </Text>
      )}

      <TimedBlockPlanSheet
        sheetRef={planSheetRef}
        editingPlan={editingPlan}
        draft={draft}
        onSave={handleSavePlan}
        onUpdate={updatePlan}
        onDelete={removePlan}
      />

      <EndSessionConfirmModal
        visible={isEndConfirmVisible}
        marshmallowName={profile.name}
        onConfirm={handleConfirmEndBlock}
        onCancel={() => setIsEndConfirmVisible(false)}
      />

      <NameGateModal
        visible={isEditGateVisible}
        marshmallowName={profile.name}
        title="Edit Block?"
        subtitle="Type in your marshmallow's name to edit this block"
        confirmLabel="Edit Block"
        confirmVariant="primary"
        onConfirm={confirmEditGate}
        onCancel={cancelEditGate}
      />

      <EditBlockSheet
        sheetRef={editBlockSheetRef}
        session={activeSession}
        onSave={saveEditedBlock}
        onCancelBlock={handleEndBlock}
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
  activeCardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
  },
  quickBlockNoticeCard: {
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  quickBlockNoticeText: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    marginBottom: 8,
  },
  planCard: {
    borderWidth: 1,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.lg,
  },
  planBody: {
    gap: Theme.spacing.xs,
  },
  planBodyOff: {
    opacity: 0.45,
  },
  planTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  planInfo: {
    flex: 1,
    marginRight: Theme.spacing.md,
  },
  planLabel: {
    fontSize: 17,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  planTime: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: Theme.spacing.xxs,
  },
  planDays: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  planDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.cardBorder,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  planStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.lg,
  },
  planStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xxs,
  },
  planStatText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  addCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.xs,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: Theme.spacing.lg,
  },
  addCardText: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
  },
  upgradeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
    borderWidth: 1,
    padding: Theme.spacing.lg,
  },
  upgradeTextGroup: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  upgradeDesc: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  limitCount: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    textAlign: "center",
    marginTop: Theme.spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});

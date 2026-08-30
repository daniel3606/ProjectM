import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Theme from "@/constants/theme";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  useTimedBlockPlans,
  type TimedBlockPlan,
} from "@/contexts/TimedBlockPlansContext";
import {
  formatClockTime,
  formatDaysOfWeek,
  formatDuration,
  getGrowthForDuration,
} from "@/constants/marshmallow";
import TimedBlockPlanSheet, {
  type TimedBlockPlanDraft,
} from "@/components/TimedBlockPlanSheet";
import { Screen, ScreenTitle, ScreenSubtitle, Card, SelectableCard } from "@/components/ui";
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
  /** True for the plan whose block is running right now. */
  isActive: boolean;
  onEdit: (plan: TimedBlockPlan) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

const PlanCard = React.memo(function PlanCard({
  plan,
  isActive,
  onEdit,
  onToggle,
}: PlanCardProps) {
  const handleLongPress = useCallback(() => onEdit(plan), [onEdit, plan]);
  const handleToggle = useCallback(
    (value: boolean) => onToggle(plan.id, value),
    [onToggle, plan.id]
  );

  return (
    <SelectableCard
      onLongPress={handleLongPress}
      style={[styles.planCard, isActive && styles.planCardActive]}
      testID={`plan-card-${plan.id}`}
    >
      <View style={[styles.planBody, !plan.enabled && styles.planBodyOff]}>
        <View style={styles.planTopRow}>
          <View style={styles.planInfo}>
            <View style={styles.planLabelRow}>
              <Text style={styles.planLabel} numberOfLines={1}>
                {plan.label}
              </Text>
              {isActive && (
                <View style={styles.activePill} testID={`plan-active-${plan.id}`}>
                  <Text style={styles.activePillText}>Active now</Text>
                </View>
              )}
            </View>
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
  const { activeSession } = useFocusSession();
  const { plans, planLimit, canAddPlan, addPlan, updatePlan, removePlan, setPlanEnabled } =
    useTimedBlockPlans();
  const { isPremium } = useSubscription();
  const planSheetRef = useRef<BottomSheetModal>(null);
  const [editingPlan, setEditingPlan] = useState<TimedBlockPlan | null>(null);

  const params = useLocalSearchParams() as PlanDraftParams;
  const [draft, setDraft] = useState<TimedBlockPlanDraft | null>(null);
  const draftSourceRef = useRef<string | null>(null);
  const handledDraftRef = useRef<string | null>(null);

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

  const handleAddPlan = useCallback(() => {
    if (!canAddPlan) {
      router.push("/premium");
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

      {/* The countdown and the controls for a running block live on Home now,
          so this tab only has to say which block that is. */}
      {activeSession && (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            {activeSession.planId
              ? "A scheduled block is running — the time left and its controls are on Home"
              : "A Quick Block is active — manage it from Home"}
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
            isActive={activeSession?.planId === plan.id}
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
  noticeCard: {
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  noticeText: {
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
  planCardActive: {
    borderWidth: 1.5,
    borderColor: Theme.colors.secondary,
  },
  planLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  activePill: {
    backgroundColor: Theme.colors.secondary,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 3,
  },
  activePillText: {
    fontSize: 10,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    // Truncate the name rather than pushing the "Active now" pill off the card.
    flexShrink: 1,
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

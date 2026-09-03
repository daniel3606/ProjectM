import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import { Card, SelectableCard, Button, SectionLabel, ProBadge } from "@/components/ui";
import {
  DAY_LABELS,
  estimateGrowthCm,
  formatDuration,
  type FocusMode,
} from "@/constants/marshmallow";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import * as ScreenTime from "@/modules/screen-time";
import type { BlockMode, ScreenTimeItem } from "@/modules/screen-time";
import { getBlockTypeForPlan } from "@/lib/growthModel";
import type { TimedBlockPlan } from "@/contexts/TimedBlockPlansContext";
import WheelPicker, { ITEM_HEIGHT, PICKER_HEIGHT } from "@/components/WheelPicker";
import { useRouter } from "expo-router";

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

// Module scope so the wheel rows keep a stable `label` prop and stay memoized
// while the user drags.
function formatMinuteLabel(minute: number): string {
  return String(minute).padStart(2, "0");
}

/** Prefill for a new plan, e.g. the window a Stats recommendation suggested. */
export interface TimedBlockPlanDraft {
  label: string;
  startHour: number;
  endHour: number;
  daysOfWeek: number[];
}

interface TimedBlockPlanSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  editingPlan: TimedBlockPlan | null;
  /** Applied only when creating; `editingPlan` always wins. */
  draft?: TimedBlockPlanDraft | null;
  onSave: (plan: Omit<TimedBlockPlan, "id">) => void;
  onUpdate: (id: string, plan: Omit<TimedBlockPlan, "id">) => void;
  onDelete: (id: string) => void;
}

// The stored plan only keeps app ids + counts, not the full picker items, so
// rebuild a display-only selection to pre-fill the sheet when editing.
function selectionFromPlan(plan: TimedBlockPlan): ScreenTimeItem[] {
  const { appCount, catCount, webCount } = plan.appsSummary;
  const items: ScreenTimeItem[] = [];
  let idx = 0;
  for (let i = 0; i < appCount; i++, idx++) {
    items.push({ id: plan.appIds[idx] ?? `app_${i}`, type: "application", label: `App ${i + 1}`, index: i });
  }
  for (let i = 0; i < catCount; i++, idx++) {
    items.push({ id: plan.appIds[idx] ?? `cat_${i}`, type: "category", label: `Category ${i + 1}`, index: i });
  }
  for (let i = 0; i < webCount; i++, idx++) {
    items.push({ id: plan.appIds[idx] ?? `web_${i}`, type: "webDomain", label: `Web Domain ${i + 1}`, index: i });
  }
  return items;
}

export default function TimedBlockPlanSheet({
  sheetRef,
  editingPlan,
  draft,
  onSave,
  onUpdate,
  onDelete,
}: TimedBlockPlanSheetProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isPremium } = useSubscription();
  const { growthPreview } = useFocusSession();

  const [label, setLabel] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(() => [new Date().getDay()]);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(17);
  const [endMinute, setEndMinute] = useState(0);
  const [focusMode, setFocusMode] = useState<FocusMode>("flexible");
  const [isSleep, setIsSleep] = useState(false);
  const [selectedApps, setSelectedApps] = useState<ScreenTimeItem[]>([]);
  const [blockMode, setBlockMode] = useState<BlockMode>("block");

  useEffect(() => {
    if (editingPlan) {
      setLabel(editingPlan.label);
      setDaysOfWeek(editingPlan.daysOfWeek);
      setStartHour(editingPlan.startHour);
      setStartMinute(editingPlan.startMinute);
      setEndHour(editingPlan.endHour);
      setEndMinute(editingPlan.endMinute);
      setFocusMode(editingPlan.focusMode);
      setIsSleep(getBlockTypeForPlan(editingPlan) === "sleep");
      setSelectedApps(selectionFromPlan(editingPlan));
      setBlockMode(editingPlan.blockMode ?? "block");
      return;
    }

    resetForm();

    if (draft) {
      setLabel(draft.label);
      setDaysOfWeek(draft.daysOfWeek);
      setStartHour(draft.startHour);
      setStartMinute(0);
      // A window ending at midnight is stored as hour 0, matching how the
      // schedule maths already treats an overnight end.
      setEndHour(draft.endHour % 24);
      setEndMinute(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPlan, draft]);

  const snapPoints = useMemo(() => ["85%"], []);
  const totalMinutes = useMemo(() => {
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const diff = end - start;
    return diff > 0 ? diff : diff + 24 * 60;
  }, [startHour, startMinute, endHour, endMinute]);
  const expectedGrowth = estimateGrowthCm({
    minutes: totalMinutes,
    blockType: isSleep ? "sleep" : "scheduled",
    isHardBlock: isPremium && focusMode === "deep",
    streakDays: growthPreview.streakDays,
    rawGrowthTodayCm: growthPreview.rawGrowthTodayCm,
  });

  const appCount = selectedApps.filter((i) => i.type === "application").length;
  const catCount = selectedApps.filter((i) => i.type === "category").length;
  const webCount = selectedApps.filter((i) => i.type === "webDomain").length;
  const totalSelected = selectedApps.length;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const resetForm = useCallback(() => {
    setLabel("");
    setDaysOfWeek([new Date().getDay()]);
    setStartHour(9);
    setStartMinute(0);
    setEndHour(17);
    setEndMinute(0);
    setFocusMode("flexible");
    setIsSleep(false);
    setSelectedApps([]);
    setBlockMode("block");
  }, []);

  const handleToggleDay = useCallback((day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const handlePickApps = useCallback(async () => {
    try {
      const picked = await ScreenTime.openAppPicker();
      if (picked !== null) {
        setSelectedApps(picked);
      }
    } catch {
      Alert.alert("Error", "Failed to open app picker.");
    }
  }, []);

  const handleDeepFocusPress = useCallback(() => {
    if (!isPremium) {
      sheetRef.current?.dismiss();
      router.push("/premium");
      return;
    }
    setFocusMode("deep");
  }, [isPremium, router, sheetRef]);

  const handleSelectBlockMode = useCallback(
    (next: BlockMode) => {
      if (next === "allowOnly" && !isPremium) {
        sheetRef.current?.dismiss();
        router.push("/premium");
        return;
      }
      setBlockMode(next);
    },
    [isPremium, router, sheetRef]
  );

  const handleSave = useCallback(() => {
    if (totalMinutes === 0 || daysOfWeek.length === 0) return;
    if (blockMode === "allowOnly" && selectedApps.length === 0) {
      Alert.alert("Pick something to allow", "Allow Only needs at least one app or website left open.");
      return;
    }

    const plan = {
      label: label.trim() || `${formatDuration(totalMinutes)} Block`,
      daysOfWeek,
      startHour,
      startMinute,
      endHour,
      endMinute,
      durationMinutes: totalMinutes,
      focusMode,
      appIds: selectedApps.map((i) => i.id),
      appsSummary: { appCount, catCount, webCount },
      enabled: editingPlan?.enabled ?? true,
      isSleep,
      blockMode,
    };

    if (editingPlan) {
      onUpdate(editingPlan.id, plan);
    } else {
      onSave(plan);
    }

    sheetRef.current?.dismiss();
    resetForm();
  }, [
    totalMinutes,
    label,
    daysOfWeek,
    startHour,
    startMinute,
    endHour,
    endMinute,
    focusMode,
    blockMode,
    isSleep,
    selectedApps,
    appCount,
    catCount,
    webCount,
    editingPlan,
    onSave,
    onUpdate,
    sheetRef,
    resetForm,
  ]);

  const handleDelete = useCallback(() => {
    if (!editingPlan) return;
    Alert.alert("Delete Block", `Remove "${editingPlan.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          onDelete(editingPlan.id);
          sheetRef.current?.dismiss();
          resetForm();
        },
      },
    ]);
  }, [editingPlan, onDelete, sheetRef, resetForm]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      // The wheels sit inside this sheet's scroll view; leaving the sheet's
      // content pan enabled makes it fight them for the drag. Dragging the
      // handle still closes the sheet.
      enableContentPanningGesture={false}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {editingPlan ? "Edit Timed Block" : "New Timed Block"}
          </Text>
          <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={12}>
            <Ionicons name="close-circle" size={28} color={Theme.colors.gray} />
          </Pressable>
        </View>

        <SectionLabel style={styles.sectionTitle}>Label</SectionLabel>
        <BottomSheetTextInput
          style={styles.labelInput}
          placeholder="e.g. Study time"
          placeholderTextColor={Theme.colors.gray}
          value={label}
          onChangeText={setLabel}
          maxLength={30}
          returnKeyType="done"
        />

        <SectionLabel style={styles.sectionTitle}>Expected Growth</SectionLabel>
        <Card tone="surface" style={styles.card}>
          <Text style={styles.growthAmount}>+{expectedGrowth}cm</Text>
          <Text style={styles.growthDesc}>{formatDuration(totalMinutes)} block</Text>
        </Card>

        <SectionLabel style={styles.sectionTitle}>Block Type</SectionLabel>
        <View style={styles.focusModeRow}>
          <SelectableCard
            tone="surface"
            selected={!isSleep}
            onPress={() => setIsSleep(false)}
            style={styles.focusModeCard}
          >
            <Text style={styles.focusModeTitle}>Focus</Text>
            <Text style={styles.focusModeDesc}>Work, study, or screen-free time</Text>
          </SelectableCard>
          <SelectableCard
            tone="surface"
            selected={isSleep}
            onPress={() => setIsSleep(true)}
            style={styles.focusModeCard}
          >
            <Text style={styles.focusModeTitle}>Sleep</Text>
            <Text style={styles.focusModeDesc}>Overnight, grows at a lower rate</Text>
          </SelectableCard>
        </View>

        <SectionLabel style={styles.sectionTitle}>Focus Mode</SectionLabel>
        <View style={styles.focusModeRow}>
          <SelectableCard
            tone="surface"
            selected={focusMode === "flexible"}
            onPress={() => setFocusMode("flexible")}
            style={styles.focusModeCard}
          >
            <Text style={styles.focusModeTitle}>Flexible</Text>
            <Text style={styles.focusModeDesc}>Allow occasional phone use</Text>
          </SelectableCard>
          <SelectableCard
            tone="surface"
            selected={focusMode === "deep"}
            onPress={handleDeepFocusPress}
            style={styles.focusModeCard}
          >
            <View style={styles.focusModeTitleRow}>
              <Text style={styles.focusModeTitle}>Deep Focus</Text>
              {!isPremium ? <ProBadge /> : null}
            </View>
            <Text style={styles.focusModeDesc}>Strict blocking, no early exit</Text>
          </SelectableCard>
        </View>

        <SectionLabel style={styles.sectionTitle}>
          {blockMode === "allowOnly" ? "Allowed Apps" : "Applications to Block"}
        </SectionLabel>
        <View style={styles.segmented}>
          <Pressable
            onPress={() => handleSelectBlockMode("block")}
            style={[styles.segment, blockMode === "block" && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                blockMode === "block" && styles.segmentTextActive,
              ]}
            >
              Block
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSelectBlockMode("allowOnly")}
            style={[styles.segment, blockMode === "allowOnly" && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                blockMode === "allowOnly" && styles.segmentTextActive,
              ]}
            >
              Allow Only
            </Text>
            {!isPremium ? <ProBadge /> : null}
          </Pressable>
        </View>
        <Text style={styles.modeHint}>
          {blockMode === "allowOnly"
            ? "Only these apps and websites stay open. Everything else is blocked."
            : "These apps and websites are blocked while the block runs."}
        </Text>
        <Card tone="surface" style={styles.card}>
          {totalSelected > 0 ? (
            <Text style={styles.appSummaryText}>
              {[
                appCount > 0 && `${appCount} app${appCount !== 1 ? "s" : ""}`,
                catCount > 0 && `${catCount} categor${catCount !== 1 ? "ies" : "y"}`,
                webCount > 0 && `${webCount} web domain${webCount !== 1 ? "s" : ""}`,
              ]
                .filter(Boolean)
                .join(", ")}{" "}
              selected
            </Text>
          ) : (
            <Text style={styles.noAppsText}>
              {blockMode === "allowOnly"
                ? "Nothing allowed yet — pick at least one app"
                : "No apps selected (blocks everything)"}
            </Text>
          )}

          <Button
            variant="outline"
            onPress={handlePickApps}
            icon="add-circle-outline"
            iconSize={18}
            label="Choose Apps"
          />
        </Card>

        <SectionLabel style={styles.sectionTitle}>Day</SectionLabel>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((dayLabel, index) => (
            <SelectableCard
              key={dayLabel}
              tone="surface"
              selected={daysOfWeek.includes(index)}
              onPress={() => handleToggleDay(index)}
              style={styles.dayChip}
            >
              <Text
                style={[
                  styles.dayChipText,
                  daysOfWeek.includes(index) && styles.dayChipTextSelected,
                ]}
              >
                {dayLabel}
              </Text>
            </SelectableCard>
          ))}
        </View>

        <SectionLabel style={styles.sectionTitle}>Start Time</SectionLabel>
        <View style={styles.durationCard}>
          <View pointerEvents="none" style={styles.selectionLineTop} />
          <View pointerEvents="none" style={styles.selectionLineBottom} />
          <View style={styles.durationRow}>
            <WheelPicker
              data={HOURS_24}
              selectedValue={startHour}
              onChange={setStartHour}
              formatLabel={formatHourLabel}
            />
            <WheelPicker
              data={MINUTES}
              selectedValue={startMinute}
              onChange={setStartMinute}
              formatLabel={formatMinuteLabel}
            />
          </View>
        </View>

        <SectionLabel style={styles.sectionTitle}>End Time</SectionLabel>
        <View style={styles.durationCard}>
          <View pointerEvents="none" style={styles.selectionLineTop} />
          <View pointerEvents="none" style={styles.selectionLineBottom} />
          <View style={styles.durationRow}>
            <WheelPicker
              data={HOURS_24}
              selectedValue={endHour}
              onChange={setEndHour}
              formatLabel={formatHourLabel}
            />
            <WheelPicker
              data={MINUTES}
              selectedValue={endMinute}
              onChange={setEndMinute}
              formatLabel={formatMinuteLabel}
            />
          </View>
        </View>

        <Button
          onPress={handleSave}
          disabled={totalMinutes === 0 || daysOfWeek.length === 0}
          icon="bookmark-outline"
          label={editingPlan ? "Save Changes" : "Save Block"}
          style={styles.saveButton}
        />

        {editingPlan && (
          <Button
            variant="ghost"
            onPress={handleDelete}
            icon="trash-outline"
            iconSize={18}
            label="Delete Block"
            style={styles.deleteButton}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handleIndicator: {
    width: 40,
    backgroundColor: Theme.colors.gray,
    opacity: 0.35,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  sectionTitle: {
    marginBottom: 10,
    marginTop: 20,
  },
  labelInput: {
    backgroundColor: Theme.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  card: {
    padding: 16,
    alignItems: "center",
  },
  growthAmount: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.secondary,
  },
  growthDesc: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  focusModeRow: {
    flexDirection: "row",
    gap: 12,
  },
  focusModeCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    position: "relative",
  },
  focusModeTitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    marginBottom: 4,
  },
  focusModeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  focusModeDesc: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    lineHeight: 16,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: Theme.colors.lightGray,
    borderRadius: Theme.radius.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.xs,
    paddingVertical: 10,
    borderRadius: Theme.radius.pill,
  },
  segmentActive: {
    backgroundColor: Theme.colors.white,
    ...Theme.shadows.card,
  },
  segmentText: {
    fontSize: 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  segmentTextActive: {
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  modeHint: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  appSummaryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  noAppsText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: "row",
    gap: 6,
  },
  dayChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  dayChipText: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.textSecondary,
  },
  dayChipTextSelected: {
    color: Theme.colors.secondary,
  },
  durationCard: {
    position: "relative",
    height: PICKER_HEIGHT,
    backgroundColor: Theme.colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    overflow: "hidden",
  },
  selectionLineTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.cardBorder,
    zIndex: 1,
  },
  selectionLineBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.cardBorder,
    zIndex: 1,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 28,
  },
  deleteButton: {
    marginTop: 12,
  },
});

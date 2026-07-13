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
import {
  DAY_LABELS,
  formatDuration,
  getGrowthForDuration,
  type FocusMode,
} from "@/constants/marshmallow";
import * as ScreenTime from "@/modules/screen-time";
import type { ScreenTimeItem } from "@/modules/screen-time";
import type { TimedBlockPlan } from "@/contexts/TimedBlockPlansContext";
import WheelPicker, { ITEM_HEIGHT, PICKER_HEIGHT } from "@/components/WheelPicker";

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

interface TimedBlockPlanSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  editingPlan: TimedBlockPlan | null;
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
  onSave,
  onUpdate,
  onDelete,
}: TimedBlockPlanSheetProps) {
  const insets = useSafeAreaInsets();

  const [label, setLabel] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(() => new Date().getDay());
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(17);
  const [endMinute, setEndMinute] = useState(0);
  const [focusMode, setFocusMode] = useState<FocusMode>("flexible");
  const [selectedApps, setSelectedApps] = useState<ScreenTimeItem[]>([]);

  useEffect(() => {
    if (editingPlan) {
      setLabel(editingPlan.label);
      setDayOfWeek(editingPlan.dayOfWeek);
      setStartHour(editingPlan.startHour);
      setStartMinute(editingPlan.startMinute);
      setEndHour(editingPlan.endHour);
      setEndMinute(editingPlan.endMinute);
      setFocusMode(editingPlan.focusMode);
      setSelectedApps(selectionFromPlan(editingPlan));
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPlan]);

  const snapPoints = useMemo(() => ["85%"], []);
  const totalMinutes = useMemo(() => {
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const diff = end - start;
    return diff > 0 ? diff : diff + 24 * 60;
  }, [startHour, startMinute, endHour, endMinute]);
  const expectedGrowth = getGrowthForDuration(totalMinutes, focusMode);

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
    setDayOfWeek(new Date().getDay());
    setStartHour(9);
    setStartMinute(0);
    setEndHour(17);
    setEndMinute(0);
    setFocusMode("flexible");
    setSelectedApps([]);
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
    Alert.alert(
      "Premium Feature",
      "Deep Focus mode with 1.5x growth multiplier is coming soon for premium members."
    );
  }, []);

  const handleSave = useCallback(() => {
    if (totalMinutes === 0) return;

    const plan = {
      label: label.trim() || `${formatDuration(totalMinutes)} Block`,
      dayOfWeek,
      startHour,
      startMinute,
      endHour,
      endMinute,
      durationMinutes: totalMinutes,
      focusMode,
      appIds: selectedApps.map((i) => i.id),
      appsSummary: { appCount, catCount, webCount },
      enabled: editingPlan?.enabled ?? true,
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
    dayOfWeek,
    startHour,
    startMinute,
    endHour,
    endMinute,
    focusMode,
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

        <Text style={styles.sectionTitle}>Label</Text>
        <BottomSheetTextInput
          style={styles.labelInput}
          placeholder="e.g. Study time"
          placeholderTextColor={Theme.colors.gray}
          value={label}
          onChangeText={setLabel}
          maxLength={30}
          returnKeyType="done"
        />

        <Text style={styles.sectionTitle}>Expected Growth</Text>
        <View style={styles.card}>
          <Text style={styles.growthAmount}>+{expectedGrowth}cm</Text>
          <Text style={styles.growthDesc}>{formatDuration(totalMinutes)} block</Text>
        </View>

        <Text style={styles.sectionTitle}>Focus Mode</Text>
        <View style={styles.focusModeRow}>
          <Pressable
            onPress={() => setFocusMode("flexible")}
            style={({ pressed }) => [
              styles.focusModeCard,
              focusMode === "flexible" && styles.focusModeCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.focusModeTitle}>Flexible</Text>
            <Text style={styles.focusModeDesc}>Allow occasional phone use</Text>
          </Pressable>
          <Pressable
            onPress={handleDeepFocusPress}
            style={({ pressed }) => [styles.focusModeCard, pressed && styles.pressed]}
          >
            <Text style={styles.focusModeTitle}>Deep Focus</Text>
            <Text style={styles.focusModeDesc}>Strict blocking, 1.5x growth</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Applications to Block</Text>
        <View style={styles.card}>
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
            <Text style={styles.noAppsText}>No apps selected (blocks everything)</Text>
          )}

          <Pressable
            onPress={handlePickApps}
            style={({ pressed }) => [styles.chooseAppsButton, pressed && styles.pressed]}
          >
            <Ionicons name="add-circle-outline" size={18} color={Theme.colors.secondary} />
            <Text style={styles.chooseAppsText}>Choose Apps</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Day</Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((dayLabel, index) => (
            <Pressable
              key={dayLabel}
              onPress={() => setDayOfWeek(index)}
              style={({ pressed }) => [
                styles.dayChip,
                dayOfWeek === index && styles.dayChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.dayChipText,
                  dayOfWeek === index && styles.dayChipTextSelected,
                ]}
              >
                {dayLabel}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Start Time</Text>
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
              formatLabel={(m) => String(m).padStart(2, "0")}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>End Time</Text>
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
              formatLabel={(m) => String(m).padStart(2, "0")}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={totalMinutes === 0}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.savePressed,
            totalMinutes === 0 && styles.saveDisabled,
          ]}
        >
          <Ionicons name="bookmark-outline" size={20} color={Theme.colors.white} />
          <Text style={styles.saveButtonText}>
            {editingPlan ? "Save Changes" : "Save Block"}
          </Text>
        </Pressable>

        {editingPlan && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={18} color={Theme.colors.danger} />
            <Text style={styles.deleteButtonText}>Delete Block</Text>
          </Pressable>
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
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.gray,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    backgroundColor: Theme.colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
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
    backgroundColor: Theme.colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Theme.colors.cardBorder,
    padding: 14,
    position: "relative",
  },
  focusModeCardSelected: {
    borderColor: Theme.colors.secondary,
    borderWidth: 2,
    backgroundColor: "#FFF8F0",
  },
  focusModeTitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    marginBottom: 4,
  },
  focusModeDesc: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    lineHeight: 16,
  },
  proBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: Theme.colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.white,
  },
  pressed: {
    opacity: 0.7,
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
  chooseAppsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  chooseAppsText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
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
    backgroundColor: Theme.colors.white,
    borderWidth: 1.5,
    borderColor: Theme.colors.cardBorder,
  },
  dayChipSelected: {
    borderColor: Theme.colors.secondary,
    backgroundColor: "#FFF8F0",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Theme.colors.secondary,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  savePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  saveDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.danger,
  },
});

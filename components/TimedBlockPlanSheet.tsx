import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import { formatDuration, getGrowthForDuration, type FocusMode } from "@/constants/marshmallow";
import * as ScreenTime from "@/modules/screen-time";
import type { ScreenTimeItem } from "@/modules/screen-time";
import type { TimedBlockPlan } from "@/contexts/TimedBlockPlansContext";
import WheelPicker, { ITEM_HEIGHT, PICKER_HEIGHT } from "@/components/WheelPicker";

const HOURS = [0, 1, 2, 3, 4];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

interface TimedBlockPlanSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onSave: (plan: Omit<TimedBlockPlan, "id">) => void;
}

export default function TimedBlockPlanSheet({
  sheetRef,
  onSave,
}: TimedBlockPlanSheetProps) {
  const insets = useSafeAreaInsets();

  const [label, setLabel] = useState("");
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [focusMode, setFocusMode] = useState<FocusMode>("flexible");
  const [selectedApps, setSelectedApps] = useState<ScreenTimeItem[]>([]);

  const snapPoints = useMemo(() => ["80%"], []);
  const totalMinutes = durationHours * 60 + durationMinutes;
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
    setDurationHours(0);
    setDurationMinutes(30);
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

    onSave({
      label: label.trim() || `${formatDuration(totalMinutes)} Block`,
      durationMinutes: totalMinutes,
      focusMode,
      appIds: selectedApps.map((i) => i.id),
      appsSummary: { appCount, catCount, webCount },
    });

    sheetRef.current?.dismiss();
    resetForm();
  }, [
    totalMinutes,
    label,
    focusMode,
    selectedApps,
    appCount,
    catCount,
    webCount,
    onSave,
    sheetRef,
    resetForm,
  ]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Timed Block</Text>
          <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={12}>
            <Ionicons name="close-circle" size={28} color={Theme.colors.gray} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Label</Text>
        <TextInput
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

        <Text style={styles.sectionTitle}>Duration</Text>
        <View style={styles.durationCard}>
          <View pointerEvents="none" style={styles.selectionLineTop} />
          <View pointerEvents="none" style={styles.selectionLineBottom} />
          <View style={styles.durationRow}>
            <WheelPicker
              data={HOURS}
              selectedValue={durationHours}
              onChange={setDurationHours}
              formatLabel={(h) => `${h} hr`}
            />
            <WheelPicker
              data={MINUTES}
              selectedValue={durationMinutes}
              onChange={setDurationMinutes}
              formatLabel={(m) => `${m} min`}
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
          <Text style={styles.saveButtonText}>Save Block</Text>
        </Pressable>
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
});

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import {
  formatDuration,
  getGrowthForDuration,
  type FocusMode,
} from "@/constants/marshmallow";
import { getStageForSize, getNextStage } from "@/constants/growthStages";
import * as ScreenTime from "@/modules/screen-time";
import type { ScreenTimeItem } from "@/modules/screen-time";

export interface FocusSessionConfig {
  durationMinutes: number;
  focusMode: FocusMode;
  expectedGrowthCm: number;
}

const DURATION_STEP = 5;
const MIN_DURATION = 5;
const MAX_DURATION = 240;

interface FocusSessionSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  currentSizeCm: number;
  onStartSession: (config: FocusSessionConfig) => void;
}

export default function FocusSessionSheet({
  sheetRef,
  currentSizeCm,
  onStartSession,
}: FocusSessionSheetProps) {
  const insets = useSafeAreaInsets();

  const [totalMinutes, setTotalMinutes] = useState(30);
  const [focusMode, setFocusMode] = useState<FocusMode>("flexible");
  const [selectedApps, setSelectedApps] = useState<ScreenTimeItem[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  const snapPoints = useMemo(() => ["85%"], []);

  const expectedGrowth = getGrowthForDuration(totalMinutes, focusMode);
  const projectedSize = currentSizeCm + expectedGrowth;
  const currentStage = getStageForSize(currentSizeCm);
  const projectedStage = getStageForSize(projectedSize);
  const nextStage = getNextStage(currentSizeCm);
  const willReachNewStage =
    projectedStage.id !== currentStage.id && projectedStage.sizeCm > currentStage.sizeCm;

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

  const handleSheetChange = useCallback(async (index: number) => {
    if (index === 0) {
      setIsLoadingApps(true);
      try {
        const items = await ScreenTime.getSelectedItems();
        setSelectedApps(items);
      } catch {
        // Silently fail; user can pick apps manually
      } finally {
        setIsLoadingApps(false);
      }
    }
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

  const handleDecreaseDuration = useCallback(() => {
    setTotalMinutes((prev) => Math.max(MIN_DURATION, prev - DURATION_STEP));
  }, []);

  const handleIncreaseDuration = useCallback(() => {
    setTotalMinutes((prev) => Math.min(MAX_DURATION, prev + DURATION_STEP));
  }, []);

  const handleStart = useCallback(() => {
    if (totalSelected === 0 || totalMinutes === 0) return;

    const config: FocusSessionConfig = {
      durationMinutes: totalMinutes,
      focusMode,
      expectedGrowthCm: expectedGrowth,
    };

    sheetRef.current?.dismiss();
    onStartSession(config);
  }, [totalSelected, totalMinutes, focusMode, expectedGrowth, sheetRef, onStartSession]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      onChange={handleSheetChange}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <Text style={styles.growthAmount}>Expected Growth: {currentSizeCm}cm+({expectedGrowth}cm)</Text>


        {/* ── Focus Mode ─────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Focus Mode</Text>
        <View style={styles.focusModeRow}>
          {/* Flexible Focus */}
          <Pressable
            onPress={() => setFocusMode("flexible")}
            style={({ pressed }) => [
              styles.focusModeCard,
              focusMode === "flexible" && styles.focusModeCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.focusModeHeader}>
              <Ionicons
                name="leaf-outline"
                size={18}
                color={
                  focusMode === "flexible"
                    ? Theme.colors.secondary
                    : Theme.colors.text
                }
              />
              <Text
                style={[
                  styles.focusModeTitle,
                  focusMode === "flexible" && styles.focusModeTitleSelected,
                ]}
              >
                Flexible
              </Text>
            </View>
            <Text style={styles.focusModeDesc}>
              Allow occasional phone use
            </Text>
            {focusMode === "flexible" && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={Theme.colors.secondary}
                style={styles.checkIcon}
              />
            )}
          </Pressable>

          {/* Deep Focus */}
          <Pressable
            onPress={handleDeepFocusPress}
            style={({ pressed }) => [
              styles.focusModeCard,
              focusMode === "deep" && styles.focusModeCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.focusModeHeader}>
              <Ionicons
                name="lock-closed"
                size={16}
                color={Theme.colors.gray}
              />
              <Text style={styles.focusModeTitle}>Deep Focus</Text>
            </View>
            <Text style={styles.focusModeDesc}>
              Strict blocking, 1.5x growth
            </Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
            {focusMode === "deep" && (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={Theme.colors.secondary}
                style={styles.checkIcon}
              />
            )}
          </Pressable>
        </View>

        {/* ── Applications to Block ──────────────────────────────── */}
        <Text style={styles.sectionTitle}>Applications to Block</Text>
        <View style={styles.card}>
          {isLoadingApps ? (
            <ActivityIndicator
              color={Theme.colors.secondary}
              style={styles.appLoader}
            />
          ) : totalSelected > 0 ? (
            <View style={styles.appSummary}>
              {appCount > 0 && (
                <View style={styles.appSummaryRow}>
                  <Ionicons
                    name="apps-outline"
                    size={18}
                    color={Theme.colors.secondary}
                  />
                  <Text style={styles.appSummaryText}>
                    {appCount} app{appCount !== 1 ? "s" : ""} selected
                  </Text>
                </View>
              )}
              {catCount > 0 && (
                <View style={styles.appSummaryRow}>
                  <Ionicons
                    name="folder-outline"
                    size={18}
                    color={Theme.colors.secondary}
                  />
                  <Text style={styles.appSummaryText}>
                    {catCount} categor{catCount !== 1 ? "ies" : "y"} selected
                  </Text>
                </View>
              )}
              {webCount > 0 && (
                <View style={styles.appSummaryRow}>
                  <Ionicons
                    name="globe-outline"
                    size={18}
                    color={Theme.colors.secondary}
                  />
                  <Text style={styles.appSummaryText}>
                    {webCount} web domain{webCount !== 1 ? "s" : ""} selected
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noAppsText}>No apps selected yet</Text>
          )}

          <Pressable
            onPress={handlePickApps}
            style={({ pressed }) => [
              styles.chooseAppsButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={Theme.colors.secondary}
            />
            <Text style={styles.chooseAppsText}>Choose Apps</Text>
          </Pressable>
        </View>

        {/* ── Block Duration ─────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Block Duration</Text>
        <View style={styles.durationCard}>
          <Pressable
            onPress={handleDecreaseDuration}
            disabled={totalMinutes <= MIN_DURATION}
            style={({ pressed }) => [
              styles.durationStepButton,
              pressed && styles.pressed,
              totalMinutes <= MIN_DURATION && styles.durationStepButtonDisabled,
            ]}
          >
            <Ionicons name="remove" size={22} color={Theme.colors.secondary} />
          </Pressable>

          <Text style={styles.durationValueText}>
            {formatDuration(totalMinutes)}
          </Text>

          <Pressable
            onPress={handleIncreaseDuration}
            disabled={totalMinutes >= MAX_DURATION}
            style={({ pressed }) => [
              styles.durationStepButton,
              pressed && styles.pressed,
              totalMinutes >= MAX_DURATION && styles.durationStepButtonDisabled,
            ]}
          >
            <Ionicons name="add" size={22} color={Theme.colors.secondary} />
          </Pressable>
        </View>

        {/* ── Start Button ───────────────────────────────────────── */}
        <Pressable
          onPress={handleStart}
          disabled={totalSelected === 0 || totalMinutes === 0}
          style={({ pressed }) => [
            styles.startButton,
            pressed && styles.startButtonPressed,
            (totalSelected === 0 || totalMinutes === 0) &&
              styles.startButtonDisabled,
          ]}
        >
          <Ionicons name="timer-outline" size={22} color={Theme.colors.white} />
          <Text style={styles.startButtonText}>
            Start {formatDuration(totalMinutes)} Focus
          </Text>
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

  /* Header */
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

  /* Sections */
  sectionTitle: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.gray,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 20,
  },

  /* Card (shared) */
  card: {
    backgroundColor: Theme.colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    padding: 16,
    alignItems: "center",
  },

  /* Expected Growth */
  growthAmount: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  growthTransition: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  growthStageMessage: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.success,
    marginTop: 6,
  },

  /* Focus Mode */
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
  },
  focusModeCardSelected: {
    borderColor: Theme.colors.secondary,
    borderWidth: 2,
    backgroundColor: "#FFF8F0",
  },
  focusModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  focusModeTitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  focusModeTitleSelected: {
    color: Theme.colors.secondary,
  },
  focusModeDesc: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    lineHeight: 16,
  },
  checkIcon: {
    position: "absolute",
    top: 12,
    right: 12,
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

  /* Applications */
  appLoader: {
    paddingVertical: 8,
  },
  appSummary: {
    width: "100%",
    gap: 8,
    marginBottom: 12,
  },
  appSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appSummaryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
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

  /* Duration */
  durationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Theme.colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  durationStepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  durationStepButtonDisabled: {
    opacity: 0.4,
  },
  durationValueText: {
    fontSize: 22,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },

  /* Start Button */
  startButton: {
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
  startButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
});

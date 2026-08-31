import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import SettingRow from "@/components/ui/SettingRow";
import HoldToStartButton from "@/components/HoldToStartButton";
import BlockedAppsSheet, { type BlockMode } from "@/components/BlockedAppsSheet";
import { estimateGrowthCm, formatDuration } from "@/constants/marshmallow";
import { describeBreakAllowance, supportsBreaks } from "@/lib/focusBreaks";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useFocusSession, type FocusSessionConfig } from "@/contexts/FocusSessionContext";
import * as ScreenTime from "@/modules/screen-time";
import type { ScreenTimeItem } from "@/modules/screen-time";

const MIN_DURATION = 5;
const MAX_DURATION = 240;

/**
 * The stepper walks in 5-minute jumps up to an hour, then 15-minute jumps —
 * a 3h block doesn't need 3-hour-and-5-minute precision, and the coarser
 * step keeps a long block a few taps away instead of dozens.
 */
const SHORT_STEP = 5;
const LONG_STEP = 15;
const LONG_STEP_FROM = 60;

function stepDuration(minutes: number, direction: 1 | -1): number {
  // Stepping down *from* the boundary should use the small step, so 60m goes
  // to 55m rather than back to 45m.
  const step =
    direction === 1
      ? minutes >= LONG_STEP_FROM
        ? LONG_STEP
        : SHORT_STEP
      : minutes > LONG_STEP_FROM
        ? LONG_STEP
        : SHORT_STEP;
  const next = minutes + direction * step;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, next));
}

interface FocusSessionSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  currentSizeCm: number;
  onStartSession: (config: FocusSessionConfig) => void;
  /** Duration the sheet opens on. Lowered for a user's first session so it asks less of them. */
  defaultDurationMinutes?: number;
  /** Opens the paywall when a PRO-only control is tapped. */
  onUpgrade: () => void;
}

export default function FocusSessionSheet({
  sheetRef,
  currentSizeCm,
  onStartSession,
  defaultDurationMinutes = 30,
  onUpgrade,
}: FocusSessionSheetProps) {
  const insets = useSafeAreaInsets();
  const {
    distractingApps,
    neverAllowedApps,
    setNeverAllowedApps,
  } = useMarshmallowProfile();
  const { isPremium } = useSubscription();
  const { growthPreview } = useFocusSession();

  const [totalMinutes, setTotalMinutes] = useState(defaultDurationMinutes);
  // The caller's default can arrive after mount (it depends on persisted state),
  // so adopt it until the user has set a duration themselves.
  const durationTouchedRef = useRef(false);
  useEffect(() => {
    if (durationTouchedRef.current) return;
    setTotalMinutes(defaultDurationMinutes);
  }, [defaultDurationMinutes]);

  const [isHardMode, setIsHardMode] = useState(false);
  const [selectedApps, setSelectedApps] = useState<ScreenTimeItem[]>([]);
  const [blockMode, setBlockMode] = useState<BlockMode>("block");

  const blockedAppsSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["78%"], []);

  const focusMode = isHardMode ? "deep" : "flexible";

  // Hard Mode's growth bonus is earned by finishing the stricter block, not by
  // holding a subscription — a free and a Premium normal block are worth the same.
  const expectedGrowth = estimateGrowthCm({
    minutes: totalMinutes,
    blockType: "quick",
    isHardBlock: isHardMode,
    streakDays: growthPreview.streakDays,
    rawGrowthTodayCm: growthPreview.rawGrowthTodayCm,
  });

  const hasBreaks = supportsBreaks(totalMinutes, isHardMode);
  const breakSummary = describeBreakAllowance(totalMinutes, isHardMode);

  // Never Allowed always ends up shielded, but the two modes read their id
  // list in opposite directions: "block" shields the list, "allowOnly" spares
  // it. So the same intent means adding to one list and subtracting from the
  // other — unioning in both would hand Allow Only a free pass to the very
  // apps the user said to never allow.
  const effectiveAppIds = useMemo(() => {
    const picked = selectedApps.map((item) => item.id);
    if (blockMode === "allowOnly") {
      const banned = new Set(neverAllowedApps.map((item) => item.id));
      return picked.filter((id) => !banned.has(id));
    }
    return [...new Set([...picked, ...neverAllowedApps.map((item) => item.id)])];
  }, [selectedApps, neverAllowedApps, blockMode]);

  // The same count means opposite things in the two modes, so the row says
  // which one it is rather than leaving "5 Apps" to be read as blocked.
  const appsRowValue = (() => {
    const count = effectiveAppIds.length;
    if (blockMode === "allowOnly") {
      return count === 0 ? "None allowed" : `${count} allowed`;
    }
    return count === 0 ? "All apps" : `${count} ${count === 1 ? "App" : "Apps"}`;
  })();

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

  // Seeds from the persisted system selection, but only while nothing has been
  // chosen here yet — the native selection is a superset, so re-reading it on
  // every open would undo any item the user deselected in the Blocked Apps sheet.
  const handleSheetChange = useCallback(async (index: number) => {
    if (index !== 0) return;
    try {
      const items = await ScreenTime.getSelectedItems();
      // Falling back to the onboarding choices keeps a first session from
      // opening on an empty selection with a disabled Start button.
      setSelectedApps((prev) =>
        prev.length > 0 ? prev : items.length > 0 ? items : distractingApps
      );
    } catch {
      // Silently fail; the user can still pick apps from the Blocked Apps sheet.
    }
  }, [distractingApps]);

  // Losing premium (a lapsed subscription) must not leave a PRO-only setting
  // switched on behind the user's back.
  useEffect(() => {
    if (isPremium) return;
    setIsHardMode(false);
    setBlockMode("block");
  }, [isPremium]);

  const handleToggleHardMode = useCallback(
    (value: boolean) => {
      if (value && !isPremium) {
        onUpgrade();
        return;
      }
      setIsHardMode(value);
    },
    [isPremium, onUpgrade]
  );

  const handleDecrease = useCallback(() => {
    durationTouchedRef.current = true;
    setTotalMinutes((prev) => stepDuration(prev, -1));
  }, []);
  const handleIncrease = useCallback(() => {
    durationTouchedRef.current = true;
    setTotalMinutes((prev) => stepDuration(prev, 1));
  }, []);

  const handleConfirmApps = useCallback((apps: ScreenTimeItem[], mode: BlockMode) => {
    setSelectedApps(apps);
    setBlockMode(mode);
  }, []);

  const handleStart = useCallback(() => {
    const config: FocusSessionConfig = {
      durationMinutes: totalMinutes,
      focusMode,
      blockType: "quick",
      expectedGrowthCm: expectedGrowth,
      appIds: effectiveAppIds,
      blockMode,
      isHardMode,
    };

    sheetRef.current?.dismiss();
    onStartSession(config);
  }, [
    totalMinutes,
    focusMode,
    expectedGrowth,
    effectiveAppIds,
    blockMode,
    isHardMode,
    sheetRef,
    onStartSession,
  ]);

  // Allow Only with nothing picked would shield the entire device with no way
  // back in, so the start button stays locked until something is allowed.
  const isStartDisabled = blockMode === "allowOnly" && effectiveAppIds.length === 0;

  return (
    <>
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
          <View style={styles.header}>
            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              hitSlop={12}
              style={styles.headerButton}
              testID="focus-sheet-close"
            >
              <Ionicons name="close" size={22} color={Theme.colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Quick Block</Text>
            <View style={styles.headerButtonSpacer} />
          </View>

          {/* ── Expected Growth (unchanged) ─────────────────────────── */}
          <Text style={styles.growthAmount}>
            Expected Growth: {currentSizeCm}cm+({expectedGrowth}cm)
          </Text>

          {/* ── Duration ────────────────────────────────────────────── */}
          <View style={styles.durationRow}>
            <Pressable
              onPress={handleDecrease}
              disabled={totalMinutes <= MIN_DURATION}
              hitSlop={8}
              testID="duration-decrease"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.pressed,
                totalMinutes <= MIN_DURATION && styles.stepButtonDisabled,
              ]}
            >
              <Ionicons name="remove" size={26} color={Theme.colors.text} />
            </Pressable>

            <View style={styles.durationPill}>
              <Text style={styles.durationText}>{formatDuration(totalMinutes)}</Text>
            </View>

            <Pressable
              onPress={handleIncrease}
              disabled={totalMinutes >= MAX_DURATION}
              hitSlop={8}
              testID="duration-increase"
              style={({ pressed }) => [
                styles.stepButton,
                pressed && styles.pressed,
                totalMinutes >= MAX_DURATION && styles.stepButtonDisabled,
              ]}
            >
              <Ionicons name="add" size={26} color={Theme.colors.text} />
            </Pressable>
          </View>

          {/* ── Rows ────────────────────────────────────────────────── */}
          <View style={styles.rows}>
            <SettingRow
              title="Blocked Apps"
              value={appsRowValue}
              chevron
              onPress={() => blockedAppsSheetRef.current?.present()}
              testID="blocked-apps-row"
            />

            <SettingRow
              title="Breaks"
              subtitle={
                hasBreaks
                  ? "Pause the block without ending it"
                  : isHardMode
                    ? "Hard Mode runs straight through"
                    : `Blocks of ${formatDuration(60)} or longer earn breaks`
              }
              value={breakSummary}
              disabled={!hasBreaks}
              testID="breaks-row"
            />

            <SettingRow
              title="Hard Mode"
              subtitle="Can't end this block early"
              pro={!isPremium}
              testID="hard-mode-row"
              accessory={
                <Switch
                  value={isHardMode}
                  onValueChange={handleToggleHardMode}
                  trackColor={SWITCH_TRACK_COLOR}
                  thumbColor={Theme.colors.white}
                  testID="hard-mode-switch"
                />
              }
            />
          </View>

          <HoldToStartButton
            label={isStartDisabled ? "Pick an app to allow" : "Hold to Start"}
            onComplete={handleStart}
            disabled={isStartDisabled}
            style={styles.startButton}
            testID="hold-to-start"
          />
        </BottomSheetScrollView>
      </BottomSheetModal>

      <BlockedAppsSheet
        sheetRef={blockedAppsSheetRef}
        selected={selectedApps}
        mode={blockMode}
        suggested={distractingApps}
        isPremium={isPremium}
        onUpgrade={onUpgrade}
        onConfirm={handleConfirmApps}
        neverAllowed={neverAllowedApps}
        onChangeNeverAllowed={setNeverAllowedApps}
      />
    </>
  );
}

const SWITCH_TRACK_COLOR = {
  false: Theme.colors.cardBorder,
  true: Theme.colors.secondary,
} as const;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: Theme.radius.xxl,
    borderTopRightRadius: Theme.radius.xxl,
    ...Theme.shadows.sheet,
  },
  handleIndicator: {
    width: 40,
    backgroundColor: Theme.colors.gray,
    opacity: 0.35,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xxl,
    paddingTop: Theme.spacing.sm,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.xl,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  headerButtonSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },

  /* Expected Growth */
  growthAmount: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    textAlign: "center",
  },

  /* Duration */
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.xxl,
  },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  durationPill: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  durationText: {
    fontSize: 26,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },

  /* Rows */
  rows: {
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.xl,
  },

  startButton: {
    marginTop: Theme.spacing.xxxl,
  },
  pressed: {
    opacity: 0.7,
  },
});

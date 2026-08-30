import { ActiveBlockControls, ActiveBlockStatus } from "@/components/ActiveBlockPanel";
import EditBlockSheet from "@/components/EditBlockSheet";
import EndSessionConfirmModal from "@/components/EndSessionConfirmModal";
import FocusSessionSheet from "@/components/FocusSessionSheet";
import GrowthResultModal from "@/components/GrowthResultModal";
import NameGateModal from "@/components/NameGateModal";
import SettingsButton from "@/components/SettingsButton";
import { GrowthScene } from "@/components/growth";
import { FirstSessionCoachMark } from "@/components/onboarding";
import { Button, Screen } from "@/components/ui";
import { computeMarshmallowSizeCm } from "@/constants/marshmallow";
import Theme from "@/constants/theme";
import {
  useFocusSession,
  type FocusSessionConfig,
} from "@/contexts/FocusSessionContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { ensureScreenTimeAuthorized } from "@/lib/screenTimeAuth";
import { useEditBlockFlow } from "@/lib/useEditBlockFlow";
import * as ScreenTime from "@/modules/screen-time";
import { BottomSheetModal, useBottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

/** Short enough that a first session is an easy yes, long enough to be worth running. */
const FIRST_SESSION_MINUTES = 15;

interface HomeScreenProps {
  /**
   * Whether the scene's scrub haptics are allowed to fire. Set to false if the
   * scene ever comes to be driven by background data instead of direct user
   * interaction, so growth doesn't buzz the phone unprompted.
   */
  hapticsEnabled?: boolean;
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ hapticsEnabled = true }: HomeScreenProps) {
  const router = useRouter();
  const profile = useMarshmallowProfile();
  const { hasStartedFirstFocusSession, markFirstFocusSessionStarted } = useOnboarding();

  const {
    activeSession,
    history,
    pendingGrowthResult,
    startSession,
    stopSession,
    clearPendingGrowthResult,
    isOnBreak,
    breakAvailability,
    startBreak,
    endBreak,
  } = useFocusSession();

  const actualSizeCm = useMemo(() => computeMarshmallowSizeCm(history), [history]);

  // The scene holds the pre-growth size for as long as a result popup is
  // waiting to be dismissed, so the marshmallow grows *after* the user has
  // read the popup instead of behind it. Growth is additive and rounded to the
  // same 0.1cm, so subtracting it reproduces the earlier size exactly.
  const displayedSizeCm = pendingGrowthResult
    ? actualSizeCm - pendingGrowthResult.growthCm
    : actualSizeCm;

  // Growth still owed to the marshmallow, either because the block is running
  // or because its payout is waiting behind the popup. Either way the
  // silhouette stands where that growth lands, so the marshmallow visibly
  // grows into it once the popup is dismissed.
  const owedGrowthCm =
    activeSession?.expectedGrowthCm ?? pendingGrowthResult?.growthCm;
  const projectedSizeCm =
    owedGrowthCm != null ? displayedSizeCm + owedGrowthCm : undefined;

  const isFocusActive = !!activeSession;
  // A session started by a Timed Block plan carries `planId`; one started
  // manually from this screen ("Quick Block") never does. Both run the same
  // UI now — the only difference is the name over the countdown.
  const isQuickBlockActive = isFocusActive && !activeSession?.planId;
  const [isLoading, setIsLoading] = useState(false);
  const focusSheetRef = useRef<BottomSheetModal>(null);
  const { dismissAll } = useBottomSheetModal();

  // The activation goal is a real session, not arriving here, so the hint only
  // exists for someone who has never run one. `history` keeps it away from
  // people who focused before this flag existed.
  const [isCoachMarkDismissed, setIsCoachMarkDismissed] = useState(false);
  const showCoachMark =
    !hasStartedFirstFocusSession &&
    !isCoachMarkDismissed &&
    !isFocusActive &&
    history.length === 0;

  const {
    editBlockSheetRef,
    isEditGateVisible,
    openEditGate,
    cancelEditGate,
    confirmEditGate,
    saveEditedBlock,
  } = useEditBlockFlow();

  const [remainingMs, setRemainingMs] = useState(0);
  useEffect(() => {
    if (!activeSession) return;
    const endsAt = activeSession.startedAt + activeSession.durationMinutes * 60_000;
    const tick = () => setRemainingMs(Math.max(0, endsAt - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // The paywall is a route, but the PRO controls that lead to it live inside
  // stacked bottom sheets — pushing without dismissing them first leaves the
  // paywall rendering underneath, so the tap looks like it did nothing.
  const handleUpgrade = useCallback(() => {
    dismissAll();
    router.push("/premium");
  }, [dismissAll, router]);

  const handleOpenFocusSheet = useCallback(async () => {
    const authorized = await ensureScreenTimeAuthorized();
    if (!authorized) return;
    focusSheetRef.current?.present();
  }, []);

  const handleStartSession = useCallback(async (config: FocusSessionConfig) => {
    setIsLoading(true);
    try {
      await ScreenTime.applyBlockMode(config.blockMode ?? "block", config.appIds ?? []);
      startSession(config);
      markFirstFocusSessionStarted();
    } catch (error) {
      Alert.alert("Error", `Failed to start focus session: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [markFirstFocusSessionStarted, startSession]);

  const [isEndConfirmVisible, setIsEndConfirmVisible] = useState(false);

  const isHardModeActive = !!activeSession?.isHardMode;

  const handleStopFocus = useCallback(() => {
    if (isHardModeActive) {
      Alert.alert(
        "Hard Mode",
        "This block runs to the end. That was the deal when you started it."
      );
      return;
    }
    setIsEndConfirmVisible(true);
  }, [isHardModeActive]);

  const handleConfirmStopFocus = useCallback(() => {
    setIsEndConfirmVisible(false);
    stopSession();
  }, [stopSession]);

  return (
    <Screen style={styles.screen}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marshmallow</Text>
        <SettingsButton onPress={() => router.push("/settings")} />
      </View>

      {/* ── Time left on the running block ──────────────────────────── */}
      {activeSession && (
        <ActiveBlockStatus
          label={isQuickBlockActive ? "Quick Block" : activeSession.label ?? "Scheduled Block"}
          remainingMs={remainingMs}
          focusMode={activeSession.focusMode}
          isOnBreak={isOnBreak}
        />
      )}

      {/* ── Growth scene: scale world, ruler and size readout ───────── */}
      <View style={[styles.growthSlot, isFocusActive && styles.growthSlotBlocking]}>
        <GrowthScene
          sizeCm={displayedSizeCm}
          projectedSizeCm={projectedSizeCm}
          color={profile.color}
          name={profile.name}
          items={profile.items}
          isBlocking={isFocusActive}
          hapticsEnabled={hapticsEnabled}
        />
      </View>

      {/* ── Running block: break, then the quiet way out ─────────────── */}
      {isFocusActive ? (
        <ActiveBlockControls
          isOnBreak={isOnBreak}
          breakAvailability={breakAvailability}
          isHardMode={isHardModeActive}
          onStartBreak={startBreak}
          onEndBreak={endBreak}
          onEdit={openEditGate}
          onEnd={handleStopFocus}
        />
      ) : (
        <>
          {/* ── First-session hint ──────────────────────────────────── */}
          {showCoachMark && (
            <View style={styles.coachMark}>
              <FirstSessionCoachMark onDismiss={() => setIsCoachMarkDismissed(true)} />
            </View>
          )}

          {/* ── Start Focus button ──────────────────────────────────── */}
          <Button
            onPress={handleOpenFocusSheet}
            loading={isLoading}
            icon="timer-outline"
            iconSize={22}
            label="Start Focus Session"
            style={[styles.focusButton, showCoachMark && styles.focusButtonHinted]}
          />
        </>
      )}

      {/* ── Focus session settings sheet ──────────────────────────── */}
      <FocusSessionSheet
        sheetRef={focusSheetRef}
        currentSizeCm={actualSizeCm}
        onStartSession={handleStartSession}
        defaultDurationMinutes={
          hasStartedFirstFocusSession ? undefined : FIRST_SESSION_MINUTES
        }
        onUpgrade={handleUpgrade}
      />

      <EndSessionConfirmModal
        visible={isEndConfirmVisible}
        marshmallowName={profile.name}
        onConfirm={handleConfirmStopFocus}
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
        onCancelBlock={handleStopFocus}
      />

      {pendingGrowthResult && (
        <GrowthResultModal
          visible
          growthCm={pendingGrowthResult.growthCm}
          durationMinutes={pendingGrowthResult.durationMinutes}
          focusMode={pendingGrowthResult.focusMode}
          label={pendingGrowthResult.label}
          onDismiss={clearPendingGrowthResult}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: Theme.spacing.xxl,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },

  /* Growth scene sits toward the top of the leftover space so it isn't
     glued to the button, with a little air under the header. */
  growthSlot: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: Theme.spacing.xl + Theme.spacing.lg,
    marginHorizontal: -Theme.spacing.xxl,
    // Left shrinkable on purpose. The scene inside is a fixed height, so on a
    // screen too short for everything it overflows and the controls draw over
    // its readout — ugly, but every control stays reachable. Pinning the slot
    // instead would push "End block" off the bottom, and that is the only way
    // out of a running block.
  },
  /* Sits the scene clear of the countdown, which is the tallest thing on the
     screen while a block runs. */
  growthSlotBlocking: {
    paddingTop: Theme.spacing.xxxl,
  },

  /* Focus button */
  focusButton: {
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: Theme.spacing.xxxl,
    marginBottom: 48,
  },
  focusButtonHinted: {
    marginTop: Theme.spacing.md,
  },

  /* First-session hint, sitting where the button's top margin would be */
  coachMark: {
    marginTop: Theme.spacing.xxl,
  },
});

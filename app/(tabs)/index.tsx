import EditBlockSheet from "@/components/EditBlockSheet";
import EndSessionConfirmModal from "@/components/EndSessionConfirmModal";
import FocusSessionSheet, {
  type FocusSessionConfig,
} from "@/components/FocusSessionSheet";
import GrowthResultModal from "@/components/GrowthResultModal";
import NameGateModal from "@/components/NameGateModal";
import ProfileAvatarButton from "@/components/ProfileAvatarButton";
import { GrowthScene } from "@/components/growth";
import { Button, Card, Screen } from "@/components/ui";
import { formatTimeRemaining } from "@/constants/marshmallow";
import Theme from "@/constants/theme";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { ensureScreenTimeAuthorized } from "@/lib/screenTimeAuth";
import { useEditBlockFlow } from "@/lib/useEditBlockFlow";
import * as ScreenTime from "@/modules/screen-time";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

const INITIAL_SIZE_CM = 3;

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

  const {
    activeSession,
    totalGrowthCm,
    pendingGrowthResult,
    startSession,
    stopSession,
    clearPendingGrowthResult,
  } = useFocusSession();

  /** The marshmallow's real size, from account growth so every device matches. */
  const actualSizeCm = useMemo(() => {
    return Math.round((INITIAL_SIZE_CM + totalGrowthCm) * 10) / 10;
  }, [totalGrowthCm]);
  const isFocusActive = !!activeSession;
  // A session started by a Timed Block plan carries `planId`; one started
  // manually from this screen ("Quick Block") never does. The two get
  // distinct UI here — see the Start/End Focus button section below.
  const isQuickBlockActive = isFocusActive && !activeSession?.planId;
  const isTimedBlockActive = isFocusActive && !!activeSession?.planId;
  const [isLoading, setIsLoading] = useState(false);
  const focusSheetRef = useRef<BottomSheetModal>(null);

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

  const handleOpenFocusSheet = useCallback(async () => {
    const authorized = await ensureScreenTimeAuthorized();
    if (!authorized) return;
    focusSheetRef.current?.present();
  }, []);

  const handleStartSession = useCallback(async (config: FocusSessionConfig) => {
    setIsLoading(true);
    try {
      await ScreenTime.blockAll();
      startSession(config);
    } catch (error) {
      Alert.alert("Error", `Failed to start focus session: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [startSession]);

  const [isEndConfirmVisible, setIsEndConfirmVisible] = useState(false);

  const handleStopFocus = useCallback(() => {
    setIsEndConfirmVisible(true);
  }, []);

  const handleConfirmStopFocus = useCallback(() => {
    setIsEndConfirmVisible(false);
    stopSession();
  }, [stopSession]);

  return (
    <Screen style={styles.screen}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marshmallow</Text>
        <ProfileAvatarButton onPress={() => router.push("/profile")} />
      </View>

      {/* ── Growth scene: scale world, ruler and size readout ───────── */}
      <GrowthScene
        sizeCm={actualSizeCm}
        color={profile.color}
        name={profile.name}
        items={profile.items}
        hapticsEnabled={hapticsEnabled}
        style={styles.growthScene}
      />

      {/* ── Quick Block timer ───────────────────────────────────────── */}
      {isQuickBlockActive && (
        <Card style={styles.quickBlockCard}>
          <Text style={styles.quickBlockLabel}>Quick Block Active</Text>
          <Text style={styles.quickBlockTime}>{formatTimeRemaining(remainingMs)}</Text>
          <Text style={styles.quickBlockDesc}>
            {activeSession?.focusMode === "deep" ? "Deep Focus" : "Flexible"} · +
            {activeSession?.expectedGrowthCm}cm
          </Text>
          <Button
            variant="outline"
            onPress={openEditGate}
            icon="create-outline"
            iconSize={16}
            label="Edit Block"
            style={styles.quickBlockEditButton}
          />
        </Card>
      )}

      {/* ── Timed Block indicator ───────────────────────────────────── */}
      {isTimedBlockActive && (
        <Card style={styles.timedBlockCard}>
          <Ionicons
            name="hourglass-outline"
            size={24}
            color={Theme.colors.secondary}
          />
          <Text style={styles.timedBlockTitle}>Timed Block Active</Text>
          <Text style={styles.timedBlockDesc}>
            {activeSession?.label ?? "A scheduled block"} is blocking your apps
          </Text>
          <View style={styles.timedBlockActions}>
            <Button
              variant="outline"
              onPress={openEditGate}
              icon="create-outline"
              iconSize={16}
              label="Edit Block"
              style={styles.timedBlockButton}
            />
            <Button
              variant="outline"
              onPress={() => router.push("/timed-block")}
              icon="time-outline"
              iconSize={16}
              label="View Time Left"
              style={styles.timedBlockButton}
            />
          </View>
        </Card>
      )}

      {/* ── Start / End Focus button ──────────────────────────────────── */}
      <Button
        onPress={isFocusActive ? handleStopFocus : handleOpenFocusSheet}
        loading={isLoading}
        icon={isFocusActive ? "stop-circle-outline" : "timer-outline"}
        iconSize={22}
        label={isFocusActive ? "End Focus Session" : "Start Focus Session"}
        style={[
          styles.focusButton,
          isFocusActive && styles.focusButtonActiveSpacing,
          isFocusActive && styles.focusButtonActive,
        ]}
      />

      {/* ── Focus session settings sheet ──────────────────────────── */}
      <FocusSessionSheet
        sheetRef={focusSheetRef}
        currentSizeCm={actualSizeCm}
        onStartSession={handleStartSession}
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

  /* Growth scene — bled out to the screen edges so the camera has room */
  growthScene: {
    marginTop: Theme.spacing.sm,
    marginHorizontal: -Theme.spacing.xxl,
  },

  /* Focus button */
  focusButton: {
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: Theme.spacing.xxxl,
    marginBottom: Theme.spacing.sm,
  },
  focusButtonActive: {
    backgroundColor: Theme.colors.danger,
  },
  focusButtonActiveSpacing: {
    marginTop: Theme.spacing.xl,
  },

  /* Quick Block timer */
  quickBlockCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Theme.colors.secondary,
    padding: 20,
    alignItems: "center",
    marginTop: 28,
  },
  quickBlockLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickBlockTime: {
    fontSize: 36,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: 6,
  },
  quickBlockDesc: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  quickBlockEditButton: {
    marginTop: 14,
  },

  /* Timed Block indicator */
  timedBlockCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginTop: 28,
  },
  timedBlockTitle: {
    fontSize: 17,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: 8,
  },
  timedBlockDesc: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  timedBlockActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  timedBlockButton: {
    flex: 1,
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  withTiming,
  withDecay,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { ensureScreenTimeAuthorized } from "@/lib/screenTimeAuth";
import * as ScreenTime from "@/modules/screen-time";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import ProfileAvatarButton from "@/components/ProfileAvatarButton";
import SceneObject from "@/components/SceneObject";
import FocusSessionSheet from "@/components/FocusSessionSheet";
import type { FocusSessionConfig } from "@/contexts/FocusSessionContext";
import EndSessionConfirmModal from "@/components/EndSessionConfirmModal";
import NameGateModal from "@/components/NameGateModal";
import GrowthResultModal from "@/components/GrowthResultModal";
import EditBlockSheet from "@/components/EditBlockSheet";
import { Screen, Button, Card } from "@/components/ui";
import { GROWTH_STAGES, getStageForSize, OBJECT_STAGES } from "@/constants/growthStages";
import { formatTimeRemaining } from "@/constants/marshmallow";
import { getCameraPosition, getFocusedStageIndex, OBJECT_GROUND_Y } from "@/lib/sceneMath";
import useSelectionHaptic from "@/lib/useSelectionHaptic";
import { useEditBlockFlow } from "@/lib/useEditBlockFlow";

const INITIAL_SIZE_CM = 3;

// `MarshmallowCharacter` has its own internal size-driven micro-scale (used
// for minor face proportions). It's pinned to this constant so the real
// growth signal comes entirely from the wrapper scale below — otherwise the
// marshmallow would visibly grow with `actualSizeCm` even in normal mode.
const MARSHMALLOW_BASE_SIZE_CM = INITIAL_SIZE_CM;

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

/** How far the currently-previewed reference size has drifted from the real one. */
function isPreviewingSize(previewCm: number, actualCm: number) {
  return Math.abs(previewCm - actualCm) > HAPTIC_STEP_CM / 2;
}

const SCENE_HEIGHT = 300;
/** Must match MarshmallowCharacter body style height. */
const MARSHMALLOW_BODY_HEIGHT = 222;
const CAMERA_ANIMATION_DURATION = 400;
const CAMERA_ANIMATION_EASING = Easing.out(Easing.cubic);

// ── Scrub gesture tuning ─────────────────────────────────────────────────────
/** Pixels of horizontal drag per centimeter of preview size. Drag left to grow, right to shrink. */
const PX_PER_CM = 14;
/** Preview updates (and fires a tick haptic) every this many centimeters of scroll. */
const HAPTIC_STEP_CM = 0.1;
const MIN_PREVIEW_CM = GROWTH_STAGES[0].sizeCm;
const MAX_PREVIEW_CM = GROWTH_STAGES[GROWTH_STAGES.length - 1].sizeCm;

function roundToStep(value: number) {
  "worklet";
  return Math.round(value / HAPTIC_STEP_CM) * HAPTIC_STEP_CM;
}

function crossesPoint(from: number, to: number, point: number) {
  "worklet";
  return (from < point && to >= point) || (from > point && to <= point);
}

function fireTickHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

function fireLockHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

interface HomeScreenProps {
  /**
   * Whether the centered-stage haptic tick is allowed to fire. Set to false
   * if `sizeCm` ever comes to be driven by background data instead of direct
   * user interaction, so growth doesn't buzz the phone unprompted.
   */
  hapticsEnabled?: boolean;
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ hapticsEnabled = true }: HomeScreenProps) {
  const router = useRouter();
  const profile = useMarshmallowProfile();

  const {
    activeSession,
    history,
    pendingGrowthResult,
    startSession,
    stopSession,
    clearPendingGrowthResult,
  } = useFocusSession();

  // `actualSizeCm` is the marshmallow's real size derived from completed
  // session history. `previewMirrorCm` is a JS-thread mirror of the
  // drag-scrubbed reference size (in 0.1cm steps); it starts equal to
  // `actualSizeCm` and only diverges while scrubbing away from it.
  const actualSizeCm = useMemo(() => {
    const totalGrowth = history.reduce((sum, s) => sum + s.expectedGrowthCm, 0);
    return Math.round((INITIAL_SIZE_CM + totalGrowth) * 10) / 10;
  }, [history]);
  const [previewMirrorCm, setPreviewMirrorCm] = useState(INITIAL_SIZE_CM);
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

  const isPreviewing = isPreviewingSize(previewMirrorCm, actualSizeCm);
  // Normal mode: the scene is scaled relative to the real size. Preview
  // mode: it's scaled relative to whatever size is being scrubbed to.
  const comparisonReferenceSizeCm = isPreviewing ? previewMirrorCm : actualSizeCm;
  const referenceStage = getStageForSize(comparisonReferenceSizeCm);
  const isDiscovered = referenceStage.sizeCm <= actualSizeCm;

  const focusedStageIndex = getFocusedStageIndex(actualSizeCm, OBJECT_STAGES);
  useSelectionHaptic(focusedStageIndex, hapticsEnabled);

  // Single animated camera position on the object line, driven every frame
  // by the (possibly-scrubbed) preview size for smooth panning while dragging.
  const previewSizeCm = useSharedValue(INITIAL_SIZE_CM);
  const actualSizeCmShared = useSharedValue(INITIAL_SIZE_CM);
  const restCameraPosition = useSharedValue(getCameraPosition(INITIAL_SIZE_CM, OBJECT_STAGES));
  const cameraPosition = useDerivedValue(() =>
    getCameraPosition(previewSizeCm.value, OBJECT_STAGES)
  );

  // Gesture-local bookkeeping (persists across drag frames, reset per gesture).
  const previousTranslationX = useSharedValue(0);
  const isDragging = useSharedValue(0);
  // True while a post-release fling is still coasting under `withDecay`.
  const isMomentumActive = useSharedValue(0);
  // True until the scrub passes through the "original size" once — then it
  // freezes there for the rest of this gesture (dragging AND any momentum
  // that follows it). Lifting and starting a new drag (onBegin) re-arms it.
  const lockArmed = useSharedValue(1);
  const lastTickCm = useSharedValue(INITIAL_SIZE_CM);

  useEffect(() => {
    actualSizeCmShared.value = actualSizeCm;
    restCameraPosition.value = getCameraPosition(actualSizeCm, OBJECT_STAGES);
    // Only follow real (non-drag) size changes — e.g. growth landing while
    // the user isn't touching the scene. Releasing a drag never snaps back.
    if (isDragging.value === 0 && isMomentumActive.value === 0) {
      previewSizeCm.value = withTiming(actualSizeCm, {
        duration: CAMERA_ANIMATION_DURATION,
        easing: CAMERA_ANIMATION_EASING,
      });
    }
  }, [actualSizeCm]);

  // Single source of truth for what happens whenever the (possibly-animated)
  // reference size changes, whether from direct dragging, momentum coasting
  // after release, or the real-growth sync above. Mirrors it into React
  // state in 0.1cm steps (size text, marshmallow scale, tick haptics), and —
  // only for user-driven motion — freezes it the moment it crosses the
  // "original size" lock point, cancelling any in-flight momentum.
  useAnimatedReaction(
    () => previewSizeCm.value,
    (current, previous) => {
      if (previous === null) {
        return;
      }

      const isUserMotion = isDragging.value === 1 || isMomentumActive.value === 1;

      if (isUserMotion && lockArmed.value === 1) {
        const lockPoint = actualSizeCmShared.value;
        if (crossesPoint(previous, current, lockPoint)) {
          cancelAnimation(previewSizeCm);
          previewSizeCm.value = lockPoint;
          lockArmed.value = 0;
          isMomentumActive.value = 0;
          lastTickCm.value = roundToStep(lockPoint);
          scheduleOnRN(setPreviewMirrorCm, lastTickCm.value);
          scheduleOnRN(fireLockHaptic);
          return;
        }
      }

      const tick = roundToStep(current);
      if (tick !== lastTickCm.value) {
        lastTickCm.value = tick;
        scheduleOnRN(setPreviewMirrorCm, tick);
        if (isUserMotion) {
          scheduleOnRN(fireTickHaptic);
        }
      }
    }
  );

  const marshmallowAnimatedStyle = useAnimatedStyle(() => {
    const diff = Math.abs(previewSizeCm.value - actualSizeCmShared.value);
    const previewing = diff > HAPTIC_STEP_CM / 2;
    const scale = previewing ? actualSizeCmShared.value / previewSizeCm.value : 1;

    // Translate rightward only during right drag (viewing smaller objects).
    // Left drag (viewing bigger objects): marshmallow stays fixed.
    const isRightDrag = previewSizeCm.value < actualSizeCmShared.value - HAPTIC_STEP_CM / 2;
    const translateX = isRightDrag
      ? restCameraPosition.value - cameraPosition.value
      : 0;

    return {
      transform: [{ translateX }, { scale }],
    };
  });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      "worklet";
      cancelAnimation(previewSizeCm);
      isDragging.value = 1;
      isMomentumActive.value = 0;
      previousTranslationX.value = 0;
      lockArmed.value = 1;
    })
    .onUpdate((event) => {
      "worklet";
      if (lockArmed.value === 0) {
        // Locked at the original size for the rest of this gesture — the
        // scroll simply stops until the finger lifts and a new drag begins.
        return;
      }

      // Inverted so the scene follows the finger's intended direction — see
      // `.onEnd` below, which inverts `velocityX` the same way so momentum
      // continues in this same corrected direction after release.
      const translation = -event.translationX;
      const deltaCm = (translation - previousTranslationX.value) / PX_PER_CM;
      previousTranslationX.value = translation;

      previewSizeCm.value = clamp(
        previewSizeCm.value + deltaCm,
        MIN_PREVIEW_CM,
        MAX_PREVIEW_CM
      );
    })
    .onEnd((event) => {
      "worklet";
      if (lockArmed.value === 0) {
        // Already locked mid-drag — no momentum should carry through.
        return;
      }
      const velocity = -event.velocityX / PX_PER_CM;
      isMomentumActive.value = 1;
      previewSizeCm.value = withDecay(
        { velocity, clamp: [MIN_PREVIEW_CM, MAX_PREVIEW_CM] },
        () => {
          "worklet";
          isMomentumActive.value = 0;
        }
      );
    })
    .onFinalize(() => {
      "worklet";
      isDragging.value = 0;
    });

  const handleOpenFocusSheet = useCallback(async () => {
    const authorized = await ensureScreenTimeAuthorized();
    if (!authorized) return;
    focusSheetRef.current?.present();
  }, []);

  const handleStartSession = useCallback(async (config: FocusSessionConfig) => {
    setIsLoading(true);
    try {
      const appIds = config.appIds ?? [];
      if (appIds.length > 0) {
        await ScreenTime.applyBlocking(appIds);
      } else {
        await ScreenTime.blockAll();
      }
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

      {/* ── Comparison scene ────────────────────────────────────────── */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.scene}>
          {/* All objects on a single line — only visible ones show */}
          {OBJECT_STAGES.map((obj, i) => (
            <SceneObject
              key={obj.id}
              stage={obj}
              index={i}
              cameraPosition={cameraPosition}
              currentSizeCm={comparisonReferenceSizeCm}
            />
          ))}

          {/* Marshmallow (rendered last = foreground) */}
          <View style={styles.marshmallowPosition}>
            <Animated.View
              style={[styles.marshmallowScale, marshmallowAnimatedStyle]}
            >
              <MarshmallowCharacter
                color={profile.color}
                name={profile.name}
                sizeCm={MARSHMALLOW_BASE_SIZE_CM}
              />
            </Animated.View>
          </View>
        </View>
      </GestureDetector>


      {/* ── Info section ────────────────────────────────────────────── */}
      <View style={styles.infoSection}>
        <Text style={styles.sizeText}>
          {actualSizeCm}cm
        </Text>
        <Text style={styles.messageText}>
          {isDiscovered ? referenceStage.message : "???"}
        </Text>
      </View>


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
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },

  /* Scene */
  scene: {
    height: SCENE_HEIGHT,
    marginTop: 8,
    position: "relative",
    overflow: "hidden",
  },

  /* Marshmallow */
  marshmallowPosition: {
    position: "absolute",
    // Align the marshmallow's vertical center with the objects' ground line.
    bottom: OBJECT_GROUND_Y - MARSHMALLOW_BODY_HEIGHT / 2,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  marshmallowScale: {
    // Scale from the feet, not the center — otherwise shrinking (comparing
    // against huge future objects) lifts the marshmallow's feet off the
    // ground line so it looks like it's floating in front of the object,
    // and growing (comparing against tiny early objects) pushes it down
    // through the floor instead of up and out of frame.
    transformOrigin: "50% 100%",
  },

  /* Info */
  infoSection: {
    alignItems: "center",
    marginTop: 28,
    gap: 4,
  },
  sizeText: {
    fontSize: 50,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  messageText: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },

  /* Focus button */
  focusButton: {
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 76,
  },
  focusButtonActive: {
    backgroundColor: Theme.colors.danger,
  },
  focusButtonActiveSpacing: {
    marginTop: 20,
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

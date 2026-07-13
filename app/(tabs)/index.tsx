import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useSharedValue, withTiming, Easing } from "react-native-reanimated";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { ensureScreenTimeAuthorized } from "@/lib/screenTimeAuth";
import * as ScreenTime from "@/modules/screen-time";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import ProfileAvatarButton from "@/components/ProfileAvatarButton";
import SceneObject from "@/components/SceneObject";
import FocusSessionSheet, {
  type FocusSessionConfig,
} from "@/components/FocusSessionSheet";
import { Screen, Button } from "@/components/ui";
import { getStageForSize, OBJECT_STAGES } from "@/constants/growthStages";
import { getCameraPosition, getFocusedStageIndex } from "@/lib/sceneMath";
import useSelectionHaptic from "@/lib/useSelectionHaptic";

const INITIAL_SIZE_CM = 3;

const BODY_HEIGHT = 222;
const TARGET_HEIGHT = 175;
function marshmallowWrapperScale(sizeCm: number) {
  const internal = 0.9 + Math.min(sizeCm / 60, 0.4);
  return TARGET_HEIGHT / (BODY_HEIGHT * internal);
}

const SCENE_HEIGHT = 300;
const CAMERA_ANIMATION_DURATION = 400;
const CAMERA_ANIMATION_EASING = Easing.out(Easing.cubic);

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

  const [sizeCm, setSizeCm] = useState(INITIAL_SIZE_CM);
  const { activeSession, startSession, stopSession } = useFocusSession();
  const isFocusActive = !!activeSession;
  const [isLoading, setIsLoading] = useState(false);
  const focusSheetRef = useRef<BottomSheetModal>(null);

  const stage = getStageForSize(sizeCm);
  const wrapperScale = marshmallowWrapperScale(sizeCm);

  const focusedStageIndex = getFocusedStageIndex(sizeCm, OBJECT_STAGES);
  useSelectionHaptic(focusedStageIndex, hapticsEnabled);

  // Single animated camera position on the object line
  const cameraPosition = useSharedValue(getCameraPosition(sizeCm, OBJECT_STAGES));

  useEffect(() => {
    cameraPosition.value = withTiming(getCameraPosition(sizeCm, OBJECT_STAGES), {
      duration: CAMERA_ANIMATION_DURATION,
      easing: CAMERA_ANIMATION_EASING,
    });
  }, [sizeCm]);

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

  const handleStopFocus = useCallback(async () => {
    try {
      await ScreenTime.clearBlocking();
      stopSession();
    } catch (error) {
      Alert.alert("Error", `Failed to stop focus session: ${error}`);
    }
  }, [stopSession]);

  return (
    <Screen style={styles.screen}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marshmallow</Text>
        <ProfileAvatarButton onPress={() => router.push("/profile")} />
      </View>

      {/* ── Comparison scene ────────────────────────────────────────── */}
      <View style={styles.scene}>
        {/* All objects on a single line — only visible ones show */}
        {OBJECT_STAGES.map((obj, i) => (
          <SceneObject
            key={obj.id}
            stage={obj}
            index={i}
            cameraPosition={cameraPosition}
            currentSizeCm={sizeCm}
          />
        ))}

        {/* Marshmallow (rendered last = foreground) */}
        <View style={styles.marshmallowPosition}>
          <View style={{ transform: [{ scale: wrapperScale }] }}>
            <MarshmallowCharacter
              color={profile.color}
              name={profile.name}
              sizeCm={sizeCm}
            />
          </View>
        </View>
      </View>


      {/* ── Info section ────────────────────────────────────────────── */}
      <View style={styles.infoSection}>
        <Text style={styles.sizeText}>
          {sizeCm}cm
        </Text>
        <Text style={styles.messageText}>{stage.message}</Text>
      </View>


      {/* ── Start / End Focus button ──────────────────────────────────── */}
      <Button
        onPress={isFocusActive ? handleStopFocus : handleOpenFocusSheet}
        loading={isLoading}
        icon={isFocusActive ? "stop-circle-outline" : "timer-outline"}
        iconSize={22}
        label={isFocusActive ? "End Focus Session" : "Start Focus Session"}
        style={[styles.focusButton, isFocusActive && styles.focusButtonActive]}
      />

      {/* ── Focus session settings sheet ──────────────────────────── */}
      <FocusSessionSheet
        sheetRef={focusSheetRef}
        currentSizeCm={sizeCm}
        onStartSession={handleStartSession}
      />
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
    bottom: -20,
    left: 0,
    right: 0,
    alignItems: "center",
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
});

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
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
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
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
      <Pressable
        onPress={isFocusActive ? handleStopFocus : handleOpenFocusSheet}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.focusButton,
          isFocusActive && styles.focusButtonActive,
          pressed && styles.focusButtonPressed,
          isLoading && styles.focusButtonDisabled,
        ]}
      >
        <Ionicons
          name={isFocusActive ? "stop-circle-outline" : "timer-outline"}
          size={22}
          color={Theme.colors.white}
        />
        <Text style={styles.focusButtonText}>
          {isLoading
            ? "Loading..."
            : isFocusActive
              ? "End Focus Session"
              : "Start Focus Session"}
        </Text>
      </Pressable>

      {/* ── Focus session settings sheet ──────────────────────────── */}
      <FocusSessionSheet
        sheetRef={focusSheetRef}
        currentSizeCm={sizeCm}
        onStartSession={handleStartSession}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
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

  /* Customize button */
  customizeRow: {
    alignItems: "center",
    marginTop: 2,
  },
  customizeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  customizePressed: {
    opacity: 0.7,
  },
  customizeText: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
  },

  /* Info */
  infoSection: {
    alignItems: "center",
    marginTop: 12,
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

  /* Dev controls — remove later */
  devRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
  },
  devButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Theme.colors.cardBorder,
  },
  devButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },

  /* Focus button */
  focusButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Theme.colors.secondary,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  focusButtonActive: {
    backgroundColor: Theme.colors.danger,
  },
  focusButtonDisabled: {
    opacity: 0.6,
  },
  focusButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  focusButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
});

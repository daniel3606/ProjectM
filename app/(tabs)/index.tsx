import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { ensureScreenTimeAuthorized } from "@/lib/screenTimeAuth";
import * as ScreenTime from "@/modules/screen-time";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import ProfileAvatarButton from "@/components/ProfileAvatarButton";
import ComparisonObjectPlaceholder from "@/components/ComparisonObjectPlaceholder";
import FocusSessionSheet, {
  type FocusSessionConfig,
} from "@/components/FocusSessionSheet";
import {
  getStageForSize,
  OBJECT_STAGES,
  type GrowthStage,
} from "@/constants/growthStages";

const INITIAL_SIZE_CM = 10;

const BODY_HEIGHT = 222;
const TARGET_HEIGHT = 175;
function marshmallowWrapperScale(sizeCm: number) {
  const internal = 0.9 + Math.min(sizeCm / 60, 0.4);
  return TARGET_HEIGHT / (BODY_HEIGHT * internal);
}

const SCENE_HEIGHT = 300;
const ANIM_DURATION = 400;
const ANIM_EASING = Easing.out(Easing.cubic);
const MIN_SIZE = 3;

// Gap between each object on the horizontal line (in pixels)
const GAP = 220;

/**
 * Compute the camera position on the object line based on marshmallow size.
 *
 * Each OBJECT_STAGE[i] sits at position i * GAP on the line.
 * The camera position is interpolated so that when the marshmallow exactly
 * matches a stage's size, the camera is centered on that stage's position.
 * Between stages the camera smoothly slides from one to the next.
 */
function computeCameraPosition(sizeCm: number): number {
  // Before the first object stage
  if (sizeCm <= OBJECT_STAGES[0].sizeCm) {
    const progress =
      (sizeCm - MIN_SIZE) / (OBJECT_STAGES[0].sizeCm - MIN_SIZE);
    return Math.max(0, progress) * 0; // camera at 0 (first object position)
  }

  // Between two object stages — interpolate
  for (let i = 0; i < OBJECT_STAGES.length - 1; i++) {
    if (sizeCm < OBJECT_STAGES[i + 1].sizeCm) {
      const lo = OBJECT_STAGES[i].sizeCm;
      const hi = OBJECT_STAGES[i + 1].sizeCm;
      const progress = (sizeCm - lo) / (hi - lo);
      return (i + progress) * GAP;
    }
  }

  // At or beyond the last stage
  return (OBJECT_STAGES.length - 1) * GAP;
}

// ── Per-object component ─────────────────────────────────────────────────────
interface SceneObjectProps {
  stage: GrowthStage;
  index: number;
  cameraPos: SharedValue<number>;
  currentSizeCm: number;
}

function SceneObject({ stage, index, cameraPos, currentSizeCm }: SceneObjectProps) {
  const scale = stage.sizeCm / currentSizeCm;

  const animStyle = useAnimatedStyle(() => {
    const screenX = index * GAP - cameraPos.value;
    const absX = Math.abs(screenX);
    // Fully visible within GAP range, fade out beyond, gone past 1.5× GAP
    const FADE_START = 160;
    const FADE_END = 340;
    const opacity =
      absX > FADE_END ? 0 : absX < FADE_START ? 0.85 : 0.85 * (1 - (absX - FADE_START) / (FADE_END - FADE_START));
    return {
      transform: [{ translateX: screenX }],
      opacity: Math.max(0, opacity),
    };
  });

  return (
    <Animated.View style={[styles.objectPosition, animStyle]}>
      <ComparisonObjectPlaceholder stage={stage} scale={scale} />
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
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

  // Single animated camera position on the object line
  const cameraPos = useSharedValue(computeCameraPosition(sizeCm));

  useEffect(() => {
    cameraPos.value = withTiming(computeCameraPosition(sizeCm), {
      duration: ANIM_DURATION,
      easing: ANIM_EASING,
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
            cameraPos={cameraPos}
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

  /* All objects share this base — centered, moved by animated translateX */
  objectPosition: {
    position: "absolute",
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: "center",
  },

  /* Marshmallow */
  marshmallowPosition: {
    position: "absolute",
    bottom: 0,
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
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  messageText: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
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
    marginTop: 20,
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

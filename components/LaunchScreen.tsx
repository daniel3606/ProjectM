import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as SplashScreen from "expo-splash-screen";
import MarshmallowStage from "@/components/onboarding/MarshmallowStage";
import FadeIn from "@/components/onboarding/FadeIn";
import {
  getMarshmallowIntrinsicScale,
  MARSHMALLOW_BODY_HEIGHT,
} from "@/components/MarshmallowCharacter";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import Theme from "@/constants/theme";

/**
 * The character on the native splash is drawn from
 * `assets/images/splash-icon.png` at `app.json`'s `imageWidth`, and the art is
 * a square canvas with the body centred in it. Sizing the character here from
 * the same two numbers is what makes the handover invisible: React takes over
 * mid-launch with the marshmallow already where iOS left it, and the only
 * thing that changes is that it starts breathing.
 */
const SPLASH_IMAGE_WIDTH = 240;
const ART_BODY_HEIGHT_RATIO = 800 / 1024;
const CHARACTER_HEIGHT = SPLASH_IMAGE_WIDTH * ART_BODY_HEIGHT_RATIO;

/** A hatchling, as in onboarding — the size the launch character is drawn at. */
const SIZE_CM = 3;
const CHARACTER_SCALE =
  CHARACTER_HEIGHT / (MARSHMALLOW_BODY_HEIGHT * getMarshmallowIntrinsicScale(SIZE_CM));

/** Matches the art, which is drawn in the brand's own colour rather than the user's. */
const BRAND_COLOR = MARSHMALLOW_COLORS[0].hex;

const COPY_AT_MS = 260;
const COPY_MS = 420;

/**
 * How long the launch screen stays up even when there was nothing to wait for.
 * Boot is usually finished before the wordmark has finished arriving, and
 * cutting the reveal off halfway looks like a glitch rather than a fast app.
 */
const MIN_VISIBLE_MS = COPY_AT_MS + COPY_MS + 240;

const EXIT_MS = 360;

interface LaunchScreenProps {
  /** True once the app behind this screen has everything it needs to be shown. */
  ready: boolean;
  /** Called after the exit fade, so the caller can unmount this screen. */
  onFinished: () => void;
}

/**
 * The first thing anyone sees, and the only screen that outlives the native
 * splash. It continues that splash rather than replacing it — same marshmallow,
 * same place, same background — and holds until auth and the profile have
 * settled, so nobody watches the app assemble itself.
 */
export default function LaunchScreen({ ready, onFinished }: LaunchScreenProps) {
  const [copyVisible, setCopyVisible] = useState(false);
  const [heldLongEnough, setHeldLongEnough] = useState(false);
  const exit = useSharedValue(1);

  // Handing the screen over on layout rather than on mount: the native splash
  // has to stay up until this one has actually been drawn, or the app flashes
  // its empty navigator in between.
  const handleLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const copyTimer = setTimeout(() => setCopyVisible(true), COPY_AT_MS);
    const holdTimer = setTimeout(() => setHeldLongEnough(true), MIN_VISIBLE_MS);
    return () => {
      clearTimeout(copyTimer);
      clearTimeout(holdTimer);
    };
  }, []);

  useEffect(() => {
    if (!ready || !heldLongEnough) return;

    exit.value = withTiming(
      0,
      { duration: EXIT_MS, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        "worklet";
        if (finished) scheduleOnRN(onFinished);
      }
    );
    // The callback identity changing must not restart a fade already running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exit, heldLongEnough, ready]);

  const exitStyle = useAnimatedStyle(() => ({ opacity: exit.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, exitStyle]}
      onLayout={handleLayout}
      // Swallow taps only while there is genuinely nothing behind this screen.
      // Once the app is ready the fade is about to start, and a tap aimed at
      // what is already showing through should land.
      pointerEvents={ready ? "none" : "auto"}
    >
      <View style={styles.stage}>
        <MarshmallowStage
          color={BRAND_COLOR}
          name="Marshmallow"
          sizeCm={SIZE_CM}
          scale={CHARACTER_SCALE}
          float
        />
      </View>

      <FadeIn visible={copyVisible} durationMs={COPY_MS} rise={10} style={styles.copy}>
        <Text style={styles.wordmark}>Marshmallow</Text>
        <Text style={styles.tagline}>Grow something instead.</Text>
      </FadeIn>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: Theme.colors.background,
  },
  // Absolute rather than a flex child, so the copy below cannot shift the
  // character off the centre the native splash left it on.
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: "center",
  },
  wordmark: {
    fontSize: 30,
    fontFamily: Theme.fonts.bold,
    letterSpacing: -0.8,
    color: Theme.colors.secondary,
  },
  tagline: {
    marginTop: Theme.spacing.xs,
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
});

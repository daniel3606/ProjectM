import React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import type { GrowthStage } from "@/constants/growthStages";
import { OBJECT_GAP, getObjectScale } from "@/lib/sceneMath";
import ComparisonObjectPlaceholder from "@/components/ComparisonObjectPlaceholder";

// Objects are fully visible near the center, then fade out with distance.
const FADE_START_DISTANCE = 160;
const FADE_END_DISTANCE = 340;
const FOCUSED_OPACITY = 0.85;

interface SceneObjectProps {
  stage: GrowthStage;
  index: number;
  currentSizeCm: number;
  cameraPosition: SharedValue<number>;
}

export default function SceneObject({
  stage,
  index,
  currentSizeCm,
  cameraPosition,
}: SceneObjectProps) {
  const scale = getObjectScale(stage.sizeCm, currentSizeCm);

  const animatedStyle = useAnimatedStyle(() => {
    const slotPosition = index * OBJECT_GAP;
    const screenX = slotPosition - cameraPosition.value;
    const distanceFromCenter = Math.abs(screenX);
    const opacity = interpolate(
      distanceFromCenter,
      [FADE_START_DISTANCE, FADE_END_DISTANCE],
      [FOCUSED_OPACITY, 0],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ translateX: screenX }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.objectPosition, animatedStyle]}>
      <ComparisonObjectPlaceholder stage={stage} scale={scale} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Shared by every object — centered horizontally, moved by animated translateX.
  objectPosition: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});

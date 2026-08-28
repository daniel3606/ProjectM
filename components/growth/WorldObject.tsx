import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import { getObjectAspectRatio, getObjectImage } from "@/constants/objectImages";
import {
  FOCUS_HEIGHT_PX,
  GROUND_Y,
  OBJECT_LABEL_GAP,
  getDepthOpacity,
  getLabelOpacity,
  visualScaleForSize,
  worldXToSize,
  type WorldStage,
} from "@/lib/growthWorld";

interface WorldObjectProps {
  stage: WorldStage;
  /** Draw order: larger objects sit in front of smaller neighbours. */
  depthIndex: number;
  cameraX: SharedValue<number>;
  /**
   * True for objects the marshmallow has reached, and for the next two
   * stages ahead. False objects render as a placeholder with a hidden name.
   */
  revealed: boolean;
}

/**
 * One comparison object in the world. Everything about it — where it lands,
 * how big it draws, how far it lifts to stay visible behind the marshmallow,
 * how strongly it reads against the distance — falls out of its real-world
 * height and the camera. There is no per-object animation anywhere.
 */
function WorldObject({
  stage,
  depthIndex,
  cameraX,
  revealed,
}: WorldObjectProps) {
  const image = revealed ? getObjectImage(stage.id) : undefined;
  const aspectRatio = image ? getObjectAspectRatio(stage.id) : 1;

  const columnStyle = useAnimatedStyle(() => {
    const offset = stage.worldX - cameraX.value;
    return {
      transform: [{ translateX: offset }],
      opacity: getDepthOpacity(offset),
    };
  });

  const spriteStyle = useAnimatedStyle(() => {
    const cameraCm = worldXToSize(cameraX.value);
    const scale = visualScaleForSize(stage.sizeCm, cameraCm);
    return {
      transform: [{ scale }],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const cameraCm = worldXToSize(cameraX.value);
    const scale = visualScaleForSize(stage.sizeCm, cameraCm);
    return {
      opacity: getLabelOpacity(
        cameraX.value,
        stage.claimFromX,
        stage.claimToX,
        stage.claimCrossfadePx,
      ),
      transform: [
        { translateY: -(FOCUS_HEIGHT_PX * scale + OBJECT_LABEL_GAP) },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.column, { zIndex: depthIndex }, columnStyle]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.sprite, spriteStyle]}>
        {image ? (
          <Image
            source={image}
            style={[styles.artwork, { width: FOCUS_HEIGHT_PX * aspectRatio }]}
            resizeMode="contain"
            accessibilityLabel={stage.objectName}
          />
        ) : (
          <View style={styles.placeholder} accessibilityLabel="Hidden object">
            <Text style={styles.placeholderMark}>?</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View style={[styles.label, labelStyle]}>
        <Text style={styles.labelName}>{revealed ? stage.objectName : "???"}</Text>
        <Text style={styles.labelSize}>{stage.sizeCm}cm</Text>
      </Animated.View>
    </Animated.View>
  );
}

export default React.memo(WorldObject);

const styles = StyleSheet.create({
  column: {
    ...StyleSheet.absoluteFillObject,
  },
  sprite: {
    position: "absolute",
    bottom: GROUND_Y,
    left: 0,
    right: 0,
    alignItems: "center",
    // Grow upward from the ground line rather than from the middle, so an
    // object never sinks through the floor as it scales.
    transformOrigin: "50% 100%",
  },
  artwork: {
    height: FOCUS_HEIGHT_PX,
  },
  label: {
    position: "absolute",
    bottom: GROUND_Y,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  labelName: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
  },
  labelSize: {
    fontSize: 10,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
  placeholder: {
    height: FOCUS_HEIGHT_PX,
    width: FOCUS_HEIGHT_PX,
    borderRadius: Theme.radius.xl,
    backgroundColor: Theme.colors.card,
    borderWidth: 2,
    borderColor: Theme.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderMark: {
    fontSize: 64,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.cardBorder,
  },
});

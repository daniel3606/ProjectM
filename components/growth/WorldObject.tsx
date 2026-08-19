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
  OBJECT_LABEL_Y,
  getDepthOpacity,
  getLabelOpacity,
  getObjectLiftPx,
  getOverlapFactor,
  screenOffsetToScale,
  type WorldStage,
} from "@/lib/growthWorld";

interface WorldObjectProps {
  stage: WorldStage;
  /** Draw order: larger objects sit in front of smaller neighbours. */
  depthIndex: number;
  cameraX: SharedValue<number>;
  /** World position of the marshmallow, which is what this object may be hidden behind. */
  marshmallowWorldX: SharedValue<number>;
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
  marshmallowWorldX,
}: WorldObjectProps) {
  const image = getObjectImage(stage.id);
  const aspectRatio = getObjectAspectRatio(stage.id);

  const columnStyle = useAnimatedStyle(() => {
    const offset = stage.worldX - cameraX.value;
    return {
      transform: [{ translateX: offset }],
      opacity: getDepthOpacity(offset),
    };
  });

  const spriteStyle = useAnimatedStyle(() => {
    const offset = stage.worldX - cameraX.value;
    const scale = screenOffsetToScale(offset);

    const marshmallowOffset = marshmallowWorldX.value - cameraX.value;
    const marshmallowHeight =
      FOCUS_HEIGHT_PX * screenOffsetToScale(marshmallowOffset);

    const overlap = getOverlapFactor(offset - marshmallowOffset);
    const lift = getObjectLiftPx(
      FOCUS_HEIGHT_PX * scale,
      marshmallowHeight,
      overlap,
    );

    // translateY is listed first so it stays in unscaled pixels: the sprite is
    // scaled about its base (transformOrigin below) and then raised by `lift`.
    return {
      transform: [{ translateY: -lift }, { scale }],
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: getLabelOpacity(
      cameraX.value,
      stage.claimFromX,
      stage.claimToX,
      stage.claimCrossfadePx,
    ),
  }));

  return (
    <Animated.View
      style={[styles.column, { zIndex: depthIndex }, columnStyle]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.sprite, spriteStyle]}>
        {image ? (
          <Image
            source={image}
            style={{ height: FOCUS_HEIGHT_PX, width: FOCUS_HEIGHT_PX * aspectRatio }}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.fallback, { height: FOCUS_HEIGHT_PX, width: FOCUS_HEIGHT_PX }]} />
        )}
      </Animated.View>

      <Animated.View style={[styles.label, labelStyle]}>
        <Text style={styles.labelName}>{stage.objectName}</Text>
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
  label: {
    position: "absolute",
    bottom: OBJECT_LABEL_Y,
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
  fallback: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.sm,
  },
});

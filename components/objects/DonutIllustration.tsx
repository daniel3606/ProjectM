import React from "react";
import { StyleSheet, View } from "react-native";
import Theme from "@/constants/theme";

interface DonutIllustrationProps {
  /** Rendered width/height in pixels — the donut is always drawn as a circle. */
  size: number;
}

const DOUGH_COLOR = "#D99A5B";
const ICING_COLOR = "#FFB5C2";
const SPRINKLE_COLORS = ["#B5D8FF", "#B5FFCB", "#FFF5EE", "#8B635C", "#F5E689"];

/**
 * Built the same way as MarshmallowCharacter — plain Views with flat fills,
 * a rotated highlight ellipse, and a soft drop shadow — so comparison
 * objects read as part of the same illustrated world as the character,
 * instead of clashing photos/icons/emoji.
 */
export default function DonutIllustration({ size }: DonutIllustrationProps) {
  const holeSize = size * 0.36;
  const sprinkleWidth = size * 0.09;
  const sprinkleHeight = size * 0.028;

  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        style={[
          styles.icing,
          {
            height: size * 0.56,
            borderBottomLeftRadius: size * 0.3,
            borderBottomRightRadius: size * 0.22,
          },
        ]}
      />

      <View style={[styles.sprinkleRow, { top: size * 0.16, gap: size * 0.05 }]}>
        {SPRINKLE_COLORS.map((color, index) => (
          <View
            key={color}
            style={{
              width: sprinkleWidth,
              height: sprinkleHeight,
              borderRadius: sprinkleHeight / 2,
              backgroundColor: color,
              transform: [{ rotate: index % 2 === 0 ? "-25deg" : "20deg" }],
            }}
          />
        ))}
      </View>

      <View
        style={[
          styles.shine,
          {
            top: size * 0.08,
            left: size * 0.16,
            width: size * 0.2,
            height: size * 0.1,
            borderRadius: size * 0.1,
          },
        ]}
      />

      <View
        style={[styles.hole, { width: holeSize, height: holeSize, borderRadius: holeSize / 2 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: DOUGH_COLOR,
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },
  icing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: ICING_COLOR,
  },
  sprinkleRow: {
    position: "absolute",
    flexDirection: "row",
  },
  shine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.5)",
    transform: [{ rotate: "-20deg" }],
  },
  hole: {
    backgroundColor: Theme.colors.background,
  },
});

import React from "react";
import { StyleSheet, View } from "react-native";
import Theme from "@/constants/theme";

/** Opacity of each band, outermost first. */
const BANDS = [1, 0.62, 0.24];

interface EdgeFadeProps {
  width?: number;
  /**
   * Paint order within the parent. Needed wherever siblings set their own
   * `zIndex`, since that overrides document order.
   */
  zIndex?: number;
}

/**
 * Softens the left and right edges of a scrolling strip so content dissolves
 * instead of being cut off. Built from a few flat bands rather than a gradient
 * because the app background is a single flat colour, which keeps this free of
 * an extra dependency and free of a real gradient's cost.
 */
export default function EdgeFade({ width = 30, zIndex }: EdgeFadeProps) {
  const bandWidth = width / BANDS.length;

  return (
    <View style={[styles.layer, zIndex === undefined ? null : { zIndex }]} pointerEvents="none">
      {BANDS.map((opacity, index) => (
        <React.Fragment key={index}>
          <View
            style={[
              styles.band,
              { left: index * bandWidth, width: bandWidth, opacity },
            ]}
          />
          <View
            style={[
              styles.band,
              { right: index * bandWidth, width: bandWidth, opacity },
            ]}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  band: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: Theme.colors.background,
  },
});

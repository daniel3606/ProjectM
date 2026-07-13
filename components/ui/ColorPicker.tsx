import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Theme from "@/constants/theme";

interface ColorOption<Hex extends string> {
  hex: Hex;
  name: string;
}

interface ColorPickerProps<Hex extends string> {
  colors: readonly ColorOption<Hex>[];
  selected: Hex;
  onSelect: (hex: Hex) => void;
  style?: StyleProp<ViewStyle>;
}

/** Wrapped grid of swatches with a checkmark on the selected color, used by customize + create flows. */
export default function ColorPicker<Hex extends string>({
  colors,
  selected,
  onSelect,
  style,
}: ColorPickerProps<Hex>) {
  return (
    <View style={[styles.grid, style]}>
      {colors.map((c) => (
        <Pressable key={c.hex} onPress={() => onSelect(c.hex)} style={styles.option}>
          <View
            style={[
              styles.swatch,
              { backgroundColor: c.hex },
              selected === c.hex && styles.swatchSelected,
            ]}
          >
            {selected === c.hex && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.label}>{c.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  option: {
    alignItems: "center",
    width: 68,
  },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: Theme.colors.secondary,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.colors.secondary,
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
  },
});

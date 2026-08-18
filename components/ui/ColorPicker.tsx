import React from "react";
import {
  Pressable,
  ScrollView,
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
  /**
   * "grid" (default) wraps swatches with a label under each one — used on the
   * Customize tab where there's room to spare. "row" is a compact single-line
   * horizontal strip with one shared caption for the selected color's name —
   * used where vertical space is tight, e.g. the create-marshmallow screen.
   */
  layout?: "grid" | "row";
}

/** Wrapped grid (or compact horizontal row) of swatches with a checkmark on the selected color. */
export default function ColorPicker<Hex extends string>({
  colors,
  selected,
  onSelect,
  style,
  layout = "grid",
}: ColorPickerProps<Hex>) {
  if (layout === "row") {
    const selectedName = colors.find((c) => c.hex === selected)?.name;
    return (
      <View style={style}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowContent}
        >
          {colors.map((c) => (
            <Pressable key={c.hex} onPress={() => onSelect(c.hex)} hitSlop={6}>
              <View
                style={[
                  styles.swatchCompact,
                  { backgroundColor: c.hex },
                  selected === c.hex && styles.swatchSelected,
                ]}
              >
                {selected === c.hex && <Text style={styles.checkmarkCompact}>✓</Text>}
              </View>
            </Pressable>
          ))}
        </ScrollView>
        {selectedName && <Text style={styles.rowLabel}>{selectedName}</Text>}
      </View>
    );
  }

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
  rowContent: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
  },
  swatchCompact: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  checkmarkCompact: {
    fontSize: 16,
    fontWeight: "700",
    color: Theme.colors.secondary,
  },
  rowLabel: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
    textAlign: "center",
  },
});

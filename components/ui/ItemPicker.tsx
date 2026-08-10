import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Theme from "@/constants/theme";
import type { MarshmallowItem } from "@/constants/items";

interface ItemPickerProps {
  items: MarshmallowItem[];
  /** Currently equipped item id for this slot, or undefined if nothing's equipped. */
  selectedId?: string;
  /** Selecting the already-equipped item unequips it (handled by the caller's toggle). */
  onSelect: (itemId: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** Horizontal strip of emoji swatches for one item slot, with a leading "None" option. */
export default function ItemPicker({ items, selectedId, onSelect, style }: ItemPickerProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, style]}
    >
      <Pressable onPress={() => selectedId && onSelect(selectedId)} hitSlop={6}>
        <View style={[styles.swatch, !selectedId && styles.swatchSelected]}>
          <Text style={styles.noneLabel}>None</Text>
        </View>
      </Pressable>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onSelect(item.id)} hitSlop={6}>
          <View style={[styles.swatch, selectedId === item.id && styles.swatchSelected]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingVertical: 4,
  },
  swatch: {
    width: 64,
    height: 64,
    borderRadius: Theme.radius.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.card,
    borderWidth: 1.5,
    borderColor: Theme.colors.cardBorder,
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: Theme.colors.secondary,
    backgroundColor: Theme.colors.cardActiveTint,
  },
  emoji: {
    fontSize: 30,
  },
  noneLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
  },
});

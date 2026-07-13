import React from "react";
import { StyleSheet, Text } from "react-native";
import Theme from "@/constants/theme";
import { SelectableCard } from "./Card";

interface SelectableOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** Full-width, centered-text selectable row used in onboarding single-choice lists. */
export default function SelectableOption({ label, selected, onPress }: SelectableOptionProps) {
  return (
    <SelectableCard selected={selected} onPress={onPress} style={styles.option}>
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </SelectableCard>
  );
}

const styles = StyleSheet.create({
  option: {
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  text: {
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    color: Theme.colors.text,
    textAlign: "center",
  },
  textSelected: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.semibold,
  },
});

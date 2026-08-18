import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { formatDuration, type FocusMode } from "@/constants/marshmallow";
import { Button } from "@/components/ui";

interface GrowthResultModalProps {
  visible: boolean;
  growthCm: number;
  durationMinutes: number;
  focusMode: FocusMode;
  label?: string;
  onDismiss: () => void;
}

export default function GrowthResultModal({
  visible,
  growthCm,
  durationMinutes,
  focusMode,
  label,
  onDismiss,
}: GrowthResultModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Ionicons name="sparkles" size={32} color={Theme.colors.secondary} />
          <Text style={styles.title}>Focus Complete!</Text>
          {label ? <Text style={styles.label}>{label}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>+{growthCm}cm</Text>
              <Text style={styles.statLabel}>Growth</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(durationMinutes)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Ionicons
                name={focusMode === "deep" ? "shield-checkmark" : "leaf"}
                size={20}
                color={Theme.colors.text}
              />
              <Text style={styles.statLabel}>{focusMode === "deep" ? "Deep" : "Flexible"}</Text>
            </View>
          </View>

          <Button
            variant="primary"
            label="Awesome!"
            onPress={onDismiss}
            style={styles.dismissButton}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    backgroundColor: Theme.colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: 12,
  },
  label: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
    gap: 16,
  },
  stat: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Theme.colors.cardBorder,
  },
  dismissButton: {
    width: "100%",
  },
});

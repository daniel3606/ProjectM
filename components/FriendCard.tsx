import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import type { FriendWithProfile } from "@/contexts/FriendsContext";

interface FriendCardProps {
  friend: FriendWithProfile;
  isFocusing: boolean;
  rank?: number;
  onRemove?: () => void;
}

export default function FriendCard({ friend, isFocusing, rank, onRemove }: FriendCardProps) {
  const displayName = friend.display_name || friend.username || "Marshmallow";
  const growthCm = Number(friend.total_growth_cm) || 0;
  const focusMin = friend.total_focus_minutes || 0;
  const hours = Math.floor(focusMin / 60);
  const mins = focusMin % 60;
  const focusLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {rank != null && (
          <Text style={styles.rank}>#{rank}</Text>
        )}

        {/* Color swatch */}
        <View
          style={[
            styles.swatch,
            { backgroundColor: friend.marshmallow_color || "#FFF5EE" },
          ]}
        >
          {isFocusing && <View style={styles.focusDot} />}
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {friend.username && (
              <Text style={styles.username}>@{friend.username}</Text>
            )}
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.stat}>{growthCm.toFixed(1)} cm</Text>
            <Text style={styles.statDivider}> · </Text>
            <Text style={styles.stat}>{focusLabel} focused</Text>
            {isFocusing && (
              <Text style={styles.focusingLabel}> · Focusing</Text>
            )}
          </View>
        </View>

        {onRemove && (
          <Pressable
            onPress={onRemove}
            hitSlop={12}
            style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close-circle-outline" size={22} color={Theme.colors.gray} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rank: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.secondary,
    width: 28,
    textAlign: "center",
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Theme.colors.cardBorder,
  },
  focusDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.colors.success,
    borderWidth: 2,
    borderColor: Theme.colors.card,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    flexShrink: 1,
  },
  username: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  stat: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  statDivider: {
    fontSize: 13,
    color: Theme.colors.gray,
  },
  focusingLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.success,
  },
  removeBtn: {
    padding: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import { formatTimeRemaining, type FocusMode } from "@/constants/marshmallow";
import { BREAK_LENGTH_MINUTES, type BreakAvailability } from "@/lib/focusBreaks";

interface ActiveBlockStatusProps {
  /** "Quick Block", or the scheduled plan's own name. */
  label: string;
  remainingMs: number;
  focusMode: FocusMode;
  isOnBreak: boolean;
}

/**
 * The countdown that sits under the header while a block runs. Quick Blocks
 * and scheduled blocks share it, so the home screen reads the same either way
 * and a scheduled block no longer has to be chased to its own tab.
 *
 * The growth this block will pay out is deliberately not here — it belongs to
 * the size readout under the carousel, which shows it as "3.5 (+2.0) cm".
 */
export function ActiveBlockStatus({
  label,
  remainingMs,
  focusMode,
  isOnBreak,
}: ActiveBlockStatusProps) {
  return (
    <View style={styles.status}>
      <Text style={styles.statusLabel} numberOfLines={1}>
        {isOnBreak
          ? "On a break"
          : `${label} (${focusMode === "deep" ? "Deep" : "Flexible"})`}
      </Text>
      <Text style={styles.statusTime}>{formatTimeRemaining(remainingMs)}</Text>
    </View>
  );
}

interface ActiveBlockControlsProps {
  isOnBreak: boolean;
  breakAvailability: BreakAvailability | null;
  isHardMode: boolean;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onEdit: () => void;
  onEnd: () => void;
}

/**
 * One quiet row of text links under the carousel: the break, then the two ways
 * to interfere with the block. Ending it is deliberately no louder than the
 * rest — the block is the point, and the break is the pressure valve that
 * should be reached for first.
 */
export function ActiveBlockControls({
  isOnBreak,
  breakAvailability,
  isHardMode,
  onStartBreak,
  onEndBreak,
  onEdit,
  onEnd,
}: ActiveBlockControlsProps) {
  // Whether this block earns breaks at all is fixed for its whole run, so the
  // link either exists the entire time or never does and the row can't reflow
  // when a break unlocks partway through.
  const earnsBreaks =
    !isHardMode &&
    breakAvailability !== null &&
    breakAvailability.reason !== "tooShort";

  if (isHardMode) {
    return (
      <View style={styles.controls}>
        <Text style={styles.footerNotice}>
          Hard Mode — this block runs to the end
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.controls}>
      {earnsBreaks && (
        <>
          <FooterLink
            label={breakLinkLabel(isOnBreak, breakAvailability)}
            onPress={isOnBreak ? onEndBreak : onStartBreak}
            disabled={!isOnBreak && !breakAvailability.canTakeBreak}
            testID="break-link"
          />
          <Text style={styles.footerSeparator}>·</Text>
        </>
      )}
      <FooterLink label="Edit block" onPress={onEdit} testID="edit-block-link" />
      <Text style={styles.footerSeparator}>·</Text>
      <FooterLink label="End block" onPress={onEnd} testID="end-block-link" />
    </View>
  );
}

function FooterLink({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      testID={testID}
      style={({ pressed }) => pressed && !disabled && styles.pressed}
    >
      <Text style={[styles.footerLink, disabled && styles.footerLinkDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

function breakLinkLabel(
  isOnBreak: boolean,
  availability: BreakAvailability,
): string {
  if (isOnBreak) return "Resume block";
  if (availability.canTakeBreak) return `Take a ${BREAK_LENGTH_MINUTES}m break`;

  switch (availability.reason) {
    case "tooEarly":
    case "tooSoon":
      return "Break locked";
    case "exhausted":
      return "No breaks left";
    case "tooCloseToEnd":
      return "Break locked";
    default:
      return "Break locked";
  }
}

const styles = StyleSheet.create({
  /* Status readout */
  status: {
    alignItems: "center",
    paddingTop: Theme.spacing.xl,
  },
  statusLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Brown and large, so the countdown never reads as a second size number.
  statusTime: {
    fontSize: 68,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.secondary,
    marginTop: Theme.spacing.xxs,
  },

  /* One quiet row of controls under the carousel */
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xl,
    marginBottom: 40,
  },
  footerLink: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
  footerLinkDisabled: {
    opacity: 0.45,
  },
  footerSeparator: {
    fontSize: 13,
    color: Theme.colors.gray,
  },
  footerNotice: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
  pressed: {
    opacity: 0.6,
  },
});

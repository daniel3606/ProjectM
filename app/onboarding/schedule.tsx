import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Headline,
  OnboardingCTA,
  OnboardingLayout,
  OnboardingOption,
} from "@/components/onboarding";
import {
  SCHEDULE_PRESETS,
  SCHEDULE_SHIFT_LIMIT_MINUTES,
  SCHEDULE_SHIFT_STEP_MINUTES,
  type SchedulePresetId,
} from "@/constants/onboarding";
import Theme from "@/constants/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticSelection } from "@/lib/haptics";
import { describeDays, describePresetWindow } from "@/lib/onboardingSchedule";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

type Selection = SchedulePresetId | "custom" | null;

export default function OnboardingScheduleStep() {
  const {
    schedulePresetId,
    scheduleShiftMinutes,
    chooseSchedulePreset,
    adjustScheduleShift,
    saveSchedule,
    skipSchedule,
  } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("schedule");

  const [selection, setSelection] = useState<Selection>(schedulePresetId);

  const handleContinue = useCallback(() => {
    if (selection === "custom" || selection === null) {
      // "Custom" is a promise to come back to it, not a scheduling screen —
      // that lives on the Timed Block tab.
      skipSchedule("custom");
    } else {
      saveSchedule();
    }
    goNext();
  }, [goNext, saveSchedule, selection, skipSchedule]);

  const handleSkip = useCallback(() => {
    skipSchedule("explicit");
    goNext();
  }, [goNext, skipSchedule]);

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      scroll
      footer={
        <OnboardingCTA
          label="Continue"
          onPress={handleContinue}
          disabled={selection === null}
          secondaryLabel="Skip for now"
          onSecondaryPress={handleSkip}
        />
      }
    >
      <Headline style={styles.headline}>
        When are you usually{"\n"}most distracted?
      </Headline>

      <View style={styles.options}>
        {SCHEDULE_PRESETS.map((preset) => {
          const selected = selection === preset.id;
          const shift = selected ? scheduleShiftMinutes : 0;

          return (
            <OnboardingOption
              key={preset.id}
              label={preset.label}
              detail={`${describeDays(preset.daysOfWeek)} · ${describePresetWindow(preset, shift)}`}
              selected={selected}
              onPress={() => {
                setSelection(preset.id);
                chooseSchedulePreset(preset.id);
              }}
            >
              <ShiftControl
                shiftMinutes={scheduleShiftMinutes}
                onShift={adjustScheduleShift}
              />
            </OnboardingOption>
          );
        })}

        <OnboardingOption
          label="Custom"
          detail="Choose your own times later"
          selected={selection === "custom"}
          onPress={() => setSelection("custom")}
        />
      </View>
    </OnboardingLayout>
  );
}

/** Nudges the whole window earlier or later, so a preset can be made to fit. */
function ShiftControl({
  shiftMinutes,
  onShift,
}: {
  shiftMinutes: number;
  onShift: (deltaMinutes: number) => void;
}) {
  const atEarliest = shiftMinutes <= -SCHEDULE_SHIFT_LIMIT_MINUTES;
  const atLatest = shiftMinutes >= SCHEDULE_SHIFT_LIMIT_MINUTES;

  const shift = (delta: number) => {
    hapticSelection();
    onShift(delta);
  };

  return (
    <View style={styles.shiftRow}>
      <Text style={styles.shiftLabel}>Adjust</Text>

      <View style={styles.shiftButtons}>
        <ShiftButton
          icon="chevron-back"
          label="Shift earlier"
          disabled={atEarliest}
          onPress={() => shift(-SCHEDULE_SHIFT_STEP_MINUTES)}
        />
        <ShiftButton
          icon="chevron-forward"
          label="Shift later"
          disabled={atLatest}
          onPress={() => shift(SCHEDULE_SHIFT_STEP_MINUTES)}
        />
      </View>
    </View>
  );
}

function ShiftButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "chevron-back" | "chevron-forward";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.shiftButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.shiftButtonDisabled,
      ]}
    >
      <Ionicons name={icon} size={18} color={Theme.colors.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 20,
  },
  options: {
    marginTop: 32,
    gap: 10,
    paddingBottom: 16,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shiftLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  shiftButtons: {
    flexDirection: "row",
    gap: 10,
  },
  shiftButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  shiftButtonDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
});

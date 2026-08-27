import React, { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Headline,
  OnboardingCTA,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import { Button, Card } from "@/components/ui";
import Theme from "@/constants/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticLight } from "@/lib/haptics";
import { useOnboardingStep } from "@/lib/useOnboardingStep";
import * as ScreenTime from "@/modules/screen-time";

export default function OnboardingAppsStep() {
  const {
    screenTimePermission,
    distractingApps,
    setDistractingApps,
    requestScreenTimePermission,
  } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("apps");

  const [isWorking, setIsWorking] = useState(false);
  const isApproved = screenTimePermission === "approved";
  const isDenied = screenTimePermission === "denied";
  const isUnavailable = screenTimePermission === "unavailable";

  const openPicker = useCallback(async () => {
    setIsWorking(true);
    try {
      const picked = await ScreenTime.openAppPicker();
      if (picked) setDistractingApps(picked);
    } catch {
      // The picker was dismissed or is unavailable; the button stays offered.
    } finally {
      setIsWorking(false);
    }
  }, [setDistractingApps]);

  // A returning user already granted access and already has a selection on the
  // device — show it rather than asking again.
  useEffect(() => {
    if (!isApproved || distractingApps.length > 0) return;
    let cancelled = false;
    ScreenTime.getSelectedItems()
      .then((items) => {
        if (!cancelled && items.length > 0) setDistractingApps(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Intentionally only on the transition into an approved state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproved]);

  const handleEnable = useCallback(async () => {
    setIsWorking(true);
    try {
      const granted = await requestScreenTimePermission();
      if (!granted) return;
      // Acknowledgement, not celebration: granting a system permission is a
      // step forward, not an achievement.
      hapticLight();
      await openPicker();
    } finally {
      setIsWorking(false);
    }
  }, [openPicker, requestScreenTimePermission]);

  const appCount = distractingApps.filter((item) => item.type === "application").length;
  const groupCount = distractingApps.length - appCount;

  if (isApproved) {
    return (
      <OnboardingLayout
        progress={progress}
        onBack={goBack}
        footer={
          <OnboardingCTA
            label="Continue"
            onPress={goNext}
            disabled={distractingApps.length === 0}
          />
        }
      >
        <Headline style={styles.headline}>Choose what{"\n"}distracts you.</Headline>

        <View style={styles.body}>
          <Card style={styles.selectionCard}>
            {distractingApps.length > 0 ? (
              <>
                <Text style={styles.selectionCount}>
                  {describeSelection(appCount, groupCount)}
                </Text>
                <Text style={styles.selectionNote}>
                  These stay closed during Focus Sessions.
                </Text>
              </>
            ) : (
              <Text style={styles.selectionNote}>
                Pick the apps you lose the most time to.
              </Text>
            )}

            <Button
              variant="outline"
              onPress={openPicker}
              loading={isWorking}
              label={distractingApps.length > 0 ? "Edit Selection" : "Choose Apps"}
              style={styles.selectionButton}
            />
          </Card>
        </View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      footer={
        isUnavailable ? (
          <OnboardingCTA label="Continue" onPress={goNext} />
        ) : isDenied ? (
          <OnboardingCTA
            label="Open Settings"
            onPress={() => Linking.openSettings()}
            secondaryLabel="Continue without blocking"
            onSecondaryPress={goNext}
          />
        ) : (
          <OnboardingCTA
            label="Enable Screen Time"
            onPress={handleEnable}
            loading={isWorking}
          />
        )
      }
    >
      <Headline style={styles.headline}>Choose what{"\n"}distracts you.</Headline>

      <View style={styles.body}>
        <Supporting>
          Marshmallow uses Screen Time access to block the apps you choose during
          Focus Sessions.
        </Supporting>

        {isDenied ? (
          <Supporting style={styles.recovery}>
            Screen Time access is currently turned off. You can turn it back on in
            Settings.
          </Supporting>
        ) : null}

        {isUnavailable ? (
          <Supporting style={styles.recovery}>
            App blocking needs iOS 16 or later. You can still set up Marshmallow now.
          </Supporting>
        ) : null}

        <View style={styles.privacyRow}>
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={Theme.colors.textSecondary}
          />
          <Text style={styles.privacyText}>
            Your app choices stay on your device.
          </Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}

function describeSelection(appCount: number, groupCount: number): string {
  const parts: string[] = [];
  if (appCount > 0) parts.push(`${appCount} app${appCount === 1 ? "" : "s"}`);
  if (groupCount > 0) {
    parts.push(`${groupCount} categor${groupCount === 1 ? "y" : "ies"}`);
  }
  return `${parts.join(" and ")} selected`;
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 20,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 32,
    gap: 20,
  },
  recovery: {
    fontSize: 15,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  privacyText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  selectionCard: {
    padding: 22,
    alignItems: "center",
  },
  selectionCount: {
    fontFamily: Theme.fonts.semibold,
    fontSize: 19,
    color: Theme.colors.text,
  },
  selectionNote: {
    marginTop: 6,
    fontFamily: Theme.fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },
  selectionButton: {
    marginTop: 18,
  },
});

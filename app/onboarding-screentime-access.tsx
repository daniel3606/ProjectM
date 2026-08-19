import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import OnboardingButton from "@/components/OnboardingButton";
import { Screen, HeroTitle, HeroSubtitle, Button, Card } from "@/components/ui";
import Theme from "@/constants/theme";
import * as ScreenTime from "@/modules/screen-time";
import type { AuthorizationStatus } from "@/modules/screen-time";

export default function OnboardingScreenTimeAccess() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthorizationStatus>("unknown");
  const [isRequesting, setIsRequesting] = useState(false);

  const refreshStatus = useCallback(() => {
    setAuthStatus(ScreenTime.getAuthorizationStatus());
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const isAuthorized = authStatus === "approved";
  const isUnavailable = authStatus === "unavailable";
  const isDenied = authStatus === "denied";

  const handleRequestAccess = useCallback(async () => {
    if (!ScreenTime.isAvailable()) {
      Alert.alert("Not Available", "Screen Time features require iOS 16 or later.");
      return;
    }

    if (authStatus === "denied") {
      Alert.alert(
        "Permission Denied",
        "Screen Time access was denied. Please enable it in Settings > Screen Time."
      );
      return;
    }

    setIsRequesting(true);
    try {
      const granted = await ScreenTime.requestAuthorization();
      refreshStatus();
      if (!granted) {
        Alert.alert(
          "Permission Required",
          "Marshmallow needs Screen Time access to block distracting apps."
        );
      }
    } catch {
      Alert.alert("Error", "Failed to request Screen Time authorization.");
    } finally {
      setIsRequesting(false);
    }
  }, [authStatus, refreshStatus]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "card",
          animation: "default",
        }}
      />

      <Screen topInset={40} style={styles.container}>
        <View style={styles.content}>
          <HeroTitle>Allow Screen{"\n"}Time access</HeroTitle>
          <HeroSubtitle>
            Marshmallow uses Screen Time to block apps during focus sessions
          </HeroSubtitle>

          <Card tone="surface" style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="shield-checkmark" size={22} color={Theme.colors.secondary} />
              </View>
              <Text style={styles.infoText}>
                Your data stays on your device. We never see which apps you use.
              </Text>
            </View>
          </Card>

          {isAuthorized ? (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={22} color={Theme.colors.success} />
              <Text style={styles.statusTextSuccess}>Screen Time access granted</Text>
            </View>
          ) : isUnavailable ? (
            <Text style={styles.statusTextMuted}>
              Screen Time is only available on iOS 16 or later.
            </Text>
          ) : (
            <Button
              label={isDenied ? "Open Settings to Enable" : "Allow Screen Time Access"}
              onPress={handleRequestAccess}
              loading={isRequesting}
              icon="lock-open-outline"
              style={styles.requestButton}
            />
          )}
        </View>

        <OnboardingButton
          label="Next"
          disabled={!isAuthorized}
          onPress={() => {
            if (!isAuthorized) return;
            router.push("/onboarding-distracting-apps");
          }}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    gap: 20,
  },
  infoCard: {
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.cardActiveTint,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    lineHeight: 20,
  },
  requestButton: {
    marginTop: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusTextSuccess: {
    fontFamily: Theme.fonts.semibold,
    fontSize: 15,
    color: Theme.colors.success,
  },
  statusTextMuted: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    marginTop: 8,
  },
});

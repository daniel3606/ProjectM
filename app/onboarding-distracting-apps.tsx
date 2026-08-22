import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import OnboardingButton from "@/components/OnboardingButton";
import { Screen, HeroTitle, HeroSubtitle, Button, Card } from "@/components/ui";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import * as ScreenTime from "@/modules/screen-time";
import type { ScreenTimeItem } from "@/modules/screen-time";

const MIN_APPS = 3;

export default function OnboardingDistractingApps() {
  const router = useRouter();
  const { setDistractingApps } = useMarshmallowProfile();
  const [selectedApps, setSelectedApps] = useState<ScreenTimeItem[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  const appCount = selectedApps.filter((item) => item.type === "application").length;
  const canContinue = appCount >= MIN_APPS;

  const handlePickApps = useCallback(async () => {
    setIsPicking(true);
    try {
      const picked = await ScreenTime.openAppPicker();
      if (picked !== null) {
        setSelectedApps(picked);
      }
    } catch {
      Alert.alert("Error", "Failed to open app picker.");
    } finally {
      setIsPicking(false);
    }
  }, []);

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
          <HeroTitle>Which apps{"\n"}distract you most?</HeroTitle>
          <HeroSubtitle>
            Select at least {MIN_APPS} apps — we&apos;ll use these for quick-add on focus blocks
          </HeroSubtitle>

          <View style={styles.counterRow}>
            <Text
              style={[
                styles.counterText,
                canContinue && styles.counterTextReady,
              ]}
            >
              {appCount}/{MIN_APPS} apps selected
            </Text>
          </View>

          <Card tone="surface" style={styles.appsCard}>
            {selectedApps.length > 0 ? (
              <ScrollView
                style={styles.appList}
                contentContainerStyle={styles.appListContent}
                showsVerticalScrollIndicator={false}
              >
                {selectedApps.map((app) => (
                  <View key={app.id} style={styles.appRow}>
                    <Ionicons
                      name={
                        app.type === "application"
                          ? "apps-outline"
                          : app.type === "category"
                            ? "folder-outline"
                            : "globe-outline"
                      }
                      size={18}
                      color={Theme.colors.secondary}
                    />
                    <Text style={styles.appLabel} numberOfLines={1}>
                      {app.label}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No apps selected yet</Text>
            )}

            <Button
              variant="outline"
              onPress={handlePickApps}
              loading={isPicking}
              icon="add-circle-outline"
              iconSize={18}
              label={selectedApps.length > 0 ? "Edit Selection" : "Choose Apps"}
            />
          </Card>
        </View>

        <OnboardingButton
          label="Next"
          disabled={!canContinue}
          onPress={() => {
            if (!canContinue) return;
            setDistractingApps(selectedApps);
            router.push("/onboarding-premium");
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
  },
  counterRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  counterText: {
    fontFamily: Theme.fonts.semibold,
    fontSize: 15,
    color: Theme.colors.textSecondary,
  },
  counterTextReady: {
    color: Theme.colors.success,
  },
  appsCard: {
    padding: 16,
    alignItems: "center",
    flex: 1,
    maxHeight: 280,
  },
  appList: {
    width: "100%",
    marginBottom: 12,
  },
  appListContent: {
    gap: 10,
  },
  appRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appLabel: {
    flex: 1,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    color: Theme.colors.text,
  },
  emptyText: {
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    color: Theme.colors.gray,
    marginBottom: 12,
  },
});

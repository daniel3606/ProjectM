import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { isPresetColor } from "@/lib/color";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import CustomColorModal from "@/components/ui/CustomColorModal";
import { Screen, ScreenTitle, ColorPicker } from "@/components/ui";

const PREVIEW_SIZE_CM = 4;

export default function CustomizeScreen() {
  const profile = useMarshmallowProfile();
  const router = useRouter();
  const { isPremium, isSubscriptionLoaded } = useSubscription();
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  // A colour that isn't in the palette can only have come from the custom
  // picker, so the swatch shows it back rather than the empty rainbow.
  const customColor = isPresetColor(profile.color) ? undefined : profile.color;

  const handleCustomPress = useCallback(() => {
    // Until the entitlement has been read we don't know which of the two this
    // tap means, and guessing sends someone to the wrong screen.
    if (!isSubscriptionLoaded) return;
    if (!isPremium) {
      router.push("/premium");
      return;
    }
    setIsCustomPickerOpen(true);
  }, [isPremium, isSubscriptionLoaded, router]);

  const handleCustomConfirm = useCallback(
    (hex: string) => {
      profile.setColor(hex);
      setIsCustomPickerOpen(false);
    },
    [profile]
  );

  return (
    <Screen style={styles.screen}>
      <View style={styles.previewSection}>
        <ScreenTitle style={styles.title}>Customize</ScreenTitle>

        <View style={styles.previewWrap}>
          <MarshmallowCharacter
            color={profile.color}
            name={profile.name}
            sizeCm={PREVIEW_SIZE_CM}
            items={profile.items}
          />
        </View>
      </View>

      <ScrollView
        style={styles.optionsScroll}
        contentContainerStyle={styles.optionsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color</Text>
          <ColorPicker
            colors={MARSHMALLOW_COLORS}
            selected={profile.color}
            onSelect={profile.setColor}
            custom={{
              value: customColor,
              selected: customColor !== undefined,
              locked: !isPremium,
              onPress: handleCustomPress,
            }}
          />
        </View>

        <View style={styles.comingSoon}>
          <Ionicons name="sparkles-outline" size={18} color={Theme.colors.secondary} />
          <Text style={styles.comingSoonText}>
            Hats, wings and accessories are on the way — they&apos;ll arrive in a future update.
          </Text>
        </View>
      </ScrollView>

      <CustomColorModal
        visible={isCustomPickerOpen}
        initialColor={profile.color}
        onCancel={() => setIsCustomPickerOpen(false)}
        onConfirm={handleCustomConfirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  previewSection: {
    paddingHorizontal: Theme.spacing.xxl,
  },
  title: {
    fontSize: 26,
    paddingTop: 16,
  },
  previewWrap: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 32,
  },
  optionsScroll: {
    flex: 1,
  },
  optionsContent: {
    paddingHorizontal: Theme.spacing.xxl,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxxl,
  },
  section: {
    marginBottom: Theme.spacing.xxl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  comingSoon: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Theme.spacing.md,
    padding: Theme.spacing.lg,
    borderRadius: Theme.radius.xl,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  comingSoonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
  },
});

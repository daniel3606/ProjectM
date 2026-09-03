import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { Screen, ScreenTitle, ColorPicker, ProBadge } from "@/components/ui";
import CustomColorModal from "@/components/ui/CustomColorModal";
import {
  ITEM_SLOTS,
  getItemsForSlot,
  type ItemSlot,
  type MarshmallowItem,
} from "@/constants/items";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { isPresetColor } from "@/lib/color";
import { hapticSelection } from "@/lib/haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const PREVIEW_SIZE_CM = 4;

export default function CustomizeScreen() {
  const profile = useMarshmallowProfile();
  const router = useRouter();
  const { isPremium, isSubscriptionLoaded } = useSubscription();
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  // A colour that isn't in the palette can only have come from the custom
  // picker, so the swatch shows it back rather than the empty rainbow.
  const customColor = isPresetColor(profile.color) ? undefined : profile.color;

  const requirePremium = useCallback(() => {
    // Until the entitlement has been read we don't know which of the two this
    // tap means, and guessing sends someone to the wrong screen.
    if (!isSubscriptionLoaded) return false;
    if (!isPremium) {
      router.push("/premium");
      return false;
    }
    return true;
  }, [isPremium, isSubscriptionLoaded, router]);

  const handleCustomPress = useCallback(() => {
    if (!requirePremium()) return;
    setIsCustomPickerOpen(true);
  }, [requirePremium]);

  const handleCustomConfirm = useCallback(
    (hex: string) => {
      profile.setColor(hex);
      setIsCustomPickerOpen(false);
    },
    [profile]
  );

  const handleItemPress = useCallback(
    (slot: ItemSlot, itemId: string) => {
      if (!requirePremium()) return;
      hapticSelection();
      profile.toggleItem(slot, itemId);
    },
    [profile, requirePremium]
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
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Color</Text>
          </View>
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

        {ITEM_SLOTS.map((slot) => (
          <View key={slot.id} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{slot.label}</Text>
              {!isPremium ? <ProBadge /> : null}
            </View>
            <View style={styles.itemGrid}>
              {getItemsForSlot(slot.id).map((item) => (
                <ItemOption
                  key={item.id}
                  item={item}
                  selected={profile.items[slot.id] === item.id}
                  locked={!isPremium}
                  onPress={() => handleItemPress(slot.id, item.id)}
                />
              ))}
            </View>
          </View>
        ))}
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

function ItemOption({
  item,
  selected,
  locked,
  onPress,
}: {
  item: MarshmallowItem;
  selected: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.itemOption} testID={`item-${item.id}`}>
      <View
        style={[
          styles.itemSwatch,
          selected && styles.itemSwatchSelected,
        ]}
      >
        {item.image ? (
          <Image source={item.image} style={styles.itemImage} resizeMode="contain" />
        ) : (
          <Text style={styles.itemEmoji}>{item.emoji}</Text>
        )}
        {locked ? (
          <View style={styles.itemLock}>
            <Ionicons name="lock-closed" size={14} color={Theme.colors.white} />
          </View>
        ) : null}
      </View>
      <Text style={styles.itemLabel} numberOfLines={1}>
        {item.name}
      </Text>
    </Pressable>
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
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  itemOption: {
    alignItems: "center",
    width: 72,
  },
  itemSwatch: {
    width: 64,
    height: 64,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.card,
    borderWidth: 2,
    borderColor: Theme.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  itemSwatchSelected: {
    borderColor: Theme.colors.secondary,
  },
  itemEmoji: {
    fontSize: 28,
  },
  itemImage: {
    width: 48,
    height: 28,
  },
  itemLock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  itemLabel: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
    textAlign: "center",
  },
});

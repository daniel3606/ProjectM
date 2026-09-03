import type { ImageSourcePropType } from "react-native";

export type ItemSlot = "headwear" | "wings" | "face";

export interface MarshmallowItem {
  id: string;
  name: string;
  slot: ItemSlot;
  emoji: string;
  /** Optional artwork used in-app instead of the emoji. */
  image?: ImageSourcePropType;
}

export const MARSHMALLOW_ITEMS: readonly MarshmallowItem[] = [
  {
    id: "crown",
    name: "Crown",
    slot: "headwear",
    emoji: "👑",
    image: require("@/assets/images/items/crown.png"),
  },
  { id: "top-hat", name: "Top Hat", slot: "headwear", emoji: "🎩" },
];

export const ITEM_SLOTS: readonly { id: ItemSlot; label: string }[] = [
  { id: "headwear", label: "Headwear" },
] as const;

export function getItemsForSlot(slot: ItemSlot): MarshmallowItem[] {
  return MARSHMALLOW_ITEMS.filter((item) => item.slot === slot);
}

export function getItemById(itemId: string | undefined): MarshmallowItem | undefined {
  if (!itemId) return undefined;
  return MARSHMALLOW_ITEMS.find((item) => item.id === itemId);
}

export type EquippedItems = Partial<Record<ItemSlot, string>>;

/** Maps each equipped slot to the emoji it renders as, dropping unknown item ids. */
export function resolveEquippedEmoji(
  items: EquippedItems | undefined
): Partial<Record<ItemSlot, string>> {
  const resolved: Partial<Record<ItemSlot, string>> = {};
  if (!items) return resolved;

  for (const [slot, itemId] of Object.entries(items) as [ItemSlot, string | undefined][]) {
    const emoji = MARSHMALLOW_ITEMS.find((item) => item.id === itemId)?.emoji;
    if (emoji) resolved[slot] = emoji;
  }
  return resolved;
}

export type ItemSlot = "headwear" | "wings" | "face";

export interface MarshmallowItem {
  id: string;
  name: string;
  slot: ItemSlot;
  emoji: string;
}

export const MARSHMALLOW_ITEMS: readonly MarshmallowItem[] = [
  { id: "crown", name: "Crown", slot: "headwear", emoji: "👑" },
  { id: "top-hat", name: "Top Hat", slot: "headwear", emoji: "🎩" },
  { id: "party-hat", name: "Party Hat", slot: "headwear", emoji: "🥳" },
  { id: "halo", name: "Halo", slot: "headwear", emoji: "😇" },

  { id: "angel-wings", name: "Angel Wings", slot: "wings", emoji: "🪽" },
  { id: "butterfly-wings", name: "Butterfly Wings", slot: "wings", emoji: "🦋" },

  { id: "sunglasses", name: "Sunglasses", slot: "face", emoji: "🕶️" },
  { id: "bow", name: "Bow", slot: "face", emoji: "🎀" },
  { id: "flower", name: "Flower", slot: "face", emoji: "🌸" },
] as const;

export const ITEM_SLOTS: readonly { id: ItemSlot; label: string }[] = [
  { id: "headwear", label: "Headwear" },
  { id: "wings", label: "Wings" },
  { id: "face", label: "Accessories" },
] as const;

export function getItemsForSlot(slot: ItemSlot): MarshmallowItem[] {
  return MARSHMALLOW_ITEMS.filter((item) => item.slot === slot);
}

export type EquippedItems = Partial<Record<ItemSlot, string>>;

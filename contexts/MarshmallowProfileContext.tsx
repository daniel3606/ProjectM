import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import type { EquippedItems, ItemSlot } from "@/constants/items";
import { usePersistedState } from "@/lib/storage";
import { syncProfile, fetchRemoteProfile } from "@/lib/sync";
import { supabase } from "@/lib/supabase";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];

interface MarshmallowProfileContextValue {
  name: string;
  color: MarshmallowColorHex;
  items: EquippedItems;
  setName: (name: string) => void;
  setColor: (color: MarshmallowColorHex) => void;
  /** Equips `itemId` in its slot, or clears the slot if it's already equipped there. */
  toggleItem: (slot: ItemSlot, itemId: string) => void;
}

const DEFAULT_NAME = "Mochi";
const DEFAULT_COLOR: MarshmallowColorHex = MARSHMALLOW_COLORS[0].hex;
const DEFAULT_ITEMS: EquippedItems = {};

const MarshmallowProfileContext = createContext<MarshmallowProfileContextValue | null>(null);

export function MarshmallowProfileProvider({ children }: { children: React.ReactNode }) {
  const [name, setRawName] = usePersistedState("profile.name", DEFAULT_NAME);
  const [color, setRawColor] = usePersistedState<MarshmallowColorHex>(
    "profile.color",
    DEFAULT_COLOR
  );
  const [items, setItems] = usePersistedState<EquippedItems>("profile.items", DEFAULT_ITEMS);

  // Hydrate local state from Supabase profile on login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const remote = await fetchRemoteProfile(session.user.id);
          if (remote) {
            if (remote.display_name) setRawName(remote.display_name);
            if (remote.marshmallow_color) {
              setRawColor(remote.marshmallow_color as MarshmallowColorHex);
            }
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [setRawName, setRawColor]);

  const setName = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (trimmed.length === 0) return;
      setRawName(trimmed);
      // Fire-and-forget sync — we'll read the current color from the closure
      syncProfile(trimmed, color).catch(() => {});
    },
    [setRawName, color]
  );

  const setColor = useCallback(
    (next: MarshmallowColorHex) => {
      setRawColor(next);
      syncProfile(name, next).catch(() => {});
    },
    [setRawColor, name]
  );

  const toggleItem = useCallback(
    (slot: ItemSlot, itemId: string) => {
      setItems((prev) => {
        if (prev[slot] === itemId) {
          const next = { ...prev };
          delete next[slot];
          return next;
        }
        return { ...prev, [slot]: itemId };
      });
    },
    [setItems]
  );

  const value = useMemo(
    () => ({ name, color, items, setName, setColor, toggleItem }),
    [name, color, items, setName, setColor, toggleItem]
  );

  return (
    <MarshmallowProfileContext.Provider value={value}>
      {children}
    </MarshmallowProfileContext.Provider>
  );
}

export function useMarshmallowProfile() {
  const ctx = useContext(MarshmallowProfileContext);
  if (!ctx) {
    throw new Error("useMarshmallowProfile must be used within a MarshmallowProfileProvider");
  }
  return ctx;
}

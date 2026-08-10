import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { usePersistedState } from "@/lib/storage";
import { syncProfile, fetchRemoteProfile } from "@/lib/sync";
import { supabase } from "@/lib/supabase";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];

interface MarshmallowProfileContextValue {
  name: string;
  color: MarshmallowColorHex;
  setName: (name: string) => void;
  setColor: (color: MarshmallowColorHex) => void;
}

const DEFAULT_NAME = "Mochi";
const DEFAULT_COLOR: MarshmallowColorHex = MARSHMALLOW_COLORS[0].hex;

const MarshmallowProfileContext = createContext<MarshmallowProfileContextValue | null>(null);

export function MarshmallowProfileProvider({ children }: { children: React.ReactNode }) {
  const [name, setRawName] = usePersistedState("profile.name", DEFAULT_NAME);
  const [color, setRawColor] = usePersistedState<MarshmallowColorHex>(
    "profile.color",
    DEFAULT_COLOR
  );

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

  const value = useMemo(
    () => ({ name, color, setName, setColor }),
    [name, color, setName, setColor]
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

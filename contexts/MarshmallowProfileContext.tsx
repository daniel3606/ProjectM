import React, { createContext, useCallback, useContext, useMemo } from "react";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { usePersistedState } from "@/lib/storage";

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
  const [color, setColor] = usePersistedState<MarshmallowColorHex>(
    "profile.color",
    DEFAULT_COLOR
  );

  // A marshmallow must always have a name — silently ignore attempts to
  // clear it rather than letting an empty string get persisted.
  const setName = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (trimmed.length === 0) return;
      setRawName(trimmed);
    },
    [setRawName]
  );

  const value = useMemo(
    () => ({ name, color, setName, setColor }),
    [name, color, setName]
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

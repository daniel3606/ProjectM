import React, { createContext, useCallback, useContext, useMemo } from "react";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { usePersistedState } from "@/lib/storage";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];

interface MarshmallowProfileContextValue {
  name: string;
  color: MarshmallowColorHex;
  setName: (name: string) => void;
  setColor: (color: MarshmallowColorHex) => void;
  /** Whether the create-marshmallow + purpose/screentime/premium flow has ever been finished. */
  hasCompletedOnboarding: boolean;
  /** True once the persisted onboarding flag has been read from disk — gate navigation on this to avoid a false redirect back into onboarding. */
  onboardingStatusLoaded: boolean;
  completeOnboarding: () => void;
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
  // Local-device persistence — the intended home once a backend exists is a
  // synced user record, but until then this is the only way onboarding
  // state survives an app reload for both guests and signed-in users.
  const [hasCompletedOnboarding, setHasCompletedOnboarding, onboardingStatusLoaded] =
    usePersistedState("onboarding.completed", false);

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

  const completeOnboarding = useCallback(() => {
    setHasCompletedOnboarding(true);
  }, [setHasCompletedOnboarding]);

  const value = useMemo(
    () => ({
      name,
      color,
      setName,
      setColor,
      hasCompletedOnboarding,
      onboardingStatusLoaded,
      completeOnboarding,
    }),
    [name, color, setName, hasCompletedOnboarding, onboardingStatusLoaded, completeOnboarding]
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

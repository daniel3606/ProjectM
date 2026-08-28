import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { resolveEquippedEmoji, type EquippedItems, type ItemSlot } from "@/constants/items";
import { useAuth } from "@/contexts/AuthContext";
import { usePersistedState } from "@/lib/storage";
import {
  syncProfile,
  syncEquippedItems,
  fetchRemoteProfile,
  syncOnboarding,
  type OnboardingAnswers,
} from "@/lib/sync";
import * as ScreenTime from "@/modules/screen-time";
import type { ScreenTimeItem } from "@/modules/screen-time";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];

interface MarshmallowProfileContextValue {
  name: string;
  color: MarshmallowColorHex;
  items: EquippedItems;
  onboardingCompleted: boolean;
  /** True once local storage has loaded and, if logged in, the remote profile has been fetched. */
  isProfileReady: boolean;
  setName: (name: string) => void;
  setColor: (color: MarshmallowColorHex) => void;
  /** Equips `itemId` in its slot, or clears the slot if it's already equipped there. */
  toggleItem: (slot: ItemSlot, itemId: string) => void;
  /** Apps chosen during onboarding for quick-add on focus blocks. */
  distractingApps: ScreenTimeItem[];
  setDistractingApps: (apps: ScreenTimeItem[]) => void;
  /** Marks onboarding done and pushes its answers in a single write. */
  completeOnboarding: (answers?: OnboardingAnswers) => Promise<void>;
}

const DEFAULT_NAME = "Mochi";
const DEFAULT_COLOR: MarshmallowColorHex = MARSHMALLOW_COLORS[0].hex;
const DEFAULT_ITEMS: EquippedItems = {};

const MarshmallowProfileContext = createContext<MarshmallowProfileContextValue | null>(null);

export function MarshmallowProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [name, setRawName] = usePersistedState("profile.name", DEFAULT_NAME);
  const [color, setRawColor] = usePersistedState<MarshmallowColorHex>(
    "profile.color",
    DEFAULT_COLOR
  );
  const [items, setItems] = usePersistedState<EquippedItems>("profile.items", DEFAULT_ITEMS);
  const [onboardingCompleted, setOnboardingCompleted, onboardingLoaded] = usePersistedState(
    "onboarding.completed",
    false
  );
  const [distractingApps, setRawDistractingApps] = usePersistedState<ScreenTimeItem[]>(
    "onboarding.distractingApps",
    []
  );
  const userId = user?.id ?? null;
  const [hydratedUserId, setHydratedUserId] = useState<string | "guest" | null>(null);

  // Hydrate from Supabase whenever the signed-in user changes (including session restore).
  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      setHydratedUserId("guest");
      return;
    }

    let cancelled = false;

    fetchRemoteProfile(userId)
      .then((remote) => {
        if (cancelled) return;

        if (remote) {
          // A remote profile only outranks local state once its own onboarding
          // is finished. Before that the row is a freshly created default, and
          // its `display_name` is the person's name from their auth provider
          // (see `ensureAppProfile`) rather than a marshmallow's — hydrating
          // from it would rename the marshmallow the user just made and
          // repaint it, moments after we asked them to save it.
          if (remote.onboarding_completed) {
            if (remote.display_name) setRawName(remote.display_name);
            if (remote.marshmallow_color) {
              setRawColor(remote.marshmallow_color as MarshmallowColorHex);
            }
            if (remote.equipped_items && typeof remote.equipped_items === "object") {
              setItems(remote.equipped_items as EquippedItems);
            }
            // Promote only. A row that hasn't caught up yet must not push a
            // finished user back into onboarding.
            setOnboardingCompleted(true);
          }
        }

        setHydratedUserId(userId);
      })
      .catch(() => {
        if (!cancelled) setHydratedUserId(userId);
      });

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    userId,
    setRawName,
    setRawColor,
    setItems,
    setOnboardingCompleted,
  ]);

  // Anything customized before signing in never reached the server, because
  // there was no account to attach it to yet. This is the catch-up write, once
  // per account, and only while onboarding is unfinished — after that the
  // remote profile is authoritative and this would fight the hydrate above.
  const caughtUpUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || hydratedUserId !== userId) return;
    if (onboardingCompleted) return;
    if (caughtUpUserIdRef.current === userId) return;

    caughtUpUserIdRef.current = userId;
    syncProfile(name, color, items).catch(() => {});
  }, [color, hydratedUserId, items, name, onboardingCompleted, userId]);

  // Keeps the widget's marshmallow appearance in sync, whether it changed
  // locally or was just hydrated from the remote profile.
  useEffect(() => {
    ScreenTime.setMarshmallowColorHex(color);
  }, [color]);

  useEffect(() => {
    ScreenTime.setMarshmallowItems(resolveEquippedEmoji(items));
  }, [items]);

  const isProfileReady =
    !authLoading &&
    onboardingLoaded &&
    (userId ? hydratedUserId === userId : hydratedUserId === "guest");

  const setName = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      if (trimmed.length === 0) return;
      setRawName(trimmed);
      syncProfile(trimmed, color, items).catch(() => {});
    },
    [setRawName, color, items]
  );

  const setColor = useCallback(
    (next: MarshmallowColorHex) => {
      setRawColor(next);
      syncProfile(name, next, items).catch(() => {});
    },
    [setRawColor, name, items]
  );

  const toggleItem = useCallback(
    (slot: ItemSlot, itemId: string) => {
      setItems((prev) => {
        let next: EquippedItems;
        if (prev[slot] === itemId) {
          next = { ...prev };
          delete next[slot];
        } else {
          next = { ...prev, [slot]: itemId };
        }
        syncEquippedItems(next).catch(() => {});
        return next;
      });
    },
    [setItems]
  );

  const setDistractingApps = useCallback(
    (apps: ScreenTimeItem[]) => {
      setRawDistractingApps(apps);
    },
    [setRawDistractingApps]
  );

  const completeOnboarding = useCallback(
    async (answers: OnboardingAnswers = {}) => {
      setOnboardingCompleted(true);
      await syncOnboarding({ ...answers, completed: true });
    },
    [setOnboardingCompleted]
  );

  const value = useMemo(
    () => ({
      name,
      color,
      items,
      onboardingCompleted,
      isProfileReady,
      setName,
      setColor,
      toggleItem,
      distractingApps,
      setDistractingApps,
      completeOnboarding,
    }),
    [
      name,
      color,
      items,
      onboardingCompleted,
      isProfileReady,
      setName,
      setColor,
      toggleItem,
      distractingApps,
      setDistractingApps,
      completeOnboarding,
    ]
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

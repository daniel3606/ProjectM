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
  /** The current daily screen time captured during onboarding; Stats reads it as their starting point. */
  onboardingScreenTime: string | null;
  /** Apps chosen during onboarding for quick-add on focus blocks. */
  distractingApps: ScreenTimeItem[];
  setDistractingApps: (apps: ScreenTimeItem[]) => void;
  /**
   * Apps the user never wants reachable during a block. Merged into every
   * block's selection regardless of which apps that block picked. Local only —
   * it isn't part of the synced onboarding payload.
   */
  neverAllowedApps: ScreenTimeItem[];
  setNeverAllowedApps: (apps: ScreenTimeItem[]) => void;
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
  /**
   * Which account set Marshmallow up on this device, rather than whether
   * anyone did. Onboarding belongs to an account, and a bare flag can't tell
   * the person who finished it from the next person to sign in here.
   */
  const [completedByUserId, setCompletedByUserId, onboardingLoaded] = usePersistedState<
    string | null
  >("onboarding.completedBy", null);
  const [remoteCompleted, setRemoteCompleted] = useState(false);
  const [onboardingScreenTime, setOnboardingScreenTime] = usePersistedState<string | null>(
    "onboarding.screenTime",
    null
  );
  const [distractingApps, setRawDistractingApps] = usePersistedState<ScreenTimeItem[]>(
    "onboarding.distractingApps",
    []
  );
  const [neverAllowedApps, setNeverAllowedApps] = usePersistedState<ScreenTimeItem[]>(
    "blocking.neverAllowedApps",
    []
  );
  const userId = user?.id ?? null;
  const [hydratedUserId, setHydratedUserId] = useState<string | "guest" | null>(null);

  // Hydrate from Supabase whenever the signed-in user changes (including session restore).
  useEffect(() => {
    if (authLoading) return;

    if (!userId) {
      setRemoteCompleted(false);
      setHydratedUserId("guest");
      return;
    }

    let cancelled = false;

    fetchRemoteProfile(userId)
      .then((remote) => {
        if (cancelled) return;

        setRemoteCompleted(remote?.onboarding_completed ?? false);

        if (remote) {
          // Appearance is only worth taking from an account that finished
          // onboarding. Before that the row is a freshly created default whose
          // `display_name` is the person's name from their auth provider (see
          // `ensureAppProfile`) rather than a marshmallow's — hydrating from it
          // would rename the marshmallow the user just made and repaint it,
          // moments after we asked them to save it.
          if (remote.onboarding_completed) {
            if (remote.display_name) setRawName(remote.display_name);
            if (remote.marshmallow_color) {
              setRawColor(remote.marshmallow_color as MarshmallowColorHex);
            }
            if (remote.equipped_items && typeof remote.equipped_items === "object") {
              setItems(remote.equipped_items as EquippedItems);
            }
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
  }, [authLoading, userId, setRawName, setRawColor, setItems]);

  /**
   * Onboarding is finished for this account if either side says so. The device
   * knows the moment it happens; the profile is what a second device reads.
   * Neither can overrule the other, so a write that didn't land can't put
   * someone back through a flow they've already done.
   */
  const onboardingCompleted = remoteCompleted || (userId !== null && completedByUserId === userId);

  // Completion is written from the last screen of the flow, where a dropped
  // connection is easy to come by, and it's the one answer that has to survive:
  // without it a new device would ask this account to set up all over again.
  // Push it again if the profile is still behind what this device recorded.
  const repairedUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || hydratedUserId !== userId) return;
    if (remoteCompleted || completedByUserId !== userId) return;
    if (repairedUserIdRef.current === userId) return;

    repairedUserIdRef.current = userId;
    syncOnboarding({ completed: true })
      .then(({ error }) => {
        if (!error) setRemoteCompleted(true);
      })
      .catch(() => {});
  }, [completedByUserId, hydratedUserId, remoteCompleted, userId]);

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
      // Recorded against the account before the write, so this device honours
      // it immediately and keeps honouring it if the write never lands.
      if (userId) setCompletedByUserId(userId);
      if (answers.currentScreenTimeMinutes != null) {
        setOnboardingScreenTime(String(answers.currentScreenTimeMinutes));
      }

      const { error } = await syncOnboarding({ ...answers, completed: true });
      if (!error) setRemoteCompleted(true);
    },
    [setCompletedByUserId, setOnboardingScreenTime, userId]
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
      onboardingScreenTime,
      distractingApps,
      setDistractingApps,
      neverAllowedApps,
      setNeverAllowedApps,
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
      onboardingScreenTime,
      distractingApps,
      setDistractingApps,
      neverAllowedApps,
      setNeverAllowedApps,
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

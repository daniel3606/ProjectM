import React, { createContext, useCallback, useContext, useMemo } from "react";
import {
  FREE_TIMED_BLOCK_LIMIT,
  PREMIUM_TIMED_BLOCK_LIMIT,
} from "@/constants/subscription";
import { usePersistedState } from "@/lib/storage";

export { FREE_TIMED_BLOCK_LIMIT, PREMIUM_TIMED_BLOCK_LIMIT };

interface SubscriptionContextValue {
  isPremium: boolean;
  /** False until the stored entitlement has been read, so gates don't flash. */
  isSubscriptionLoaded: boolean;
  /** Premium is capped; free is the smaller free-tier allowance. */
  timedBlockLimit: number;
  setPremium: (value: boolean) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/**
 * Holds the account's entitlement. There is no store integration yet, so the
 * flag is persisted locally and defaults to free; swap `usePersistedState` for
 * the receipt/entitlement check when billing lands.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium, isSubscriptionLoaded] = usePersistedState(
    "subscription.isPremium",
    false
  );

  const setPremium = useCallback(
    (value: boolean) => setIsPremium(value),
    [setIsPremium]
  );

  const value = useMemo(
    () => ({
      isPremium,
      isSubscriptionLoaded,
      timedBlockLimit: isPremium ? PREMIUM_TIMED_BLOCK_LIMIT : FREE_TIMED_BLOCK_LIMIT,
      setPremium,
    }),
    [isPremium, isSubscriptionLoaded, setPremium]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}

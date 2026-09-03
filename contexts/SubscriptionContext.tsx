import { useAuth } from "@/contexts/AuthContext";
import {
  FREE_TIMED_BLOCK_LIMIT,
  PREMIUM_PRODUCT_IDS,
  PREMIUM_TIMED_BLOCK_LIMIT,
  type SubscriptionPlanId,
} from "@/constants/subscription";
import { fetchRemotePremium } from "@/lib/remotePremium";
import {
  androidOfferToken,
  appAccountToken,
  buildSubscriptionPurchaseRequest,
  hasPremiumAccess,
  isAlreadyOwnedPurchase,
  isPremiumEntitlement,
  isStoreBillingSupported,
  isUserCancelledPurchase,
  premiumEntitlementsFromStore,
  productIdForPlan,
  storeDisplayPrice,
  type PurchaseAttemptResult,
} from "@/lib/storeBilling";
import {
  deepLinkToSubscriptions,
  getActiveSubscriptions as fetchActiveSubscriptionsFromStore,
  useIAP,
  type Purchase,
} from "expo-iap";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

export { FREE_TIMED_BLOCK_LIMIT, PREMIUM_TIMED_BLOCK_LIMIT };

const STORE_CHECK_TIMEOUT_MS = 5000;
const PREMIUM_SKU_LIST = [...PREMIUM_PRODUCT_IDS];

interface SubscriptionContextValue {
  isPremium: boolean;
  /** True when Apple/Google currently reports an active paid plan. */
  hasStoreSubscription: boolean;
  /** False until store and server entitlements have been read, so gates don't flash. */
  isSubscriptionLoaded: boolean;
  /** Premium is capped; free is the smaller free-tier allowance. */
  timedBlockLimit: number;
  isPurchasing: boolean;
  isStoreAvailable: boolean;
  storePriceByPlan: Partial<Record<SubscriptionPlanId, string>>;
  purchasePlan: (planId: SubscriptionPlanId) => Promise<PurchaseAttemptResult>;
  restoreAccountPurchases: () => Promise<PurchaseAttemptResult>;
  manageSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const unavailablePurchase = async (): Promise<PurchaseAttemptResult> => "unavailable";

function useRemotePremium(userId: string | undefined) {
  const [granted, setGranted] = useState(false);
  const [loaded, setLoaded] = useState(!userId);

  useEffect(() => {
    if (!userId) {
      setGranted(false);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    setLoaded(false);

    const timeout = setTimeout(() => {
      if (!cancelled) setLoaded(true);
    }, STORE_CHECK_TIMEOUT_MS);

    void fetchRemotePremium(userId).then((value) => {
      if (cancelled) return;
      setGranted(value);
      setLoaded(true);
    });

    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void fetchRemotePremium(userId).then((value) => {
        if (!cancelled) setGranted(value);
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      appState.remove();
    };
  }, [userId]);

  return { granted, loaded };
}

function UnsupportedStoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { granted, loaded } = useRemotePremium(user?.id);
  const isPremium = hasPremiumAccess(false, granted);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium,
      hasStoreSubscription: false,
      isSubscriptionLoaded: loaded,
      timedBlockLimit: isPremium ? PREMIUM_TIMED_BLOCK_LIMIT : FREE_TIMED_BLOCK_LIMIT,
      isPurchasing: false,
      isStoreAvailable: false,
      storePriceByPlan: {},
      purchasePlan: unavailablePurchase,
      restoreAccountPurchases: unavailablePurchase,
      manageSubscription: async () => undefined,
    }),
    [isPremium, loaded]
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

/**
 * Entitlement is StoreKit / Play Billing OR a complimentary row in Supabase.
 * The paywall never grants Premium locally.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  if (!isStoreBillingSupported(Platform.OS)) {
    return <UnsupportedStoreProvider>{children}</UnsupportedStoreProvider>;
  }
  return <StoreSubscriptionProvider>{children}</StoreSubscriptionProvider>;
}

function StoreSubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { granted: grantedPremium, loaded: hasCheckedRemote } = useRemotePremium(
    user?.id
  );
  const [hasCheckedStore, setHasCheckedStore] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const pendingPurchaseRef = useRef<
    ((result: PurchaseAttemptResult) => void) | undefined
  >(undefined);

  const resolvePendingPurchase = useCallback((result: PurchaseAttemptResult) => {
    pendingPurchaseRef.current?.(result);
    pendingPurchaseRef.current = undefined;
    setIsPurchasing(false);
  }, []);

  const {
    connected,
    subscriptions,
    activeSubscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getActiveSubscriptions,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      try {
        await finishTransaction({ purchase, isConsumable: false });
        await getActiveSubscriptions(PREMIUM_SKU_LIST);
        resolvePendingPurchase("purchased");
      } catch {
        resolvePendingPurchase("failed");
      }
    },
    onPurchaseError: (error) => {
      if (isAlreadyOwnedPurchase(error)) {
        void getActiveSubscriptions(PREMIUM_SKU_LIST).then(
          () => resolvePendingPurchase("purchased"),
          () => resolvePendingPurchase("failed")
        );
        return;
      }
      resolvePendingPurchase(isUserCancelledPurchase(error) ? "cancelled" : "failed");
    },
  });

  useEffect(() => {
    if (hasCheckedStore) return;
    const timeout = setTimeout(() => setHasCheckedStore(true), STORE_CHECK_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [hasCheckedStore]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        await fetchProducts({ skus: PREMIUM_SKU_LIST, type: "subs" });
        await getActiveSubscriptions(PREMIUM_SKU_LIST);
      } finally {
        if (!cancelled) setHasCheckedStore(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, fetchProducts, getActiveSubscriptions]);

  const hasStoreSubscription = isPremiumEntitlement(
    premiumEntitlementsFromStore(activeSubscriptions)
  );
  const isPremium = hasPremiumAccess(hasStoreSubscription, grantedPremium);

  const storePriceByPlan = useMemo(
    () => ({
      yearly: storeDisplayPrice(subscriptions, "yearly"),
      monthly: storeDisplayPrice(subscriptions, "monthly"),
    }),
    [subscriptions]
  );

  const purchasePlan = useCallback(
    async (planId: SubscriptionPlanId): Promise<PurchaseAttemptResult> => {
      if (!connected) return "unavailable";

      const sku = productIdForPlan(planId);
      const product = subscriptions.find((item) => item.id === sku);
      setIsPurchasing(true);

      return new Promise((resolve) => {
        pendingPurchaseRef.current = resolve;
        requestPurchase(
          buildSubscriptionPurchaseRequest(sku, {
            appAccountToken: appAccountToken(user?.id),
            androidOfferToken: androidOfferToken(product),
          })
        ).catch((error: unknown) => {
          resolvePendingPurchase(
            isUserCancelledPurchase(error) ? "cancelled" : "failed"
          );
        });
      });
    },
    [connected, requestPurchase, resolvePendingPurchase, subscriptions, user?.id]
  );

  const restoreAccountPurchases = useCallback(async (): Promise<PurchaseAttemptResult> => {
    if (!connected) return "unavailable";
    try {
      await restorePurchases();
      const restored = await fetchActiveSubscriptionsFromStore(PREMIUM_SKU_LIST);
      await getActiveSubscriptions(PREMIUM_SKU_LIST);
      return isPremiumEntitlement(premiumEntitlementsFromStore(restored))
        ? "restored"
        : "none";
    } catch {
      return "failed";
    }
  }, [connected, getActiveSubscriptions, restorePurchases]);

  const manageSubscription = useCallback(async () => {
    await deepLinkToSubscriptions({
      skuAndroid: productIdForPlan("yearly"),
      packageNameAndroid: "com.dllim.marshmallow",
    });
  }, []);

  const value = useMemo(
    () => ({
      isPremium,
      hasStoreSubscription,
      isSubscriptionLoaded: hasCheckedStore && hasCheckedRemote,
      timedBlockLimit: isPremium ? PREMIUM_TIMED_BLOCK_LIMIT : FREE_TIMED_BLOCK_LIMIT,
      isPurchasing,
      isStoreAvailable: connected,
      storePriceByPlan,
      purchasePlan,
      restoreAccountPurchases,
      manageSubscription,
    }),
    [
      connected,
      hasCheckedRemote,
      hasCheckedStore,
      hasStoreSubscription,
      isPremium,
      isPurchasing,
      manageSubscription,
      purchasePlan,
      restoreAccountPurchases,
      storePriceByPlan,
    ]
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

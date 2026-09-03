import {
  PREMIUM_PRODUCT_IDS,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from "@/constants/subscription";

export interface PremiumEntitlement {
  productId: string;
  isActive: boolean;
  expirationDateIOS?: number;
}

export type PurchaseAttemptResult =
  | "purchased"
  | "restored"
  | "none"
  | "cancelled"
  | "unavailable"
  | "failed";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** StoreKit Premium or a complimentary row in Supabase. */
export function hasPremiumAccess(
  storePremium: boolean,
  grantedPremium: boolean
): boolean {
  return storePremium || grantedPremium;
}

/** True when StoreKit (or Play Billing) reports an unexpired Premium plan. */
export function isPremiumEntitlement(
  subscriptions: readonly PremiumEntitlement[],
  nowMs = Date.now()
): boolean {
  return subscriptions.some((subscription) => {
    if (!isPremiumProductId(subscription.productId)) return false;
    if (!subscription.isActive) return false;
    if (
      typeof subscription.expirationDateIOS === "number" &&
      subscription.expirationDateIOS < nowMs
    ) {
      return false;
    }
    return true;
  });
}

export function isPremiumProductId(productId: string): boolean {
  return PREMIUM_PRODUCT_IDS.some((id) => id === productId);
}

export function productIdForPlan(planId: SubscriptionPlanId): string {
  const plan = SUBSCRIPTION_PLANS.find((item) => item.id === planId);
  return plan?.productId ?? SUBSCRIPTION_PLANS[0].productId;
}

export function isStoreBillingSupported(os: string): boolean {
  return os === "ios" || os === "android";
}

/** StoreKit's appAccountToken must be a UUID; Supabase user ids already are. */
export function appAccountToken(userId: string | undefined): string | undefined {
  if (!userId || !UUID_PATTERN.test(userId)) return undefined;
  return userId;
}

export function isUserCancelledPurchase(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "user-cancelled";
}

export function isAlreadyOwnedPurchase(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return error.code === "already-owned";
}

/** Play Billing needs an offer token from the fetched product. */
export function androidOfferToken(product: {
  platform: string;
  subscriptionOffers?: readonly { offerTokenAndroid?: string | null }[] | null;
} | undefined): string | undefined {
  if (!product || product.platform !== "android") return undefined;
  return product.subscriptionOffers?.[0]?.offerTokenAndroid ?? undefined;
}

export function storeDisplayPrice(
  products: readonly { id: string; displayPrice: string }[],
  planId: SubscriptionPlanId
): string | undefined {
  const productId = productIdForPlan(planId);
  return products.find((product) => product.id === productId)?.displayPrice;
}

export function premiumEntitlementsFromStore(
  subscriptions: readonly {
    productId: string;
    isActive: boolean;
    expirationDateIOS?: number | null;
  }[]
): PremiumEntitlement[] {
  return subscriptions.map((subscription) => ({
    productId: subscription.productId,
    isActive: subscription.isActive,
    expirationDateIOS:
      typeof subscription.expirationDateIOS === "number"
        ? subscription.expirationDateIOS
        : undefined,
  }));
}

export function buildSubscriptionPurchaseRequest(
  sku: string,
  options: {
    appAccountToken?: string;
    androidOfferToken?: string;
  } = {}
) {
  return {
    type: "subs" as const,
    request: {
      apple: {
        sku,
        ...(options.appAccountToken
          ? { appAccountToken: options.appAccountToken }
          : {}),
      },
      google: {
        skus: [sku],
        ...(options.androidOfferToken
          ? {
              subscriptionOffers: [
                { sku, offerToken: options.androidOfferToken },
              ],
            }
          : {}),
      },
    },
  };
}

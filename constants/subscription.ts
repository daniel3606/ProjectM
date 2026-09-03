export const FREE_TIMED_BLOCK_LIMIT = 2;
export const PREMIUM_TIMED_BLOCK_LIMIT = 10;

export const MONTHLY_PRICE_USD = 5.99;
export const YEARLY_PRICE_USD = 24.99;

/** Calendar days used to quote a daily rate on the paywall. */
export const MONTHLY_BILLING_DAYS = 30;
export const YEARLY_BILLING_DAYS = 365;

/**
 * App Store Connect / Play Console product IDs. Create these as auto-renewable
 * subscriptions in the same subscription group, with a 1-month free trial as
 * the introductory offer. The IDs must match exactly.
 */
export const MONTHLY_PRODUCT_ID = "com.dllim.marshmallow.premium.monthly";
export const YEARLY_PRODUCT_ID = "com.dllim.marshmallow.premium.yearly";
export const PREMIUM_PRODUCT_IDS = [YEARLY_PRODUCT_ID, MONTHLY_PRODUCT_ID] as const;

/**
 * Complimentary Premium written from the Supabase SQL editor. Not an App Store
 * SKU — StoreKit never reports this id.
 */
export const GRANTED_PRODUCT_ID = "com.dllim.marshmallow.premium.granted";

export const PRIVACY_POLICY_URL = "https://www.themarshmallow.app/privacy";
export const TERMS_OF_USE_URL = "https://www.themarshmallow.app/terms";
export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export type SubscriptionPlanId = "yearly" | "monthly";

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  label: string;
  priceUsd: number;
  /** Shown after the price, e.g. "month" → "$5.99/month". */
  periodLabel: "month" | "year";
  billingDays: number;
  productId: string;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: "yearly",
    label: "Yearly",
    priceUsd: YEARLY_PRICE_USD,
    periodLabel: "year",
    billingDays: YEARLY_BILLING_DAYS,
    productId: YEARLY_PRODUCT_ID,
  },
  {
    id: "monthly",
    label: "Monthly",
    priceUsd: MONTHLY_PRICE_USD,
    periodLabel: "month",
    billingDays: MONTHLY_BILLING_DAYS,
    productId: MONTHLY_PRODUCT_ID,
  },
];

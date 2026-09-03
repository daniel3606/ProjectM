export const FREE_TIMED_BLOCK_LIMIT = 2;
export const PREMIUM_TIMED_BLOCK_LIMIT = 10;

export const MONTHLY_PRICE_USD = 5.99;
export const YEARLY_PRICE_USD = 24.99;

/** Calendar days used to quote a daily rate on the paywall. */
export const MONTHLY_BILLING_DAYS = 30;
export const YEARLY_BILLING_DAYS = 365;

export type SubscriptionPlanId = "yearly" | "monthly";

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  label: string;
  priceUsd: number;
  /** Shown after the price, e.g. "month" → "$5.99/month". */
  periodLabel: "month" | "year";
  billingDays: number;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: "yearly",
    label: "Yearly",
    priceUsd: YEARLY_PRICE_USD,
    periodLabel: "year",
    billingDays: YEARLY_BILLING_DAYS,
  },
  {
    id: "monthly",
    label: "Monthly",
    priceUsd: MONTHLY_PRICE_USD,
    periodLabel: "month",
    billingDays: MONTHLY_BILLING_DAYS,
  },
];

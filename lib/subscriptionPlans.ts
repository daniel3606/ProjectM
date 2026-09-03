import {
  MONTHLY_PRICE_USD,
  YEARLY_PRICE_USD,
  type SubscriptionPlan,
} from "@/constants/subscription";

/** Rounded cents a plan costs per billing day, for the paywall's daily-rate line. */
export function centsPerDay(priceUsd: number, billingDays: number): number {
  return Math.round((priceUsd / billingDays) * 100);
}

/**
 * How much cheaper a year of Premium is versus twelve monthly payments,
 * rounded to one decimal so the badge can read "41.6% off".
 */
export function yearlySavingsPercent(
  monthlyPriceUsd = MONTHLY_PRICE_USD,
  yearlyPriceUsd = YEARLY_PRICE_USD
): number {
  const yearAtMonthlyRate = monthlyPriceUsd * 12;
  return Math.round((1 - yearlyPriceUsd / yearAtMonthlyRate) * 1000) / 10;
}

export function formatPlanPrice(
  plan: SubscriptionPlan,
  storeDisplayPrice?: string
): string {
  if (storeDisplayPrice) return `${storeDisplayPrice}/${plan.periodLabel}`;
  return `$${plan.priceUsd.toFixed(2)}/${plan.periodLabel}`;
}

export function formatCentsPerDay(plan: SubscriptionPlan): string {
  return `${centsPerDay(plan.priceUsd, plan.billingDays)}¢ per day`;
}

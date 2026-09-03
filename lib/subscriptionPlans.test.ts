import {
  MONTHLY_BILLING_DAYS,
  MONTHLY_PRICE_USD,
  SUBSCRIPTION_PLANS,
  YEARLY_BILLING_DAYS,
  YEARLY_PRICE_USD,
} from "@/constants/subscription";
import {
  centsPerDay,
  formatCentsPerDay,
  formatPlanPrice,
  yearlySavingsPercent,
} from "@/lib/subscriptionPlans";

describe("Premium plan pricing", () => {
  it("quotes yearly as 65.2% off twelve monthly payments so the badge matches the math", () => {
    expect(yearlySavingsPercent()).toBe(65.2);
    expect(yearlySavingsPercent(MONTHLY_PRICE_USD, YEARLY_PRICE_USD)).toBe(65.2);
  });

  it("tells a monthly subscriber they pay 20 cents a day", () => {
    expect(centsPerDay(MONTHLY_PRICE_USD, MONTHLY_BILLING_DAYS)).toBe(20);
  });

  it("tells a yearly subscriber they pay 7 cents a day", () => {
    expect(centsPerDay(YEARLY_PRICE_USD, YEARLY_BILLING_DAYS)).toBe(7);
  });

  it("labels each plan with its billed price and daily rate", () => {
    const yearly = SUBSCRIPTION_PLANS.find((plan) => plan.id === "yearly");
    const monthly = SUBSCRIPTION_PLANS.find((plan) => plan.id === "monthly");

    if (!yearly || !monthly) {
      throw new Error("Yearly and monthly plans must both be defined");
    }

    expect(formatPlanPrice(yearly)).toBe("$24.99/year");
    expect(formatPlanPrice(monthly)).toBe("$5.99/month");
    expect(formatCentsPerDay(yearly)).toBe("7¢ per day");
    expect(formatCentsPerDay(monthly)).toBe("20¢ per day");
  });
});

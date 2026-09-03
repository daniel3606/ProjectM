import {
  MONTHLY_PRODUCT_ID,
  YEARLY_PRODUCT_ID,
} from "@/constants/subscription";
import {
  androidOfferToken,
  appAccountToken,
  buildSubscriptionPurchaseRequest,
  hasPremiumAccess,
  isAlreadyOwnedPurchase,
  isPremiumEntitlement,
  isPremiumProductId,
  isStoreBillingSupported,
  isUserCancelledPurchase,
  premiumEntitlementsFromStore,
  productIdForPlan,
  storeDisplayPrice,
} from "@/lib/storeBilling";

describe("App Store Premium entitlement", () => {
  const now = Date.parse("2026-09-02T12:00:00.000Z");

  it("unlocks Premium when yearly is active and unexpired", () => {
    expect(
      isPremiumEntitlement(
        [
          {
            productId: YEARLY_PRODUCT_ID,
            isActive: true,
            expirationDateIOS: now + 24 * 60 * 60 * 1000,
          },
        ],
        now
      )
    ).toBe(true);
  });

  it("keeps the account free after a lapsed subscription", () => {
    expect(
      isPremiumEntitlement(
        [
          {
            productId: MONTHLY_PRODUCT_ID,
            isActive: true,
            expirationDateIOS: now - 1000,
          },
        ],
        now
      )
    ).toBe(false);
  });

  it("ignores store products that are not Marshmallow Premium", () => {
    expect(
      isPremiumEntitlement([{ productId: "com.other.app.pro", isActive: true }], now)
    ).toBe(false);
    expect(isPremiumProductId(YEARLY_PRODUCT_ID)).toBe(true);
    expect(isPremiumProductId("coins")).toBe(false);
  });

  it("maps the paywall plan to the App Store product id", () => {
    expect(productIdForPlan("yearly")).toBe(YEARLY_PRODUCT_ID);
    expect(productIdForPlan("monthly")).toBe(MONTHLY_PRODUCT_ID);
  });

  it("unlocks Premium from either the store or a complimentary grant", () => {
    expect(hasPremiumAccess(false, false)).toBe(false);
    expect(hasPremiumAccess(true, false)).toBe(true);
    expect(hasPremiumAccess(false, true)).toBe(true);
    expect(hasPremiumAccess(true, true)).toBe(true);
  });

  it("treats only iOS and Android as store billing platforms", () => {
    expect(isStoreBillingSupported("ios")).toBe(true);
    expect(isStoreBillingSupported("android")).toBe(true);
    expect(isStoreBillingSupported("web")).toBe(false);
  });

  it("passes a Supabase user id to StoreKit as the app account token", () => {
    expect(appAccountToken("2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a")).toBe(
      "2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a"
    );
    expect(appAccountToken("not-a-uuid")).toBeUndefined();
    expect(appAccountToken(undefined)).toBeUndefined();
  });

  it("ignores a dismissed Apple pay sheet", () => {
    expect(isUserCancelledPurchase({ code: "user-cancelled" })).toBe(true);
    expect(isUserCancelledPurchase({ code: "sku-not-found" })).toBe(false);
    expect(isUserCancelledPurchase("nope")).toBe(false);
  });

  it("treats an already-owned subscription as a restore, not a failure", () => {
    expect(isAlreadyOwnedPurchase({ code: "already-owned" })).toBe(true);
    expect(isAlreadyOwnedPurchase({ code: "user-cancelled" })).toBe(false);
  });

  it("pulls Play Billing's required offer token off the fetched product", () => {
    expect(
      androidOfferToken({
        platform: "android",
        subscriptionOffers: [{ offerTokenAndroid: "offer-1" }],
      })
    ).toBe("offer-1");
    expect(
      androidOfferToken({
        platform: "ios",
        subscriptionOffers: [{ offerTokenAndroid: "offer-1" }],
      })
    ).toBeUndefined();
  });

  it("uses the store's localized price when the product has loaded", () => {
    expect(
      storeDisplayPrice(
        [{ id: YEARLY_PRODUCT_ID, displayPrice: "$24.99" }],
        "yearly"
      )
    ).toBe("$24.99");
    expect(storeDisplayPrice([], "monthly")).toBeUndefined();
  });

  it("builds a cross-platform subscription purchase request", () => {
    expect(
      buildSubscriptionPurchaseRequest(YEARLY_PRODUCT_ID, {
        appAccountToken: "2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a",
        androidOfferToken: "offer-1",
      })
    ).toEqual({
      type: "subs",
      request: {
        apple: {
          sku: YEARLY_PRODUCT_ID,
          appAccountToken: "2c1a0b8e-4f3d-4a91-9c2e-7b6a5d4c3b2a",
        },
        google: {
          skus: [YEARLY_PRODUCT_ID],
          subscriptionOffers: [{ sku: YEARLY_PRODUCT_ID, offerToken: "offer-1" }],
        },
      },
    });
  });

  it("drops a null iOS expiration so a missing date is not treated as lapsed", () => {
    const [entitlement] = premiumEntitlementsFromStore([
      { productId: YEARLY_PRODUCT_ID, isActive: true, expirationDateIOS: null },
    ]);
    expect(entitlement.expirationDateIOS).toBeUndefined();
    expect(isPremiumEntitlement([entitlement], now)).toBe(true);
  });
});

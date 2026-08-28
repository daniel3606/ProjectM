import { isUserScopedKey } from "@/lib/storage";

describe("isUserScopedKey", () => {
  it("claims the keys that carry one account's progress and identity", () => {
    expect(isUserScopedKey("marshmallow.focusSession.history")).toBe(true);
    expect(isUserScopedKey("marshmallow.focusSession.attempts")).toBe(true);
    expect(isUserScopedKey("marshmallow.profile.name")).toBe(true);
    expect(isUserScopedKey("marshmallow.profile.color")).toBe(true);
    expect(isUserScopedKey("marshmallow.subscription.isPremium")).toBe(true);
    expect(isUserScopedKey("marshmallow.stats.personalBests")).toBe(true);
    expect(isUserScopedKey("marshmallow.timedBlockPlans")).toBe(true);
  });

  it("claims onboarding completion, so the next account sets up its own marshmallow", () => {
    expect(isUserScopedKey("marshmallow.onboarding.completedBy")).toBe(true);
  });

  it("leaves the opening animation flag alone, so it isn't re-paced per account", () => {
    expect(isUserScopedKey("marshmallow.onboarding.seenIntro")).toBe(false);
  });

  it("treats an unrecognized marshmallow key as user data", () => {
    expect(isUserScopedKey("marshmallow.somethingAddedLater")).toBe(true);
  });

  it("never claims another library's keys", () => {
    // Supabase stores the session under its own namespace; clearing it here
    // would sign the user out from under the sign-out we are performing.
    expect(isUserScopedKey("sb-abcdefg-auth-token")).toBe(false);
    expect(isUserScopedKey("expo.notifications.token")).toBe(false);
    expect(isUserScopedKey("marshmallowish.profile.name")).toBe(false);
  });
});

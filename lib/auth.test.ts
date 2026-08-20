/** @jest-environment node */

import {
  avatarUrlFromMetadata,
  displayNameFromMetadata,
  formatAppleDisplayName,
  getAuthStatus,
  getPostAuthRoute,
  isAppleAuthCanceled,
  isDuplicateSignUpUser,
  isEmailVerified,
  isOAuthCallbackCanceled,
  isOAuthCanceled,
  isPublicAuthRoute,
  isValidSignupOtp,
  mapAuthErrorMessage,
  mapSignInError,
  mapSignUpError,
  normalizeEmail,
  sanitizeSignupOtpInput,
  shouldPersistAppleName,
  validateSignInInput,
  validateSignUpInput,
} from "@/lib/auth";
import type { Session, User } from "@supabase/supabase-js";

describe("auth helpers", () => {
  it("detects verified users", () => {
    const verified = {
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
    } as User;

    expect(isEmailVerified(verified)).toBe(true);
    expect(isEmailVerified(null)).toBe(false);
    expect(isEmailVerified({ email_confirmed_at: null } as unknown as User)).toBe(false);
    expect(
      isEmailVerified({
        email_confirmed_at: null,
        confirmed_at: "2026-01-01T00:00:00.000Z",
      } as unknown as User)
    ).toBe(true);
    expect(
      isEmailVerified({
        email_confirmed_at: null,
        identities: [{ identity_data: { email_verified: true } }],
      } as unknown as User)
    ).toBe(true);
    expect(
      isEmailVerified({
        email_confirmed_at: null,
        identities: [{ provider: "google" }],
      } as unknown as User)
    ).toBe(true);
  });

  it("maps auth status for loading, session restore, and verification", () => {
    expect(getAuthStatus({ isLoading: true, session: null, user: null })).toBe("loading");
    expect(getAuthStatus({ isLoading: false, session: null, user: null })).toBe("unauthenticated");
    expect(
      getAuthStatus({
        isLoading: false,
        session: {} as Session,
        user: { email_confirmed_at: null } as unknown as User,
      })
    ).toBe("needs_verification");
    expect(
      getAuthStatus({
        isLoading: false,
        session: {} as Session,
        user: { email_confirmed_at: "2026-01-01T00:00:00.000Z" } as User,
      })
    ).toBe("authenticated");
  });

  it("sends authenticated users to onboarding or home", () => {
    expect(getPostAuthRoute(false)).toBe("/custominit");
    expect(getPostAuthRoute(true)).toBe("/(tabs)");
    expect(isPublicAuthRoute("/")).toBe(true);
    expect(isPublicAuthRoute("/auth/verify")).toBe(true);
    expect(isPublicAuthRoute("/(tabs)")).toBe(false);
  });

  it("normalizes and validates email/password before requests", () => {
    expect(normalizeEmail("  daniel@example.com ")).toBe("daniel@example.com");
    expect(validateSignInInput("not-an-email", "password")).toBe(
      "Please enter a valid email address."
    );
    expect(validateSignInInput("daniel@example.com", "123")).toBe(
      "Password must be at least 6 characters."
    );
    expect(validateSignUpInput("daniel@example.com", "password1", "password2")).toBe(
      "Passwords do not match."
    );
    expect(validateSignUpInput("daniel@example.com", "password1", "password1")).toBeNull();
  });

  it("maps sign-in errors for UX and verification routing", () => {
    expect(mapSignInError("Invalid login credentials")).toEqual({
      error: "Incorrect email or password.",
      needsVerification: false,
    });

    expect(mapSignInError("Email not confirmed")).toEqual({
      error: "Please verify your email before signing in.",
      needsVerification: true,
    });

    expect(mapSignInError("Network request failed")).toEqual({
      error: "Network error. Check your connection and try again.",
      needsVerification: false,
    });
  });

  it("sanitizes and validates signup OTP input", () => {
    expect(sanitizeSignupOtpInput("00 955-659")).toBe("00955659");
    expect(sanitizeSignupOtpInput("00955659999")).toBe("00955659");
    expect(isValidSignupOtp("00955659")).toBe(true);
    expect(isValidSignupOtp("123456")).toBe(true);
    expect(isValidSignupOtp("12345")).toBe(false);
    expect(isValidSignupOtp("123456789")).toBe(false);
  });

  it("maps signup, rate-limit, and email delivery errors for UX", () => {
    expect(mapSignUpError("User already registered")).toBe(
      "That email is already registered. Try logging in instead."
    );

    expect(
      mapAuthErrorMessage(
        'gomail: could not send email 1: 550 "The themarshmallow.app domain is not verified."'
      )
    ).toBe("We couldn't send the verification email right now. Please try again later.");

    expect(mapSignInError("unexpected_failure")).toEqual({
      error: "We couldn't send the verification email right now. Please try again later.",
      needsVerification: false,
    });

    expect(mapAuthErrorMessage("over_email_send_rate_limit")).toBe(
      "Too many attempts. Try again shortly."
    );
    expect(mapAuthErrorMessage("internal postgres boom")).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("treats Apple/OAuth cancellation as a non-error", () => {
    expect(isAppleAuthCanceled({ code: "ERR_REQUEST_CANCELED" })).toBe(true);
    expect(isAppleAuthCanceled({ code: "ERR_CANCELED" })).toBe(true);
    expect(isAppleAuthCanceled({ code: "OTHER" })).toBe(false);
    expect(isOAuthCanceled("cancel")).toBe(true);
    expect(isOAuthCanceled("dismiss")).toBe(true);
    expect(isOAuthCanceled("success")).toBe(false);
    expect(
      isOAuthCallbackCanceled({ error: "access_denied", error_description: "User cancelled" })
    ).toBe(true);
  });

  it("builds Apple display names and refuses empty overwrites", () => {
    expect(
      formatAppleDisplayName({ givenName: "Daniel", familyName: "Lim", middleName: null })
    ).toBe("Daniel Lim");
    expect(formatAppleDisplayName({ givenName: null, familyName: null })).toBeNull();
    expect(shouldPersistAppleName("Daniel Lim", {})).toBe(true);
    expect(shouldPersistAppleName("Daniel Lim", { full_name: "Existing" })).toBe(false);
    expect(shouldPersistAppleName(null, {})).toBe(false);
    expect(displayNameFromMetadata({ name: "Google User" })).toBe("Google User");
    expect(avatarUrlFromMetadata({ picture: "https://example.com/a.png" })).toBe(
      "https://example.com/a.png"
    );
  });

  it("detects duplicate signup users hidden by enumeration protection", () => {
    expect(isDuplicateSignUpUser({ identities: [] } as unknown as User)).toBe(true);
    expect(
      isDuplicateSignUpUser({ identities: [{ identity_id: "1" }] } as unknown as User)
    ).toBe(false);
  });
});

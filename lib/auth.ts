import type { Session, User } from "@supabase/supabase-js";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "needs_verification";

export type SocialAuthResult = {
  error: string | null;
  canceled: boolean;
};

export const MIN_PASSWORD_LENGTH = 6;
export const SIGNUP_OTP_MIN_LENGTH = 6;
export const SIGNUP_OTP_MAX_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AppleFullNameLike {
  namePrefix?: string | null;
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
}

export function isEmailVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.email_confirmed_at) return true;
  if (user.confirmed_at) return true;
  const identities = user.identities ?? [];
  if (identities.some((identity) => identity.provider && identity.provider !== "email")) {
    return true;
  }
  return identities.some((identity) => {
    const verified = identity.identity_data?.email_verified;
    return verified === true || verified === "true";
  });
}

export function getAuthStatus(args: {
  isLoading: boolean;
  session: Session | null;
  user: User | null | undefined;
}): AuthStatus {
  if (args.isLoading) return "loading";
  if (!args.session || !args.user) return "unauthenticated";
  if (!isEmailVerified(args.user)) return "needs_verification";
  return "authenticated";
}

export type AppRoute = "/auth" | "/auth/verify" | "/onboarding" | "/(tabs)";

/**
 * Where a person belongs, given who they are and how far they have got.
 *
 * An account is a gate rather than a step inside the flow: there is no guest
 * mode, so signing in is the first thing that happens and onboarding runs
 * afterwards, only for an account that has not finished it. Returning users
 * therefore go straight to the app and never see onboarding again.
 *
 * Callers must wait for a settled status; "loading" has no route of its own.
 */
export function resolveAppRoute(
  status: Exclude<AuthStatus, "loading">,
  onboardingCompleted: boolean
): AppRoute {
  if (status === "unauthenticated") return "/auth";
  if (status === "needs_verification") return "/auth/verify";
  return onboardingCompleted ? "/(tabs)" : "/onboarding";
}

/** Routes reachable without a session: the entry router and the auth screens. */
export function isPublicAuthRoute(pathname: string): boolean {
  return pathname === "/" || pathname === "/auth" || pathname.startsWith("/auth/");
}

export interface SignInResult {
  error: string | null;
  needsVerification: boolean;
}

/** Supabase email OTP length varies by project config (typically 6–8 digits). */
export function sanitizeSignupOtpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, SIGNUP_OTP_MAX_LENGTH);
}

export function isValidSignupOtp(token: string): boolean {
  const length = token.trim().length;
  return length >= SIGNUP_OTP_MIN_LENGTH && length <= SIGNUP_OTP_MAX_LENGTH;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  if (!email) return "Please enter your email.";
  if (!EMAIL_PATTERN.test(email)) return "Please enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Please enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validateSignInInput(email: string, password: string): string | null {
  return validateEmail(email) ?? validatePassword(password);
}

export function validateSignUpInput(
  email: string,
  password: string,
  confirmPassword?: string
): string | null {
  const inputError = validateSignInInput(email, password);
  if (inputError) return inputError;
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

function isEmailDeliveryConfigurationError(message: string): boolean {
  return (
    message.includes("domain is not verified") ||
    message.includes("could not send email") ||
    message.includes("unexpected_failure")
  );
}

function normalizeErrorText(message: string): string {
  return message.trim().toLowerCase();
}

export function mapAuthErrorMessage(message: string): string {
  const normalized = normalizeErrorText(message);

  if (!normalized) {
    return "Something went wrong. Please try again.";
  }

  if (isEmailDeliveryConfigurationError(normalized)) {
    return "We couldn't send the verification email right now. Please try again later.";
  }

  if (
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network error") ||
    normalized.includes("fetch failed") ||
    normalized.includes("unable to resolve host")
  ) {
    return "Network error. Check your connection and try again.";
  }

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit exceeded") ||
    normalized.includes("for security purposes") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  ) {
    return "Too many attempts. Try again shortly.";
  }

  if (normalized === "invalid login credentials") {
    return "Incorrect email or password.";
  }

  if (normalized === "email not confirmed") {
    return "Please verify your email before signing in.";
  }

  if (normalized === "user already registered") {
    return "That email is already registered. Try logging in instead.";
  }

  if (normalized.includes("password should be at least") || normalized.includes("password is known to be weak")) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (
    normalized.includes("access_denied") ||
    normalized.includes("user cancelled") ||
    normalized.includes("user canceled")
  ) {
    return "Sign-in was cancelled.";
  }

  if (normalized.includes("unable to start google") || normalized.includes("provider is not enabled")) {
    return "This sign-in method is unavailable right now. Please try again later.";
  }

  return "Something went wrong. Please try again.";
}

export function mapUnknownAuthError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return mapAuthErrorMessage(error.message);
  }
  if (typeof error === "string") return mapAuthErrorMessage(error);
  return "Something went wrong. Please try again.";
}

export function mapSignUpError(message: string): string {
  return mapAuthErrorMessage(message);
}

export function mapSignInError(message: string): SignInResult {
  const mapped = mapAuthErrorMessage(message);
  const normalized = normalizeErrorText(message);

  if (normalized === "email not confirmed") {
    return { error: mapped, needsVerification: true };
  }

  return { error: mapped, needsVerification: false };
}

export function isAppleAuthCanceled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED";
}

export function isOAuthCanceled(resultType: string): boolean {
  return resultType === "cancel" || resultType === "dismiss";
}

export function isOAuthCallbackCanceled(params: Record<string, string>): boolean {
  const error = normalizeErrorText(params.error ?? "");
  const description = normalizeErrorText(params.error_description ?? "");
  return (
    error === "access_denied" ||
    description.includes("denied") ||
    description.includes("cancel")
  );
}

export function formatAppleDisplayName(
  fullName: AppleFullNameLike | null | undefined
): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.middleName, fullName.familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const name = parts.join(" ").trim();
  return name.length > 0 ? name : null;
}

export function existingUserDisplayName(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  for (const key of ["full_name", "name", "display_name"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function shouldPersistAppleName(
  appleName: string | null,
  metadata: Record<string, unknown> | null | undefined
): appleName is string {
  return Boolean(appleName) && !existingUserDisplayName(metadata);
}

export function displayNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  return existingUserDisplayName(metadata);
}

export function avatarUrlFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  for (const key of ["avatar_url", "picture"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Detects the fake success Supabase returns for an existing email when enumeration protection is on. */
export function isDuplicateSignUpUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return (user.identities?.length ?? 0) === 0;
}

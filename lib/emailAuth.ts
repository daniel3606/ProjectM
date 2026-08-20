import {
  isDuplicateSignUpUser,
  mapAuthErrorMessage,
  mapSignInError,
  mapSignUpError,
  mapUnknownAuthError,
  normalizeEmail,
  validateSignInInput,
  validateSignUpInput,
  type SignInResult,
} from "@/lib/auth";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";

export interface SignUpResult {
  error: string | null;
  needsConfirmation: boolean;
}

export async function signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
  const normalizedEmail = normalizeEmail(email);
  const validationError = validateSignUpInput(normalizedEmail, password);
  if (validationError) return { error: validationError, needsConfirmation: false };

  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) return { error: mapSignUpError(error.message), needsConfirmation: false };
    if (isDuplicateSignUpUser(data.user)) {
      return {
        error: mapSignUpError("User already registered"),
        needsConfirmation: false,
      };
    }
    return { error: null, needsConfirmation: !data.session };
  } catch (error) {
    return { error: mapUnknownAuthError(error), needsConfirmation: false };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  const normalizedEmail = normalizeEmail(email);
  const validationError = validateSignInInput(normalizedEmail, password);
  if (validationError) return { error: validationError, needsVerification: false };

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) return mapSignInError(error.message);
    return { error: null, needsVerification: false };
  } catch (error) {
    return { error: mapUnknownAuthError(error), needsVerification: false };
  }
}

export async function resendSignupVerificationEmail(email: string): Promise<{ error: string | null }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { error: "Please enter your email." };

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) return { error: mapAuthErrorMessage(error.message) };
    return { error: null };
  } catch (error) {
    return { error: mapUnknownAuthError(error) };
  }
}

export async function verifySignupEmailOtp(
  email: string,
  token: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token,
      type: "signup",
    });
    if (error) return { error: mapAuthErrorMessage(error.message) };
    return { error: null };
  } catch (error) {
    return { error: mapUnknownAuthError(error) };
  }
}

export async function signOutCurrentUser(): Promise<void> {
  await supabase.auth.signOut();
}

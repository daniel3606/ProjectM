import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { signInWithAppleNative } from "@/lib/appleAuth";
import { signInWithGoogleOAuth } from "@/lib/googleAuth";
import { ensureAppProfile } from "@/lib/sync";
import {
  getAuthStatus,
  mapUnknownAuthError,
  type AuthStatus,
  type SignInResult,
  type SocialAuthResult,
} from "@/lib/auth";
import {
  resendSignupVerificationEmail,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  verifySignupEmailOtp,
  type SignUpResult,
} from "@/lib/emailAuth";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthBusy: boolean;
  status: AuthStatus;
  isEmailVerified: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signInWithGoogle: () => Promise<SocialAuthResult>;
  signInWithApple: () => Promise<SocialAuthResult>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ error: string | null }>;
  verifySignupOtp: (email: string, token: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BUSY_SIGN_IN: SignInResult = { error: null, needsVerification: false };
const BUSY_SIGN_UP: SignUpResult = { error: null, needsConfirmation: false };
const BUSY_SOCIAL: SocialAuthResult = { error: null, canceled: true };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const actionLockRef = useRef(false);

  const runExclusive = useCallback(async <T,>(fn: () => Promise<T>, busyValue: T): Promise<T> => {
    if (actionLockRef.current) return busyValue;
    actionLockRef.current = true;
    setIsAuthBusy(true);
    try {
      return await fn();
    } finally {
      actionLockRef.current = false;
      setIsAuthBusy(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) {
          setSession(session);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          setIsLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!cancelled) setSession(nextSession);
      if (nextSession?.user && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        void ensureAppProfile(nextSession.user);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const status = getAuthStatus({ isLoading, session, user });
  const emailVerified = status === "authenticated";

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    return runExclusive(() => signUpWithEmail(email, password), BUSY_SIGN_UP);
  }, [runExclusive]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    return runExclusive(() => signInWithEmail(email, password), BUSY_SIGN_IN);
  }, [runExclusive]);

  const signInWithGoogle = useCallback(async (): Promise<SocialAuthResult> => {
    return runExclusive(async () => {
      try {
        return await signInWithGoogleOAuth();
      } catch (error) {
        return { error: mapUnknownAuthError(error), canceled: false };
      }
    }, BUSY_SOCIAL);
  }, [runExclusive]);

  const signInWithApple = useCallback(async (): Promise<SocialAuthResult> => {
    return runExclusive(async () => {
      try {
        return await signInWithAppleNative();
      } catch (error) {
        return { error: mapUnknownAuthError(error), canceled: false };
      }
    }, BUSY_SOCIAL);
  }, [runExclusive]);

  const resendVerificationEmail = useCallback(async (email: string) => {
    return resendSignupVerificationEmail(email);
  }, []);

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    return verifySignupEmailOtp(email, token);
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrentUser();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      isLoading,
      isAuthBusy,
      status,
      isEmailVerified: emailVerified,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      resendVerificationEmail,
      verifySignupOtp,
    }),
    [
      session,
      user,
      isLoading,
      isAuthBusy,
      status,
      emailVerified,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      resendVerificationEmail,
      verifySignupOtp,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

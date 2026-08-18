import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { AUTH_REDIRECT_URL, createSessionFromUrl, isAuthCallbackUrl } from "@/lib/authRedirect";
import type { Session, User } from "@supabase/supabase-js";

interface SignUpResult {
  error: string | null;
  needsConfirmation: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  confirmSignup: (email: string, token: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url || !isAuthCallbackUrl(url)) return;
      createSessionFromUrl(url).catch(() => {});
    };

    Linking.getInitialURL().then(handleUrl);
    const linking = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => linking.remove();
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    if (error) return { error: error.message, needsConfirmation: false };
    // Supabase returns 200 with no error but also no session when:
    // - Email confirmation is required (new user)
    // - The email already exists (repeated signup)
    // In both cases the user needs to check their email or try signing in.
    const needsConfirmation = !data.session;
    return { error: null, needsConfirmation };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message === "Invalid login credentials") {
        return { error: "Incorrect email or password. Please try again." };
      }
      if (error.message === "Email not confirmed") {
        return { error: "Please check your email and confirm your account before signing in." };
      }
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: AUTH_REDIRECT_URL },
    });
    return { error: error?.message ?? null };
  }, []);

  const confirmSignup = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    return { error: error?.message ?? null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signUp,
      signIn,
      signOut,
      resendConfirmation,
      confirmSignup,
    }),
    [session, isLoading, signUp, signIn, signOut, resendConfirmation, confirmSignup]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

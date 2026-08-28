import * as Linking from "expo-linking";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isOAuthCallbackCanceled, mapAuthErrorMessage } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const AUTH_CALLBACK_PATH = "auth/callback";

/**
 * Deep-link URL Supabase should redirect to after email confirmation or OAuth.
 * Prefer the app scheme so redirects stay stable across Expo Go / release builds
 * and match the Supabase redirect allow list.
 */
export function getAuthRedirectUrl(): string {
  return `marshmallow://${AUTH_CALLBACK_PATH}`;
}

type StringParam = string | string[] | undefined;

function normalizeParam(value: StringParam): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Parse query-string and hash-fragment auth params from a callback URL. */
export function parseAuthCallbackParams(
  url: string,
  fallbackParams: Record<string, StringParam> = {}
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(fallbackParams)) {
    const normalized = normalizeParam(value);
    if (normalized) params[key] = normalized;
  }

  if (!url) return params;

  const parsed = Linking.parse(url);
  if (parsed.queryParams) {
    for (const [key, value] of Object.entries(parsed.queryParams)) {
      const normalized = normalizeParam(value as StringParam);
      if (normalized) params[key] = normalized;
    }
  }

  const hashIndex = url.indexOf("#");
  if (hashIndex !== -1) {
    const hash = url.slice(hashIndex + 1);
    for (const part of hash.split("&")) {
      if (!part) continue;
      const [rawKey, rawValue = ""] = part.split("=");
      const key = decodeURIComponent(rawKey);
      const value = decodeURIComponent(rawValue);
      if (key) params[key] = value;
    }
  }

  return params;
}

export interface AuthCallbackResult {
  error: string | null;
  nextRoute: string | null;
  canceled?: boolean;
}

/** Exchange Supabase callback params for a persisted session. */
export async function completeAuthFromUrl(
  url: string,
  fallbackParams: Record<string, StringParam> = {}
): Promise<AuthCallbackResult> {
  const params = parseAuthCallbackParams(url, fallbackParams);

  if (isOAuthCallbackCanceled(params)) {
    return { error: null, nextRoute: null, canceled: true };
  }

  if (params.error || params.error_description) {
    return {
      error: mapAuthErrorMessage(
        params.error_description ?? params.error ?? "Sign-in failed."
      ),
      nextRoute: null,
    };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      // The mapped message is deliberately vague, which is useless when the
      // exchange is what broke. The code itself is never logged.
      console.warn(`[auth] code exchange failed: ${error.message}`);
      return { error: mapAuthErrorMessage(error.message), nextRoute: null };
    }
    return { error: null, nextRoute: "/" };
  }

  if (params.token_hash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as EmailOtpType,
    });
    if (error) return { error: mapAuthErrorMessage(error.message), nextRoute: null };
    return { error: null, nextRoute: "/" };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) return { error: mapAuthErrorMessage(error.message), nextRoute: null };
    return { error: null, nextRoute: "/" };
  }

  console.warn(`[auth] callback had no usable params; keys=${Object.keys(params).join(",") || "none"}`);
  return { error: "Missing confirmation parameters.", nextRoute: null };
}

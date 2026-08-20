import { supabase } from "@/lib/supabase";

/** Deep link opened after email confirmation / magic links. Must match Redirect URLs in Supabase. */
export const AUTH_REDIRECT_URL = "marshmallow://auth/callback";

function parseAuthCallbackParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");

  const parse = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split("&")) {
      if (!part) continue;
      const eq = part.indexOf("=");
      const key = eq === -1 ? part : part.slice(0, eq);
      const value = eq === -1 ? "" : part.slice(eq + 1);
      try {
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, " "));
      } catch {
        params[key] = value;
      }
    }
  };

  if (queryIndex !== -1) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    parse(url.slice(queryIndex + 1, end));
  }
  if (hashIndex !== -1) {
    parse(url.slice(hashIndex + 1));
  }
  return params;
}

/** Completes auth when the app is opened from a confirmation / magic-link URL. */
export async function createSessionFromUrl(url: string): Promise<{ error: string | null }> {
  const params = parseAuthCallbackParams(url);
  if (params.error) {
    return { error: params.error_description || params.error };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    return { error: error?.message ?? null };
  }

  if (params.token_hash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
    });
    return { error: error?.message ?? null };
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return { error: error?.message ?? null };
  }

  return { error: null };
}

export function isAuthCallbackUrl(url: string): boolean {
  return (
    url.startsWith(AUTH_REDIRECT_URL) ||
    url.includes("access_token=") ||
    url.includes("token_hash=") ||
    /[?&#]code=/.test(url)
  );
}

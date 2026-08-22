import * as WebBrowser from "expo-web-browser";
import { completeAuthFromUrl, getAuthRedirectUrl } from "@/lib/authRedirect";
import { isOAuthCanceled, mapAuthErrorMessage, type SocialAuthResult } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function signInWithGoogleOAuth(): Promise<SocialAuthResult> {
  WebBrowser.maybeCompleteAuthSession();

  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return { error: mapAuthErrorMessage(error.message), canceled: false };
  }

  if (!data.url) {
    return {
      error: "Unable to start Google sign-in. Please try again.",
      canceled: false,
    };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (isOAuthCanceled(result.type)) {
    return { error: null, canceled: true };
  }

  if (result.type !== "success" || !result.url) {
    return {
      error: "Google sign-in did not complete. Please try again.",
      canceled: false,
    };
  }

  const callback = await completeAuthFromUrl(result.url);
  if (callback.canceled) {
    return { error: null, canceled: true };
  }
  if (callback.error) {
    return { error: callback.error, canceled: false };
  }

  return { error: null, canceled: false };
}

import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import {
  formatAppleDisplayName,
  isAppleAuthCanceled,
  mapAuthErrorMessage,
  mapUnknownAuthError,
  shouldPersistAppleName,
  type SocialAuthResult,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";

async function generateRawNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithAppleNative(): Promise<SocialAuthResult> {
  try {
    const rawNonce = await generateRawNonce();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return {
        error: "Apple did not return a sign-in token. Please try again.",
        canceled: false,
      };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      return { error: mapAuthErrorMessage(error.message), canceled: false };
    }

    const appleName = formatAppleDisplayName(credential.fullName);
    if (shouldPersistAppleName(appleName, data.user?.user_metadata)) {
      await supabase.auth.updateUser({
        data: { full_name: appleName },
      });
    }

    return { error: null, canceled: false };
  } catch (error) {
    if (isAppleAuthCanceled(error)) {
      return { error: null, canceled: true };
    }
    return { error: mapUnknownAuthError(error), canceled: false };
  }
}

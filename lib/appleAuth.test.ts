/** @jest-environment node */

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithIdToken: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { isAppleAuthAvailable, signInWithAppleNative } from "@/lib/appleAuth";

const mockSignInAsync = AppleAuthentication.signInAsync as jest.Mock;
const mockIsAvailableAsync = AppleAuthentication.isAvailableAsync as jest.Mock;
const mockSignInWithIdToken = supabase.auth.signInWithIdToken as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockGetRandomBytesAsync = Crypto.getRandomBytesAsync as jest.Mock;
const mockDigestStringAsync = Crypto.digestStringAsync as jest.Mock;

describe("native Apple auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRandomBytesAsync.mockResolvedValue(new Uint8Array(16).fill(1));
    mockDigestStringAsync.mockResolvedValue("hashed-nonce");
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("is available on iOS when the native API reports it", async () => {
    mockIsAvailableAsync.mockResolvedValue(true);
    await expect(isAppleAuthAvailable()).resolves.toBe(true);
  });

  it("signs in with the Apple identity token and stores the first-time name", async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: "apple-id-token",
      fullName: { givenName: "Daniel", familyName: "Lim" },
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null,
    });

    await expect(signInWithAppleNative()).resolves.toEqual({ error: null, canceled: false });

    expect(mockSignInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: "hashed-nonce",
    });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-id-token",
      nonce: "01010101010101010101010101010101",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: "Daniel Lim" } });
  });

  it("does not overwrite an existing name with a missing Apple name", async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: "apple-id-token",
      fullName: null,
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { user_metadata: { full_name: "Existing" } } },
      error: null,
    });

    await expect(signInWithAppleNative()).resolves.toEqual({ error: null, canceled: false });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("treats user cancellation as a non-error", async () => {
    mockSignInAsync.mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });
    await expect(signInWithAppleNative()).resolves.toEqual({ error: null, canceled: true });
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it("surfaces a missing identity token", async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null, fullName: null });
    await expect(signInWithAppleNative()).resolves.toEqual({
      error: "Apple did not return a sign-in token. Please try again.",
      canceled: false,
    });
  });
});

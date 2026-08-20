/** @jest-environment node */

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
    },
  },
}));

jest.mock("@/lib/authRedirect", () => ({
  getAuthRedirectUrl: () => "marshmallow://auth/callback",
  completeAuthFromUrl: jest.fn(),
}));

import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { completeAuthFromUrl } from "@/lib/authRedirect";
import { signInWithGoogleOAuth } from "@/lib/googleAuth";

const mockSignInWithOAuth = supabase.auth.signInWithOAuth as jest.Mock;
const mockOpenAuthSessionAsync = WebBrowser.openAuthSessionAsync as jest.Mock;
const mockCompleteAuthFromUrl = completeAuthFromUrl as jest.Mock;

describe("Google OAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens the Supabase OAuth session and completes the callback", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://supabase.example/authorize" },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "marshmallow://auth/callback?code=abc",
    });
    mockCompleteAuthFromUrl.mockResolvedValue({ error: null, nextRoute: "/" });

    await expect(signInWithGoogleOAuth()).resolves.toEqual({ error: null, canceled: false });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "marshmallow://auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      "https://supabase.example/authorize",
      "marshmallow://auth/callback"
    );
    expect(mockCompleteAuthFromUrl).toHaveBeenCalledWith("marshmallow://auth/callback?code=abc");
  });

  it("treats closing the browser as cancellation", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://supabase.example/authorize" },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({ type: "cancel" });

    await expect(signInWithGoogleOAuth()).resolves.toEqual({ error: null, canceled: true });
    expect(mockCompleteAuthFromUrl).not.toHaveBeenCalled();
  });
});

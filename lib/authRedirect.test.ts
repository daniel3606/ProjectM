/** @jest-environment node */

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      verifyOtp: jest.fn(),
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

jest.mock("expo-linking", () => ({
  createURL: (path: string) => `marshmallow://${path}`,
  parse: (url: string) => {
    const [withoutHash, hash = ""] = url.split("#");
    const queryString = withoutHash.includes("?") ? withoutHash.split("?")[1] : "";
    const queryParams: Record<string, string> = {};

    for (const part of [queryString, hash].filter(Boolean)) {
      for (const segment of part.split("&")) {
        const [key, value = ""] = segment.split("=");
        if (key) queryParams[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    }

    return { queryParams };
  },
}));

import { supabase } from "@/lib/supabase";
import { completeAuthFromUrl, getAuthRedirectUrl, parseAuthCallbackParams } from "@/lib/authRedirect";

const mockVerifyOtp = supabase.auth.verifyOtp as jest.Mock;
const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockExchangeCodeForSession = supabase.auth.exchangeCodeForSession as jest.Mock;

describe("authRedirect", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockSetSession.mockResolvedValue({ error: null });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it("builds the auth callback deep link", () => {
    expect(getAuthRedirectUrl()).toBe("marshmallow://auth/callback");
  });

  it("merges fallback, query, and hash params", () => {
    const params = parseAuthCallbackParams(
      "marshmallow://auth/callback?token_hash=abc&type=signup#access_token=def&refresh_token=ghi",
      { type: "ignored" }
    );

    expect(params.token_hash).toBe("abc");
    expect(params.type).toBe("signup");
    expect(params.access_token).toBe("def");
    expect(params.refresh_token).toBe("ghi");
  });

  it("surfaces auth errors from callback URLs", () => {
    const params = parseAuthCallbackParams(
      "marshmallow://auth/callback?error=access_denied&error_description=Expired",
      {}
    );

    expect(params.error).toBe("access_denied");
    expect(params.error_description).toBe("Expired");
  });

  it("exchanges a PKCE code from a Google OAuth callback", async () => {
    const result = await completeAuthFromUrl("marshmallow://auth/callback?code=oauth-code");
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(result).toEqual({ error: null, nextRoute: "/" });
  });

  it("sets a session from implicit OAuth tokens", async () => {
    const result = await completeAuthFromUrl(
      "marshmallow://auth/callback#access_token=aaa&refresh_token=bbb"
    );
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "aaa",
      refresh_token: "bbb",
    });
    expect(result).toEqual({ error: null, nextRoute: "/" });
  });

  it("verifies email confirmation links", async () => {
    const result = await completeAuthFromUrl(
      "marshmallow://auth/callback?token_hash=hash&type=signup"
    );
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "signup" });
    expect(result).toEqual({ error: null, nextRoute: "/" });
  });

  it("treats OAuth cancellation as canceled rather than an app error", async () => {
    const result = await completeAuthFromUrl(
      "marshmallow://auth/callback?error=access_denied&error_description=User%20cancelled"
    );
    expect(result).toEqual({ error: null, nextRoute: null, canceled: true });
  });
});

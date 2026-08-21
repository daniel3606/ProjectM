/** @jest-environment node */

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resend: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock("@/lib/authRedirect", () => ({
  getAuthRedirectUrl: () => "marshmallow://auth/callback",
}));

import {
    resendSignupVerificationEmail,
    signInWithEmail,
    signOutCurrentUser,
    signUpWithEmail,
} from "@/lib/emailAuth";
import { supabase } from "@/lib/supabase";

const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockResend = supabase.auth.resend as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;

describe("email auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signs up and waits for verification when no session is returned", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { identities: [{ id: "1" }] }, session: null },
      error: null,
    });

    await expect(signUpWithEmail("  daniel@example.com ", "password123")).resolves.toEqual({
      error: null,
      needsConfirmation: true,
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "daniel@example.com",
      password: "password123",
      options: { emailRedirectTo: "marshmallow://auth/callback" },
    });
  });

  it("treats a fully authenticated signup as complete", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { identities: [{ id: "1" }] }, session: { access_token: "tok" } },
      error: null,
    });

    await expect(signUpWithEmail("daniel@example.com", "password123")).resolves.toEqual({
      error: null,
      needsConfirmation: false,
    });
  });

  it("signs in with a normalized email", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    await expect(signInWithEmail("  daniel@example.com ", "password123")).resolves.toEqual({
      error: null,
      needsVerification: false,
    });
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "daniel@example.com",
      password: "password123",
    });
  });

  it("maps invalid login credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    await expect(signInWithEmail("daniel@example.com", "password123")).resolves.toEqual({
      error: "Incorrect email or password.",
      needsVerification: false,
    });
  });

  it("resends signup verification mail", async () => {
    mockResend.mockResolvedValue({ error: null });
    await expect(resendSignupVerificationEmail("daniel@example.com")).resolves.toEqual({
      error: null,
    });
    expect(mockResend).toHaveBeenCalledWith({
      type: "signup",
      email: "daniel@example.com",
      options: { emailRedirectTo: "marshmallow://auth/callback" },
    });
  });

  it("maps resend rate limits", async () => {
    mockResend.mockResolvedValue({ error: { message: "over_email_send_rate_limit" } });
    await expect(resendSignupVerificationEmail("daniel@example.com")).resolves.toEqual({
      error: "Too many attempts. Try again shortly.",
    });
  });

  it("signs out through Supabase", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    await signOutCurrentUser();
    expect(mockSignOut).toHaveBeenCalled();
  });
});

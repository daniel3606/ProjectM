"use server";

import { sanitizeSource } from "@/lib/source";
import { getSupabase } from "@/lib/supabase";

export type WaitlistResult =
  | { status: "success" }
  | { status: "exists" }
  | { status: "invalid" }
  | { status: "error" };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function joinWaitlist(
  emailInput: string,
  sourceInput?: string | null,
): Promise<WaitlistResult> {
  const email = normalizeEmail(emailInput);

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { status: "invalid" };
  }

  const source = sanitizeSource(sourceInput);

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("waitlist").insert({ email, source });

    if (!error) {
      return { status: "success" };
    }

    // Unique violation — already on the list.
    if (error.code === "23505") {
      return { status: "exists" };
    }

    console.error("Waitlist insert failed:", error.code, error.message);
    return { status: "error" };
  } catch (err) {
    console.error("Waitlist insert exception:", err);
    return { status: "error" };
  }
}

import { supabase } from "@/lib/supabase";

/**
 * Asks the server whether this account has an active complimentary (or
 * otherwise server-side) Premium row. Callers must not treat a network error
 * as entitled — fail closed.
 */
export async function fetchRemotePremium(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_premium", {
      check_user_id: userId,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

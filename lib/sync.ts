import type { User } from "@supabase/supabase-js";
import { avatarUrlFromMetadata, displayNameFromMetadata } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { CompletedSession } from "@/contexts/FocusSessionContext";
import type { EquippedItems } from "@/constants/items";
import type { Database } from "@/types/supabase";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/** Returns the current auth user id, or null if not logged in. */
async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Push display_name, marshmallow_color, and equipped_items to profiles. */
export async function syncProfile(
  name: string,
  color: string,
  items?: EquippedItems,
): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;

  const update: ProfileUpdate = {
    display_name: name,
    marshmallow_color: color,
  };
  if (items !== undefined) {
    update.equipped_items = items;
  }

  await supabase.from("profiles").update(update).eq("id", userId);
}

/** Push only equipped_items to profiles. */
export async function syncEquippedItems(items: EquippedItems): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;

  await supabase
    .from("profiles")
    .update({ equipped_items: items })
    .eq("id", userId);
}

/** Push a completed focus session and update aggregate stats. */
export async function syncCompletedSession(session: CompletedSession): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;

  await supabase.from("focus_sessions").insert({
    user_id: userId,
    duration_minutes: session.durationMinutes,
    focus_mode: session.focusMode,
    // `growth_cm` is the awarded figure — what the marshmallow actually gained.
    growth_cm: session.awardedGrowthCm ?? session.expectedGrowthCm,
    raw_growth_cm: session.rawGrowthCm ?? null,
    block_type: session.blockType ?? null,
    is_hard_block: !!session.isHardMode,
    completed_at: new Date(session.completedAt).toISOString(),
  });

  await updateProfileStats(userId);
}

/** Recalculate and store aggregate stats on the profile. */
async function updateProfileStats(userId: string): Promise<void> {
  const { data } = await supabase
    .from("focus_sessions")
    .select("duration_minutes, growth_cm")
    .eq("user_id", userId);

  if (!data || data.length === 0) return;

  const totalMinutes = data.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalGrowth = data.reduce((sum, s) => sum + Number(s.growth_cm), 0);

  await supabase
    .from("profiles")
    .update({
      total_focus_minutes: totalMinutes,
      total_growth_cm: Math.round(totalGrowth * 10) / 10,
    })
    .eq("id", userId);
}

/** Fetch the remote profile (for hydrating local state on login). */
export async function fetchRemoteProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/**
 * Fill empty profile fields from auth metadata after social/email signup.
 * Does not overwrite marshmallow display_name, email, or avatar once set.
 */
export async function ensureAppProfile(user: User): Promise<void> {
  let remote = await fetchRemoteProfile(user.id);
  if (!remote) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    remote = await fetchRemoteProfile(user.id);
  }
  if (!remote) return;

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const update: ProfileUpdate = {};
  if (!remote.email && user.email) update.email = user.email;

  const avatarUrl = avatarUrlFromMetadata(metadata);
  if (!remote.avatar_url && avatarUrl) update.avatar_url = avatarUrl;

  const displayName = displayNameFromMetadata(metadata);
  if (!remote.display_name && displayName) update.display_name = displayName;

  if (Object.keys(update).length === 0) return;
  await supabase.from("profiles").update(update).eq("id", user.id);
}

/** What the onboarding flow learned about the user, pushed once at completion. */
export interface OnboardingAnswers {
  goals?: string[];
  currentScreenTimeMinutes?: number | null;
  targetScreenTimeMinutes?: number | null;
}

/**
 * Persist onboarding answers and/or completion onto the profile.
 *
 * Called once, when onboarding finishes — partial answers stay on the device
 * until then, so an abandoned flow leaves no half-formed preferences behind.
 *
 * Unlike the other writes here, this one reports whether it landed. Completion
 * is the fact that decides whether someone is ever asked to set the app up
 * again, and a write that fails quietly turns that into a loop.
 */
export async function syncOnboarding(
  update: OnboardingAnswers & { completed?: boolean }
): Promise<{ error: string | null }> {
  const userId = await getAuthUserId();
  if (!userId) return { error: "No signed-in account to save onboarding to." };

  const payload: ProfileUpdate = {};
  if (update.goals !== undefined) {
    payload.onboarding_goals = update.goals;
    // Legacy single-purpose column, kept readable for anything still reading it.
    payload.onboarding_purpose = update.goals[0] ?? null;
  }
  if (update.currentScreenTimeMinutes !== undefined) {
    payload.onboarding_current_minutes = update.currentScreenTimeMinutes;
    payload.onboarding_screen_time =
      update.currentScreenTimeMinutes === null
        ? null
        : String(update.currentScreenTimeMinutes);
  }
  if (update.targetScreenTimeMinutes !== undefined) {
    payload.onboarding_target_minutes = update.targetScreenTimeMinutes;
  }
  if (update.completed !== undefined) payload.onboarding_completed = update.completed;
  if (Object.keys(payload).length === 0) return { error: null };

  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) console.warn(`[sync] onboarding write failed: ${error.message}`);
  return { error: error?.message ?? null };
}

/** Fetch completed sessions from Supabase (for hydrating local history on login). */
export async function fetchRemoteSessions(userId: string): Promise<CompletedSession[]> {
  const { data } = await supabase
    .from("focus_sessions")
    .select(
      "duration_minutes, focus_mode, growth_cm, raw_growth_cm, block_type, is_hard_block, completed_at"
    )
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return [];

  return data.map((row) => ({
    durationMinutes: row.duration_minutes,
    focusMode: row.focus_mode as CompletedSession["focusMode"],
    expectedGrowthCm: Number(row.growth_cm),
    awardedGrowthCm: Number(row.growth_cm),
    // Null on rows written before the growth model. Left undefined so the daily
    // soft cap treats them as contributing no raw growth rather than guessing.
    rawGrowthCm: row.raw_growth_cm == null ? undefined : Number(row.raw_growth_cm),
    blockType: (row.block_type as CompletedSession["blockType"]) ?? undefined,
    isHardMode: !!row.is_hard_block,
    completedAt: new Date(row.completed_at).getTime(),
  }));
}

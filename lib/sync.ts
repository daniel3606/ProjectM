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
    growth_cm: session.expectedGrowthCm,
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
    .single();
  return data;
}

/** Persist onboarding answers and/or completion onto the profile. */
export async function syncOnboarding(update: {
  purpose?: string | null;
  screenTime?: string | null;
  completed?: boolean;
}): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;

  const payload: ProfileUpdate = {};
  if (update.purpose !== undefined) payload.onboarding_purpose = update.purpose;
  if (update.screenTime !== undefined) payload.onboarding_screen_time = update.screenTime;
  if (update.completed !== undefined) payload.onboarding_completed = update.completed;
  if (Object.keys(payload).length === 0) return;

  await supabase.from("profiles").update(payload).eq("id", userId);
}

/** Fetch completed sessions from Supabase (for hydrating local history on login). */
export async function fetchRemoteSessions(userId: string): Promise<CompletedSession[]> {
  const { data } = await supabase
    .from("focus_sessions")
    .select("duration_minutes, focus_mode, growth_cm, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return [];

  return data.map((row) => ({
    durationMinutes: row.duration_minutes,
    focusMode: row.focus_mode as CompletedSession["focusMode"],
    expectedGrowthCm: Number(row.growth_cm),
    completedAt: new Date(row.completed_at).getTime(),
  }));
}

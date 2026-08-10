import { supabase } from "@/lib/supabase";
import type { CompletedSession } from "@/contexts/FocusSessionContext";

/** Returns the current auth user id, or null if not logged in. */
async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Push display_name and marshmallow_color to the profiles table. */
export async function syncProfile(name: string, color: string): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;

  await supabase
    .from("profiles")
    .update({ display_name: name, marshmallow_color: color })
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

/** Fetch the remote profile and return it (for hydrating local state on login). */
export async function fetchRemoteProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

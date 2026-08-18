import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Requests local notification permission. Safe to call repeatedly. */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS !== "ios") return true;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function notify(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {
    // Notifications are best-effort — a failure here shouldn't affect blocking.
  }
}

export function notifyBlockStarted(label: string) {
  return notify("Timed Block Started", `"${label}" is now blocking your apps.`);
}

export function notifyBlockEnded(label?: string, growthCm?: number) {
  const growthText = growthCm ? ` Your marshmallow grew +${growthCm}cm!` : "";
  return notify(
    "Block Ended",
    label
      ? `"${label}" has ended.${growthText} Apps are unblocked.`
      : `Your focus session has ended.${growthText} Apps are unblocked.`
  );
}

/**
 * Schedules a future local notification for when a block ends, so the user
 * is notified even if the app has been killed or backgrounded.
 */
export async function scheduleBlockEndNotification(
  endsAt: number,
  growthCm: number,
  label?: string
): Promise<string | null> {
  const seconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
  const growthText = ` Your marshmallow grew +${growthCm}cm!`;
  const body = label
    ? `"${label}" has ended.${growthText} Apps are unblocked.`
    : `Your focus session has ended.${growthText} Apps are unblocked.`;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: "Block Ended", body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    });
  } catch {
    return null;
  }
}

export async function cancelBlockEndNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Best-effort cancellation.
  }
}

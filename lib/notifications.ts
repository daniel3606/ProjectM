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

export function notifyBlockEnded(label?: string) {
  return notify(
    "Block Ended",
    label ? `"${label}" has ended. Apps are unblocked.` : "Your focus session has ended. Apps are unblocked."
  );
}

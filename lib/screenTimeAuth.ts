import { Alert } from "react-native";
import * as ScreenTime from "@/modules/screen-time";

/**
 * Checks Screen Time availability/authorization, prompting the user to grant
 * access if needed. Returns true only if blocking can proceed.
 */
export async function ensureScreenTimeAuthorized(): Promise<boolean> {
  if (!ScreenTime.isAvailable()) {
    Alert.alert("Not Available", "Screen Time features require iOS 16 or later.");
    return false;
  }

  const status = ScreenTime.getAuthorizationStatus();
  if (status === "denied") {
    Alert.alert(
      "Permission Denied",
      "Screen Time access was denied. Please enable it in Settings > Screen Time."
    );
    return false;
  }

  if (status === "notDetermined") {
    try {
      const granted = await ScreenTime.requestAuthorization();
      if (!granted) return false;
    } catch {
      Alert.alert("Error", "Failed to request Screen Time authorization.");
      return false;
    }
  }

  return true;
}

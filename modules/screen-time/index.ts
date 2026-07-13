import { Platform } from "react-native";

export type AuthorizationStatus =
  | "notDetermined"
  | "denied"
  | "approved"
  | "unavailable"
  | "unknown";

export interface ScreenTimeItem {
  id: string;
  type: "application" | "category" | "webDomain";
  label: string;
  index: number;
}

// ─────────────────────────────────────────────────────────────────────────
// MOCK MODE
// The native Swift blocking module (FamilyControls) is disabled while we
// iterate on UI. Every function below is faked in JS so screens work
// without a native rebuild or a Screen Time entitlement.
//
// To reconnect the real blocking module: set MOCK_MODE to false. The
// native module is untouched at modules/screen-time/ios/ScreenTimeModule.swift.
// ─────────────────────────────────────────────────────────────────────────
const MOCK_MODE = true;

const MOCK_ITEMS: ScreenTimeItem[] = [
  { id: "app_0", type: "application", label: "Instagram", index: 0 },
  { id: "app_1", type: "application", label: "TikTok", index: 1 },
  { id: "cat_0", type: "category", label: "Games", index: 0 },
];

let mockAuthStatus: AuthorizationStatus = "notDetermined";
let mockSelection: ScreenTimeItem[] = [];

function getNativeModule() {
  // Required lazily so importing this file never touches the native
  // module while MOCK_MODE is on.
  return require("./src/ScreenTimeModule").default;
}

export function isAvailable(): boolean {
  if (MOCK_MODE) return true;
  if (Platform.OS !== "ios") return false;
  return getNativeModule().isAvailable();
}

export function getAuthorizationStatus(): AuthorizationStatus {
  if (MOCK_MODE) return mockAuthStatus;
  if (Platform.OS !== "ios") return "unavailable";
  return getNativeModule().getAuthorizationStatus() as AuthorizationStatus;
}

export async function requestAuthorization(): Promise<boolean> {
  if (MOCK_MODE) {
    mockAuthStatus = "approved";
    return true;
  }
  return await getNativeModule().requestAuthorization();
}

export async function openAppPicker(): Promise<ScreenTimeItem[] | null> {
  if (MOCK_MODE) {
    mockSelection = MOCK_ITEMS;
    return mockSelection;
  }
  return await getNativeModule().openAppPicker();
}

export async function getSelectedItems(): Promise<ScreenTimeItem[]> {
  if (MOCK_MODE) return mockSelection;
  return await getNativeModule().getSelectedItems();
}

export async function blockAll(): Promise<void> {
  if (MOCK_MODE) return;
  await getNativeModule().blockAll();
}

export async function applyBlocking(itemIds: string[]): Promise<void> {
  if (MOCK_MODE) return;
  await getNativeModule().applyBlocking(itemIds);
}

export async function clearBlocking(): Promise<void> {
  if (MOCK_MODE) return;
  await getNativeModule().clearBlocking();
}

export async function clearSelection(): Promise<void> {
  if (MOCK_MODE) {
    mockSelection = [];
    return;
  }
  await getNativeModule().clearSelection();
}

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

/** Minimal, JSON-serializable shape of a Timed Block plan for the native side. */
export interface NativeSchedulablePlan {
  id: string;
  label: string;
  daysOfWeek: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  appIds: string[];
}

export interface ActiveNativeBlock {
  planId: string;
  startedAt: number;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────
// MOCK MODE
// When true, every function below is faked in JS so screens work without a
// native rebuild or a Screen Time entitlement. Native blocking (FamilyControls
// + ManagedSettings) lives at modules/screen-time/ios/ScreenTimeModule.swift.
// ─────────────────────────────────────────────────────────────────────────
const MOCK_MODE = false;

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

/**
 * Registers OS-level monitoring (DeviceActivityCenter) for every enabled
 * plan, via the TimedBlockMonitor extension — this is what lets a Timed
 * Block start/end even when the app isn't running. Replaces any previously
 * registered schedule; call with the full current plan list every time.
 */
export async function scheduleTimedBlocks(plans: NativeSchedulablePlan[]): Promise<void> {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  await getNativeModule().scheduleTimedBlocks(plans);
}

export async function clearScheduledBlocks(): Promise<void> {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  await getNativeModule().clearScheduledBlocks();
}

/**
 * Returns the plan the TimedBlockMonitor extension started while the app
 * wasn't running, if any — used to reconcile FocusSessionContext after a
 * cold launch. Resolves null if no native-triggered block is active.
 */
export async function getActiveNativeBlock(): Promise<ActiveNativeBlock | null> {
  if (MOCK_MODE || Platform.OS !== "ios") return null;
  const result = await getNativeModule().getActiveNativeBlock();
  return result ?? null;
}

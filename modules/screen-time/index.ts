import { Platform } from "react-native";
import type { FocusMode } from "@/constants/marshmallow";

export { default as ScreenTimeTokenLabel } from "./src/ScreenTimeTokenLabel";
export type { ScreenTimeTokenLabelProps } from "./src/ScreenTimeTokenLabel";

export type AuthorizationStatus =
  | "notDetermined"
  | "denied"
  | "approved"
  | "unavailable"
  | "unknown";

/**
 * How a block reads its item list: "block" shields exactly those items,
 * "allowOnly" shields everything except them.
 */
export type BlockMode = "block" | "allowOnly";

export interface ScreenTimeItem {
  id: string;
  type: "application" | "category" | "webDomain";
  /**
   * Generic fallback text ("App 1"). iOS never exposes an app's real name as
   * data, so anything user-facing should render <ScreenTimeTokenLabel> and
   * fall back to this only when `token` is missing.
   */
  label: string;
  index: number;
  /**
   * Opaque, encoded FamilyControls token. Meaningless to JS, but handing it to
   * <ScreenTimeTokenLabel> draws the item's real name and icon. Absent on
   * items persisted before tokens were stored.
   */
  token?: string;
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
  durationMinutes: number;
  appIds: string[];
  /** Growth this plan pays out on completion, so the widget can preview it for extension-started blocks. */
  expectedGrowthCm: number;
  /** Shown on the Live Activity the monitor extension raises for this plan. */
  focusMode: FocusMode;
}

export interface ActiveNativeBlock {
  planId: string;
  startedAt: number;
  durationMinutes: number;
  label: string;
}

/** Mirrors FocusSessionContext's activeSession into the App Group for the MarshmallowWidget extension. */
export interface NativeActiveBlockUpdate {
  /** Absent for a Quick Block (no plan). */
  planId?: string;
  startedAt: number;
  durationMinutes: number;
  label: string;
  /** Growth awarded if this block runs to completion; shown as a pending "+x.x" on the widget. */
  expectedGrowthCm: number;
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

/**
 * Inverse of `applyBlocking`: shields every app category and web domain
 * *except* the ones named, leaving those as the only things still reachable.
 * A no-op guard lives on the caller — allow-only with an empty list would
 * shield the whole device.
 */
export async function applyAllowOnly(itemIds: string[]): Promise<void> {
  if (MOCK_MODE) return;
  await getNativeModule().applyAllowOnly(itemIds);
}

/** Applies `itemIds` under whichever policy `mode` names. */
export async function applyBlockMode(mode: BlockMode, itemIds: string[]): Promise<void> {
  if (mode === "allowOnly") {
    await applyAllowOnly(itemIds);
    return;
  }
  if (itemIds.length > 0) {
    await applyBlocking(itemIds);
    return;
  }
  await blockAll();
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

/**
 * Clears the active native block state written by the extension, so stale
 * shared state doesn't cause phantom re-adoption on next app open.
 */
export async function clearActiveNativeBlock(): Promise<void> {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  await getNativeModule().clearActiveNativeBlock();
}

/**
 * Mirrors the currently running block (Quick or Timed) into the App Group,
 * so the MarshmallowWidget extension can show a remaining-time countdown
 * without the app running.
 */
export async function setActiveNativeBlock(block: NativeActiveBlockUpdate): Promise<void> {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  await getNativeModule().setActiveNativeBlock(block);
}

/** Keeps the widget's marshmallow size in sync with the app's history-derived size. */
export function setMarshmallowSizeCm(sizeCm: number): void {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  getNativeModule().setMarshmallowSizeCm(sizeCm);
}

/** Keeps the widget's marshmallow color in sync with the user's chosen color. */
export function setMarshmallowColorHex(hex: string): void {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  getNativeModule().setMarshmallowColorHex(hex);
}

/**
 * Keeps the name in sync for the shield extension, which addresses the
 * marshmallow by name when it stands in front of a blocked app.
 */
export function setMarshmallowName(name: string): void {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  getNativeModule().setMarshmallowName(name);
}

/** Keeps the widget's equipped items in sync, as already-resolved slot -> emoji pairs. */
export function setMarshmallowItems(items: Record<string, string>): void {
  if (MOCK_MODE || Platform.OS !== "ios") return;
  getNativeModule().setMarshmallowItems(items);
}

export interface BlockLiveActivityParams {
  startedAt: number;
  durationMinutes: number;
  label?: string;
  focusMode?: FocusMode;
}

/**
 * Shows the Lock Screen / Dynamic Island Live Activity for the running block.
 * Used for both Quick Blocks and scheduled blocks. The TimedBlockMonitor
 * extension raises the same activity when it starts a block while the app is
 * killed, so calling this on adoption leaves that one in place rather than
 * restarting it.
 */
export async function startBlockLiveActivity(
  params: BlockLiveActivityParams
): Promise<boolean> {
  if (MOCK_MODE) return false;
  if (Platform.OS !== "ios") return false;
  return await getNativeModule().startBlockLiveActivity(params);
}

export async function endBlockLiveActivity(): Promise<void> {
  if (MOCK_MODE) return;
  if (Platform.OS !== "ios") return;
  await getNativeModule().endBlockLiveActivity();
}

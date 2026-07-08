import { Platform } from "react-native";
import ScreenTimeModule from "./src/ScreenTimeModule";

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

export function isAvailable(): boolean {
  if (Platform.OS !== "ios") return false;
  return ScreenTimeModule.isAvailable();
}

export function getAuthorizationStatus(): AuthorizationStatus {
  if (Platform.OS !== "ios") return "unavailable";
  return ScreenTimeModule.getAuthorizationStatus() as AuthorizationStatus;
}

export async function requestAuthorization(): Promise<boolean> {
  return await ScreenTimeModule.requestAuthorization();
}

export async function openAppPicker(): Promise<ScreenTimeItem[] | null> {
  return await ScreenTimeModule.openAppPicker();
}

export async function getSelectedItems(): Promise<ScreenTimeItem[]> {
  return await ScreenTimeModule.getSelectedItems();
}

export async function blockAll(): Promise<void> {
  await ScreenTimeModule.blockAll();
}

export async function applyBlocking(itemIds: string[]): Promise<void> {
  await ScreenTimeModule.applyBlocking(itemIds);
}

export async function clearBlocking(): Promise<void> {
  await ScreenTimeModule.clearBlocking();
}

export async function clearSelection(): Promise<void> {
  await ScreenTimeModule.clearSelection();
}

import React from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

import type { ScreenTimeItem } from "..";

/** The subset of an item the native side needs to draw it. */
export interface TokenItemInput {
  id: string;
  type: ScreenTimeItem["type"];
  token: string;
  /** Suggested strip only: whether it is already in the selection. */
  added?: boolean;
}

interface TokenIdEvent {
  nativeEvent: { id: string };
}

interface SelectionListNativeProps {
  items: TokenItemInput[];
  rowHeight: number;
  iconSize: number;
  fontSize: number;
  dividerInset: number;
  textColor: string;
  dividerColor: string;
  removeBackground: string;
  removeTint: string;
  onRemove: (event: TokenIdEvent) => void;
  style?: StyleProp<ViewStyle>;
  onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
}

interface SuggestedListNativeProps {
  items: TokenItemInput[];
  iconSize: number;
  onToggle: (event: TokenIdEvent) => void;
  style?: StyleProp<ViewStyle>;
}

interface TokenIconNativeProps {
  item: TokenItemInput;
  size: number;
  cornerRadius: number;
  style?: StyleProp<ViewStyle>;
}

interface UsageReportNativeProps {
  /** Scene registered by the MarshmallowUsageReport extension. */
  reportContext: string;
  /** Left edge of the filter: the start of the comparison window, in ms. */
  startMs: number;
  /** Right edge of the filter: the end of the shown window, in ms. */
  endMs: number;
  /** Where the comparison window ends and the shown one begins, in ms. */
  boundaryMs: number;
  /** How finely the filter is segmented; scales with the window's length. */
  segment: "hourly" | "daily" | "weekly";
  style?: StyleProp<ViewStyle>;
}

// The views only exist in a native build carrying the ScreenTime module, so
// resolve them defensively — Expo warns and rendering throws when a view config
// is missing, as on an older dev client.
function loadNativeView<Props>(viewName: string): React.ComponentType<Props> | null {
  if (Platform.OS !== "ios") return null;
  try {
    const expoGlobal = (globalThis as {
      expo?: { getViewConfig?: (moduleName: string, viewName?: string) => unknown };
    }).expo;
    if (!expoGlobal?.getViewConfig?.("ScreenTimeModule", viewName)) return null;
    return requireNativeViewManager("ScreenTimeModule", viewName);
  } catch {
    return null;
  }
}

// Resolved on first render rather than at import, so pulling in the module
// index never reaches for anything native on its own.
let selectionList: React.ComponentType<SelectionListNativeProps> | null | undefined;
let suggestedList: React.ComponentType<SuggestedListNativeProps> | null | undefined;
let tokenIcon: React.ComponentType<TokenIconNativeProps> | null | undefined;
let usageReport: React.ComponentType<UsageReportNativeProps> | null | undefined;

export function getSelectionListView() {
  if (selectionList === undefined) {
    selectionList = loadNativeView<SelectionListNativeProps>("ScreenTimeSelectionListView");
  }
  return selectionList;
}

export function getSuggestedListView() {
  if (suggestedList === undefined) {
    suggestedList = loadNativeView<SuggestedListNativeProps>("ScreenTimeSuggestedListView");
  }
  return suggestedList;
}

/** Draws one app's icon on its own. Null on a build without the module. */
export function getTokenIconView() {
  if (tokenIcon === undefined) {
    tokenIcon = loadNativeView<TokenIconNativeProps>("ScreenTimeTokenIconView");
  }
  return tokenIcon;
}

/**
 * Draws a DeviceActivityReport scene. Null on a build without the module, and
 * on anything that isn't iOS 16+ — real usage figures exist nowhere else.
 */
export function getUsageReportView() {
  if (usageReport === undefined) {
    usageReport = loadNativeView<UsageReportNativeProps>("ScreenTimeUsageReportView");
  }
  return usageReport;
}

/** True when this build can draw Screen Time selections natively. */
export function hasNativeLists(): boolean {
  return getSelectionListView() !== null && getSuggestedListView() !== null;
}

export type {
  SelectionListNativeProps,
  SuggestedListNativeProps,
  TokenIconNativeProps,
  TokenIdEvent,
  UsageReportNativeProps,
};

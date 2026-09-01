import React from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";

import type { ScreenTimeItem } from "..";

type TokenLabelMode = "icon" | "name" | "both";

interface NativeProps {
  token?: string;
  itemType: ScreenTimeItem["type"];
  mode: TokenLabelMode;
  fontSize: number;
  color: string;
  maxWidth: number;
  style?: StyleProp<ViewStyle>;
}

// The view only exists in a native build that has the ScreenTime module in it,
// so resolve it defensively — Expo logs a warning and rendering throws if the
// view config is missing (an older dev client, say).
function loadNativeView(): React.ComponentType<NativeProps> | null {
  if (Platform.OS !== "ios") return null;
  try {
    const expoGlobal = (globalThis as {
      expo?: { getViewConfig?: (moduleName: string, viewName?: string) => unknown };
    }).expo;
    if (!expoGlobal?.getViewConfig?.("ScreenTimeModule", "ScreenTimeTokenLabelView")) {
      return null;
    }
    return requireNativeViewManager("ScreenTimeModule", "ScreenTimeTokenLabelView");
  } catch {
    return null;
  }
}

// Resolved on first render rather than at import, so pulling in the module
// index never reaches for anything native on its own.
let nativeView: React.ComponentType<NativeProps> | null | undefined;

function getNativeView(): React.ComponentType<NativeProps> | null {
  if (nativeView === undefined) nativeView = loadNativeView();
  return nativeView;
}

export interface ScreenTimeTokenLabelProps {
  /** The item to draw. Items picked before tokens were stored have no token. */
  item: Pick<ScreenTimeItem, "type" | "token">;
  /** "icon" and "name" draw one half of the label; "both" draws them inline. */
  mode?: TokenLabelMode;
  /** Drives the text size, and the icon size along with it. */
  fontSize?: number;
  color?: string;
  /** The name truncates past this; the view sizes itself to its content below it. */
  maxWidth?: number;
  /** Drawn instead when there is no token to resolve, or off iOS. */
  fallback?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shows the real name and icon of one app, category or website in a Screen
 * Time selection.
 *
 * Their tokens are opaque — iOS never hands the app a name or an icon it could
 * send over the bridge, so this is a native view that renders the system's own
 * label and reports its measured size back to React Native, which lets it be
 * laid out like any other self-sizing element.
 */
export default function ScreenTimeTokenLabel({
  item,
  mode = "both",
  fontSize = 15,
  color = "#000000",
  maxWidth = 240,
  fallback = null,
  style,
}: ScreenTimeTokenLabelProps) {
  const NativeTokenLabel = getNativeView();
  if (!NativeTokenLabel || !item.token) return <>{fallback}</>;

  return (
    <NativeTokenLabel
      token={item.token}
      itemType={item.type}
      mode={mode}
      fontSize={fontSize}
      color={color}
      maxWidth={maxWidth}
      style={style}
    />
  );
}

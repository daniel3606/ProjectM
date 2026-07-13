import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";

interface BaseScreenProps {
  /** Adds the top safe-area inset as paddingTop. Pass a number to add extra px on top of that. Default true. */
  topInset?: boolean | number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

interface StaticScreenProps extends BaseScreenProps, Omit<ViewProps, "style" | "children"> {
  scroll?: false;
}

interface ScrollScreenProps
  extends BaseScreenProps,
    Omit<ScrollViewProps, "style" | "children" | "contentContainerStyle"> {
  scroll: true;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

type ScreenProps = StaticScreenProps | ScrollScreenProps;

/**
 * Full-bleed background + safe-area-aware screen container.
 * Pass `scroll` to get a ScrollView with the app's standard content padding
 * (matches the `screen`/`scrollContent` pair duplicated across every tab screen).
 */
export default function Screen({ topInset = true, style, children, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const extra = typeof topInset === "number" ? topInset : 0;
  const paddingTop = topInset === false ? 0 : insets.top + extra;

  if (rest.scroll) {
    const { scroll: _scroll, contentContainerStyle, ...scrollProps } = rest;
    return (
      <ScrollView
        style={[styles.screen, { paddingTop }, style]}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  const { scroll: _scroll, ...viewProps } = rest;
  return (
    <View style={[styles.screen, { paddingTop }, style]} {...viewProps}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.xxl,
    paddingBottom: Theme.spacing.xxxl,
  },
});

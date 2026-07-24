import Fonts from "@/constants/fonts";
import { MarshmallowProfileProvider } from "@/contexts/MarshmallowProfileContext";
import { FocusSessionProvider } from "@/contexts/FocusSessionContext";
import { TimedBlockPlansProvider } from "@/contexts/TimedBlockPlansContext";
import { requestNotificationPermissions } from "@/lib/notifications";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export default function Layout() {
  const [fontsLoaded] = useFonts({
    [Fonts.regular]: require("../assets/fonts/SF-Compact-Rounded-Regular.ttf"),
    [Fonts.medium]: require("../assets/fonts/SF-Compact-Rounded-Medium.ttf"),
    [Fonts.semibold]: require("../assets/fonts/SF-Compact-Rounded-Semibold.ttf"),
    [Fonts.bold]: require("../assets/fonts/SF-Compact-Rounded-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <BottomSheetModalProvider>
          <MarshmallowProfileProvider>
            <FocusSessionProvider>
              <TimedBlockPlansProvider>
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />

                  <Stack.Screen
                    name="login"
                    options={{
                      presentation: "formSheet",
                      headerShown: false,
                      sheetGrabberVisible: true,
                      sheetCornerRadius: 30,
                      sheetAllowedDetents: [0.5],
                    }}
                  />

                  <Stack.Screen
                    name="signin"
                    options={{
                      presentation: "formSheet",
                      animation: "slide_from_bottom",
                      headerShown: false,
                    }}
                  />

                  <Stack.Screen
                    name="custominit"
                    options={{
                      headerShown: false,
                      presentation: "card",
                      animation: "default",
                    }}
                  />

                  <Stack.Screen
                    name="onboarding-purpose"
                    options={{
                      headerShown: false,
                      presentation: "card",
                      animation: "default",
                    }}
                  />

                  <Stack.Screen
                    name="onboarding-screentime"
                    options={{
                      headerShown: false,
                      presentation: "card",
                      animation: "default",
                    }}
                  />

                  <Stack.Screen
                    name="onboarding-premium"
                    options={{
                      headerShown: false,
                      presentation: "card",
                      animation: "default",
                    }}
                  />

                  <Stack.Screen
                    name="(tabs)"
                    options={{
                      headerShown: false,
                      animation: "fade",
                    }}
                  />

                  <Stack.Screen
                    name="profile"
                    options={{
                      headerShown: false,
                      presentation: "card",
                    }}
                  />
                </Stack>
              </TimedBlockPlansProvider>
            </FocusSessionProvider>
          </MarshmallowProfileProvider>
        </BottomSheetModalProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
import Fonts from "@/constants/fonts";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MarshmallowProfileProvider, useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { FocusSessionProvider } from "@/contexts/FocusSessionContext";
import { TimedBlockPlansProvider } from "@/contexts/TimedBlockPlansContext";
import { FriendsProvider } from "@/contexts/FriendsContext";
import { requestNotificationPermissions } from "@/lib/notifications";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

function AuthNavigationGuard() {
  const { status, user, isLoading } = useAuth();
  const { isProfileReady } = useMarshmallowProfile();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isProfileReady) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, isProfileReady]);

  useEffect(() => {
    if (isLoading || !isProfileReady) return;
    if (status === "needs_verification" && !pathname.startsWith("/auth/")) {
      router.replace({
        pathname: "/auth/verify",
        params: { email: user?.email ?? "" },
      });
    }
  }, [isLoading, isProfileReady, status, pathname, user?.email, router]);

  return null;
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    [Fonts.regular]: require("../assets/fonts/SF-Compact-Rounded-Regular.ttf"),
    [Fonts.medium]: require("../assets/fonts/SF-Compact-Rounded-Medium.ttf"),
    [Fonts.semibold]: require("../assets/fonts/SF-Compact-Rounded-Semibold.ttf"),
    [Fonts.bold]: require("../assets/fonts/SF-Compact-Rounded-Bold.ttf"),
  });

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <MarshmallowProfileProvider>
            <FocusSessionProvider>
              <TimedBlockPlansProvider>
                <FriendsProvider>
                  <AuthNavigationGuard />
                  <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />

                    <Stack.Screen
                      name="auth/verify"
                      options={{
                        headerShown: false,
                        presentation: "card",
                      }}
                    />

                    <Stack.Screen
                      name="auth/callback"
                      options={{
                        headerShown: false,
                        presentation: "card",
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
                      name="onboarding-screentime-access"
                      options={{
                        headerShown: false,
                        presentation: "card",
                        animation: "default",
                      }}
                    />

                    <Stack.Screen
                      name="onboarding-distracting-apps"
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
                </FriendsProvider>
              </TimedBlockPlansProvider>
            </FocusSessionProvider>
          </MarshmallowProfileProvider>
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

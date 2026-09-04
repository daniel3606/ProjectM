import LaunchScreen from "@/components/LaunchScreen";
import Fonts from "@/constants/fonts";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FocusSessionProvider } from "@/contexts/FocusSessionContext";
import { FriendsProvider } from "@/contexts/FriendsContext";
import { MarshmallowProfileProvider, useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { StatsProvider } from "@/contexts/StatsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { TimedBlockPlansProvider } from "@/contexts/TimedBlockPlansContext";
import { isPublicAuthRoute, resolveAppRoute } from "@/lib/auth";
import { requestNotificationPermissions } from "@/lib/notifications";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

/**
 * Everything below this point is one account's data. Signing out bumps
 * `dataGeneration`, which remounts the subtree so the previous user's state
 * is dropped rather than left on screen until a hydrate replaces it.
 *
 * Keyed on the counter rather than the user id so that only a sign-out clears
 * state. Signing in must not, or the profile fetched for the new session would
 * be torn down by the very remount that observed it.
 */
function AccountScope({ children }: { children: React.ReactNode }) {
  const { dataGeneration } = useAuth();
  return <React.Fragment key={dataGeneration}>{children}</React.Fragment>;
}

/**
 * Keeps the session and the route in agreement. Losing a session — signing
 * out, or a refresh token that has expired while the app was closed — must
 * take the user off whatever screen they were on, since none of it is theirs
 * to see any more.
 */
function AuthNavigationGuard() {
  const { status, user, isLoading } = useAuth();
  const { isProfileReady, onboardingCompleted } = useMarshmallowProfile();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || status === "loading" || !isProfileReady) return;

    if (status === "unauthenticated" && !isPublicAuthRoute(pathname)) {
      router.replace("/auth");
      return;
    }

    if (status === "needs_verification" && !pathname.startsWith("/auth/")) {
      router.replace({
        pathname: "/auth/verify",
        params: { email: user?.email ?? "" },
      });
      return;
    }

    // Signing in succeeds without moving anyone: the auth screens have no idea
    // where a session belongs. Sending them on from here keeps that decision in
    // one place, and covers arriving with a session already restored.
    if (status === "authenticated" && isPublicAuthRoute(pathname)) {
      router.replace(resolveAppRoute(status, onboardingCompleted));
    }
  }, [
    isLoading,
    isProfileReady,
    onboardingCompleted,
    pathname,
    router,
    status,
    user?.email,
  ]);

  return null;
}

/**
 * Reports the moment the app behind the launch screen is worth revealing:
 * a session has been restored or ruled out, and the profile it belongs to is
 * loaded. This has to be read from inside the providers, while the launch
 * screen itself is mounted outside `AccountScope` — signing out remounts
 * everything under it, and that must not put the launch screen back up.
 */
function BootReadySignal({ onReady }: { onReady: () => void }) {
  const { isLoading } = useAuth();
  const { isProfileReady } = useMarshmallowProfile();

  useEffect(() => {
    if (!isLoading && isProfileReady) onReady();
  }, [isLoading, isProfileReady, onReady]);

  return null;
}

export default function Layout() {
  const [bootReady, setBootReady] = useState(false);
  const [launchFinished, setLaunchFinished] = useState(false);
  const handleBootReady = useCallback(() => setBootReady(true), []);
  const handleLaunchFinished = useCallback(() => setLaunchFinished(true), []);

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
          <AccountScope>
            <MarshmallowProfileProvider>
              <SubscriptionProvider>
                <FocusSessionProvider>
                  <TimedBlockPlansProvider>
                    <StatsProvider>
                      <FriendsProvider>
                        <OnboardingProvider>
                          <AuthNavigationGuard />
                          <BootReadySignal onReady={handleBootReady} />
                          <Stack>
                            <Stack.Screen name="index" options={{ headerShown: false }} />

                            <Stack.Screen
                              name="auth/index"
                              options={{ headerShown: false, animation: "fade" }}
                            />

                            <Stack.Screen
                              name="auth/verify"
                              options={{ headerShown: false, presentation: "card" }}
                            />

                            <Stack.Screen
                              name="auth/callback"
                              options={{ headerShown: false, presentation: "card" }}
                            />

                            <Stack.Screen
                              name="onboarding"
                              options={{ headerShown: false, animation: "fade" }}
                            />

                            <Stack.Screen
                              name="(tabs)"
                              options={{ headerShown: false, animation: "fade" }}
                            />

                            <Stack.Screen
                              name="premium"
                              options={{ headerShown: false, presentation: "card" }}
                            />

                            <Stack.Screen
                              name="settings"
                              options={{ headerShown: false, presentation: "card" }}
                            />

                          </Stack>
                        </OnboardingProvider>
                      </FriendsProvider>
                    </StatsProvider>
                  </TimedBlockPlansProvider>
                </FocusSessionProvider>
              </SubscriptionProvider>
            </MarshmallowProfileProvider>
          </AccountScope>
        </BottomSheetModalProvider>
      </AuthProvider>

      {!launchFinished && (
        <LaunchScreen ready={bootReady} onFinished={handleLaunchFinished} />
      )}
    </GestureHandlerRootView>
  );
}

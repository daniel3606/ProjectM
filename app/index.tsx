import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Theme from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { resolveAppRoute } from "@/lib/auth";

/**
 * The entry point is a router, not a screen.
 *
 * Marshmallow opens on a sign-in wall: an account owns the data, so there is
 * nothing to show until we know whose it is. Where someone lands from here is
 * decided entirely by `resolveAppRoute`.
 */
export default function Index() {
  const router = useRouter();
  const { status, user, isLoading } = useAuth();
  const { onboardingCompleted, isProfileReady } = useMarshmallowProfile();

  useEffect(() => {
    if (isLoading || status === "loading") return;
    // The profile only matters once there is an account to load it for.
    if (status === "authenticated" && !isProfileReady) return;

    const route = resolveAppRoute(status, onboardingCompleted);
    if (route === "/auth/verify") {
      router.replace({
        pathname: "/auth/verify",
        params: { email: user?.email ?? "" },
      });
      return;
    }
    router.replace(route);
  }, [isLoading, isProfileReady, onboardingCompleted, router, status, user?.email]);

  // A blank, correctly coloured root rather than null: returning null blanks the
  // navigator and can crash Release builds on device. The launch screen is still
  // over the top at this point anyway, and lifts once the profile is ready.
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
});

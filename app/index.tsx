import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Theme from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { getPostAuthRoute } from "@/lib/auth";

/**
 * The entry point is a router, not a screen.
 *
 * Marshmallow no longer opens on a login wall: a new user goes straight into
 * the onboarding story and is asked for an account near the end of it, once
 * there is a marshmallow and a goal worth saving. Signing in lives inside that
 * flow, so nothing needs to be shown here — only decided.
 */
export default function Index() {
  const router = useRouter();
  const { status, user, isLoading } = useAuth();
  const { onboardingCompleted, isProfileReady } = useMarshmallowProfile();

  useEffect(() => {
    if (isLoading || !isProfileReady) return;

    if (status === "needs_verification") {
      router.replace({
        pathname: "/auth/verify",
        params: { email: user?.email ?? "" },
      });
      return;
    }

    router.replace(getPostAuthRoute(onboardingCompleted));
  }, [isLoading, isProfileReady, onboardingCompleted, router, status, user?.email]);

  // A blank, correctly coloured root rather than null: returning null blanks the
  // navigator and can crash Release builds on device. The splash screen is still
  // up at this point anyway, and hides once the profile is ready.
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
});

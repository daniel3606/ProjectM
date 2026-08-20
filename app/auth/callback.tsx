import Theme from "@/constants/theme";
import { completeAuthFromUrl } from "@/lib/authRedirect";
import { Button, Screen, ScreenSubtitle, ScreenTitle } from "@/components/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type CallbackStatus = "loading" | "success" | "error";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    token_hash?: string;
    type?: string;
    error?: string;
    error_description?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState("Confirming your email…");
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function handleUrl(url: string) {
      if (handledRef.current) return;
      const result = await completeAuthFromUrl(url, params);
      if (cancelled) return;

      if (result.error === "Missing confirmation parameters." || result.canceled) {
        router.replace("/");
        return;
      }

      handledRef.current = true;
      if (result.error) {
        setStatus("error");
        setMessage(result.error);
        return;
      }

      setStatus("success");
      setMessage("Email confirmed! Taking you in…");
      router.replace("/");
    }

    Linking.getInitialURL()
      .then((url) => handleUrl(url ?? ""))
      .catch(() => {
        if (!cancelled) router.replace("/");
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [params, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen style={styles.screen}>
        <View style={styles.content}>
          {status === "loading" ? (
            <ActivityIndicator size="large" color={Theme.colors.secondary} />
          ) : null}
          <ScreenTitle style={styles.title}>
            {status === "loading"
              ? "Confirming Email"
              : status === "success"
                ? "You're Verified"
                : "Confirmation Failed"}
          </ScreenTitle>
          <ScreenSubtitle style={styles.subtitle}>{message}</ScreenSubtitle>
          {status === "error" ? (
            <Button
              label="Back to Sign In"
              onPress={() => router.replace("/")}
              style={styles.button}
            />
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: Theme.spacing.xxl,
    alignItems: "center",
    gap: Theme.spacing.lg,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  button: {
    alignSelf: "stretch",
    marginTop: Theme.spacing.md,
  },
});

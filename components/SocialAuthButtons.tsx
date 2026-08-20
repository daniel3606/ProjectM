import Theme from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { isAppleAuthAvailable } from "@/lib/appleAuth";
import { Button } from "@/components/ui";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

interface SocialAuthButtonsProps {
  onError: (message: string) => void;
}

export default function SocialAuthButtons({ onError }: SocialAuthButtonsProps) {
  const { signInWithGoogle, signInWithApple, isAuthBusy } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isAppleAuthAvailable().then((available) => {
      if (!cancelled) setAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onGoogle = async () => {
    if (isAuthBusy) return;
    setGoogleLoading(true);
    try {
      const { error, canceled } = await signInWithGoogle();
      if (!canceled && error) onError(error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const onApple = async () => {
    if (isAuthBusy) return;
    setAppleLoading(true);
    try {
      const { error, canceled } = await signInWithApple();
      if (!canceled && error) onError(error);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      <Button
        label="Continue with Google"
        variant="outline"
        icon="logo-google"
        onPress={onGoogle}
        loading={googleLoading}
        disabled={isAuthBusy && !googleLoading}
        style={styles.socialButton}
        textStyle={styles.socialButtonText}
      />

      {Platform.OS === "ios" && appleAvailable ? (
        <View
          pointerEvents={isAuthBusy || appleLoading ? "none" : "auto"}
          style={isAuthBusy || appleLoading ? styles.appleBusy : undefined}
        >
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={14}
            style={styles.appleButton}
            onPress={onApple}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 10,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 6,
  },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.cardBorder,
  },
  dividerText: {
    color: Theme.colors.gray,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
  },
  socialButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
  },
  socialButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  appleButton: {
    width: "100%",
    height: 52,
  },
  appleBusy: {
    opacity: 0.5,
  },
});

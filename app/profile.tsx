import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { Screen, Button } from "@/components/ui";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { useAuth } from "@/contexts/AuthContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useFocusSession } from "@/contexts/FocusSessionContext";
import { fetchRemoteProfile } from "@/lib/sync";
import type { Profile } from "@/types/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const profile = useMarshmallowProfile();
  const { history, totalGrowthCm } = useFocusSession();
  const [remoteProfile, setRemoteProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (user) {
      fetchRemoteProfile(user.id).then((p) => {
        if (p) setRemoteProfile(p);
      });
    }
  }, [user]);

  const totalSessions = history.length;
  const totalMinutes = history.reduce((sum, s) => sum + s.durationMinutes, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const displayGrowth = remoteProfile
    ? Math.max(totalGrowthCm, Number(remoteProfile.total_growth_cm))
    : totalGrowthCm;
  const displayMinutes = remoteProfile
    ? Math.max(totalMinutes, remoteProfile.total_focus_minutes)
    : totalMinutes;
  const displayHours = Math.floor(displayMinutes / 60);
  const displayMins = displayMinutes % 60;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Screen topInset={16} scroll contentContainerStyle={styles.scrollContent}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={Theme.colors.secondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.content}>
          {/* Marshmallow preview */}
          <View style={styles.characterWrap}>
            <MarshmallowCharacter
              color={profile.color}
              name={profile.name}
              sizeCm={displayGrowth}
            />
          </View>

          {/* Username / name */}
          <Text style={styles.displayName}>{profile.name}</Text>
          {remoteProfile?.username && (
            <Text style={styles.username}>@{remoteProfile.username}</Text>
          )}
          {user && (
            <Text style={styles.email}>{user.email}</Text>
          )}

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{displayGrowth.toFixed(1)}</Text>
              <Text style={styles.statLabel}>cm grown</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {displayHours > 0 ? `${displayHours}h ${displayMins}m` : `${displayMins}m`}
              </Text>
              <Text style={styles.statLabel}>focused</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalSessions}</Text>
              <Text style={styles.statLabel}>sessions</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {user ? (
              <Button
                label="Sign Out"
                variant="outline"
                onPress={handleSignOut}
                style={styles.signOutBtn}
              />
            ) : (
              <View style={styles.guestCta}>
                <Text style={styles.guestCtaText}>
                  Sign up to sync your progress and add friends
                </Text>
                <Button
                  label="Sign Up"
                  onPress={() => router.replace("/")}
                  style={styles.signUpBtn}
                />
              </View>
            )}
          </View>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 17,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    alignItems: "center",
    paddingTop: 16,
  },
  characterWrap: {
    marginBottom: 8,
  },
  displayName: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  username: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
    marginTop: 2,
  },
  email: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
    width: "100%",
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    marginTop: 2,
  },
  actions: {
    marginTop: 32,
    width: "100%",
  },
  signOutBtn: {
    alignSelf: "center",
    minWidth: 160,
  },
  guestCta: {
    alignItems: "center",
    gap: 12,
  },
  guestCtaText: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    textAlign: "center",
    lineHeight: 22,
  },
  signUpBtn: {
    minWidth: 160,
  },
});

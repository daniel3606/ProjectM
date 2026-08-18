import React, { useCallback, useRef } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { Screen, Button, ScreenTitle, SectionLabel } from "@/components/ui";
import FriendCard from "@/components/FriendCard";
import AddFriendSheet from "@/components/AddFriendSheet";
import { useFriends } from "@/contexts/FriendsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

export default function FriendsScreen() {
  const { user } = useAuth();
  const {
    friends,
    incomingRequests,
    focusingFriendIds,
    isLoading,
    acceptRequest,
    rejectRequest,
    removeFriend,
    refresh,
  } = useFriends();
  const addSheetRef = useRef<BottomSheetModal>(null);
  const router = useRouter();

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Sort friends by total_growth_cm descending (leaderboard)
  const sortedFriends = [...friends].sort(
    (a, b) => Number(b.total_growth_cm) - Number(a.total_growth_cm)
  );

  if (!user) {
    return (
      <Screen topInset style={styles.container}>
        <ScreenTitle>Friends</ScreenTitle>
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={56} color={Theme.colors.gray} />
          <Text style={styles.emptyTitle}>Sign in to add friends</Text>
          <Text style={styles.emptySubtitle}>
            Create an account to connect with friends and see how your marshmallows grow together.
          </Text>
          <Button
            label="Sign Up"
            onPress={() => router.push("/")}
            style={styles.ctaButton}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      topInset
      scroll
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor={Theme.colors.secondary}
        />
      }
    >
      <View style={styles.header}>
        <ScreenTitle>Friends</ScreenTitle>
        <Pressable
          onPress={() => addSheetRef.current?.present()}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons name="person-add" size={22} color={Theme.colors.secondary} />
        </Pressable>
      </View>

      {/* Incoming requests */}
      {incomingRequests.length > 0 && (
        <View style={styles.section}>
          <SectionLabel>Friend Requests</SectionLabel>
          {incomingRequests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View
                style={[
                  styles.requestSwatch,
                  { backgroundColor: req.requester.marshmallow_color || "#FFF5EE" },
                ]}
              />
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>
                  {req.requester.display_name || req.requester.username || "User"}
                </Text>
                {req.requester.username && (
                  <Text style={styles.requestUsername}>@{req.requester.username}</Text>
                )}
              </View>
              <Pressable
                onPress={() => acceptRequest(req.id)}
                style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
              >
                <Ionicons name="checkmark" size={20} color={Theme.colors.white} />
              </Pressable>
              <Pressable
                onPress={() => rejectRequest(req.id)}
                style={({ pressed }) => [styles.rejectBtn, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={20} color={Theme.colors.gray} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Friends list / leaderboard */}
      {sortedFriends.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Leaderboard</SectionLabel>
          {sortedFriends.map((friend, i) => (
            <FriendCard
              key={friend.id}
              friend={friend}
              isFocusing={focusingFriendIds.has(friend.id)}
              rank={i + 1}
              onRemove={() => removeFriend(friend.friendshipId)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={56} color={Theme.colors.gray} />
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySubtitle}>
            Search for friends by username and start growing together.
          </Text>
          <Button
            label="Add Friends"
            onPress={() => addSheetRef.current?.present()}
            style={styles.ctaButton}
          />
        </View>
      )}

      <AddFriendSheet ref={addSheetRef} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    marginBottom: 24,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  requestSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Theme.colors.cardBorder,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  requestUsername: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.lightGray,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  ctaButton: {
    marginTop: 16,
    minWidth: 160,
  },
});

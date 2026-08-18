import React, { forwardRef, useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { useFriends } from "@/contexts/FriendsContext";
import type { Profile } from "@/types/supabase";

const AddFriendSheet = forwardRef<BottomSheetModal>(function AddFriendSheet(_, ref) {
  const { searchUsers, sendRequest, outgoingRequests, friends } = useFriends();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [error, setError] = useState("");

  const onSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const users = await searchUsers(query.trim());
      setResults(users);
    } catch {
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, searchUsers]);

  const onSend = useCallback(
    async (userId: string) => {
      setSendingTo(userId);
      setError("");
      const { error: sendError } = await sendRequest(userId);
      if (sendError) setError(sendError);
      setSendingTo(null);
    },
    [sendRequest]
  );

  const alreadyFriendIds = new Set(friends.map((f) => f.id));
  const pendingIds = new Set(outgoingRequests.map((r) => r.addressee_id));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["60%"]}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Add Friend</Text>

        <View style={styles.searchRow}>
          <BottomSheetTextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username"
            placeholderTextColor={Theme.colors.gray}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={onSearch}
          />
          <Pressable
            onPress={onSearch}
            style={({ pressed }) => [styles.searchBtn, pressed && styles.pressed]}
          >
            <Ionicons name="search" size={20} color={Theme.colors.white} />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {searching ? (
          <ActivityIndicator style={styles.loader} color={Theme.colors.secondary} />
        ) : (
          results.map((user) => {
            const isFriend = alreadyFriendIds.has(user.id);
            const isPending = pendingIds.has(user.id);
            const isSending = sendingTo === user.id;

            return (
              <View key={user.id} style={styles.resultRow}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: user.marshmallow_color || "#FFF5EE" },
                  ]}
                />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>
                    {user.display_name || user.username || "User"}
                  </Text>
                  {user.username && (
                    <Text style={styles.resultUsername}>@{user.username}</Text>
                  )}
                </View>

                {isFriend ? (
                  <Text style={styles.statusText}>Friends</Text>
                ) : isPending ? (
                  <Text style={styles.statusText}>Pending</Text>
                ) : isSending ? (
                  <ActivityIndicator size="small" color={Theme.colors.secondary} />
                ) : (
                  <Pressable
                    onPress={() => onSend(user.id)}
                    style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="person-add" size={18} color={Theme.colors.white} />
                  </Pressable>
                )}
              </View>
            );
          })
        )}

        {!searching && results.length === 0 && query.length >= 2 && (
          <Text style={styles.empty}>No users found</Text>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

export default AddFriendSheet;

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 40,
    backgroundColor: Theme.colors.gray,
    opacity: 0.35,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Theme.colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    color: Theme.colors.danger,
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    marginBottom: 12,
  },
  loader: {
    marginTop: 32,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.cardBorder,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Theme.colors.cardBorder,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  resultUsername: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
  statusText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
});

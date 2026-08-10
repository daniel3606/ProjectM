import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Profile, Friendship } from "@/types/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface FriendWithProfile extends Profile {
  friendshipId: string;
}

interface FriendsContextValue {
  friends: FriendWithProfile[];
  incomingRequests: (Friendship & { requester: Profile })[];
  outgoingRequests: (Friendship & { addressee: Profile })[];
  focusingFriendIds: Set<string>;
  isLoading: boolean;
  searchUsers: (query: string) => Promise<Profile[]>;
  sendRequest: (addresseeId: string) => Promise<{ error: string | null }>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  rejectRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<(Friendship & { requester: Profile })[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<(Friendship & { addressee: Profile })[]>([]);
  const [focusingFriendIds, setFocusingFriendIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchFriendships = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch accepted friendships
      const { data: accepted } = await supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (accepted) {
        const friendIds = accepted.map((f) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id
        );
        if (friendIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", friendIds);

          if (profiles) {
            setFriends(
              profiles.map((p) => ({
                ...p,
                friendshipId: accepted.find(
                  (f) =>
                    (f.requester_id === p.id && f.addressee_id === user.id) ||
                    (f.addressee_id === p.id && f.requester_id === user.id)
                )!.id,
              }))
            );
          }
        } else {
          setFriends([]);
        }
      }

      // Fetch incoming requests
      const { data: incoming } = await supabase
        .from("friendships")
        .select("*")
        .eq("addressee_id", user.id)
        .eq("status", "pending");

      if (incoming && incoming.length > 0) {
        const requesterIds = incoming.map((f) => f.requester_id);
        const { data: requesterProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", requesterIds);

        if (requesterProfiles) {
          setIncomingRequests(
            incoming.map((f) => ({
              ...f,
              status: f.status as Friendship["status"],
              requester: requesterProfiles.find((p) => p.id === f.requester_id)!,
            }))
          );
        }
      } else {
        setIncomingRequests([]);
      }

      // Fetch outgoing requests
      const { data: outgoing } = await supabase
        .from("friendships")
        .select("*")
        .eq("requester_id", user.id)
        .eq("status", "pending");

      if (outgoing && outgoing.length > 0) {
        const addresseeIds = outgoing.map((f) => f.addressee_id);
        const { data: addresseeProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", addresseeIds);

        if (addresseeProfiles) {
          setOutgoingRequests(
            outgoing.map((f) => ({
              ...f,
              status: f.status as Friendship["status"],
              addressee: addresseeProfiles.find((p) => p.id === f.addressee_id)!,
            }))
          );
        }
      } else {
        setOutgoingRequests([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch on mount / user change
  useEffect(() => {
    fetchFriendships();
  }, [fetchFriendships]);

  // Subscribe to realtime changes on friendships table
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("friendships-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `requester_id=eq.${user.id}`,
        },
        () => fetchFriendships()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${user.id}`,
        },
        () => fetchFriendships()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFriendships]);

  // Presence channel for focus status
  useEffect(() => {
    if (!user || friends.length === 0) {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      return;
    }

    const channel = supabase.channel("focus-presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const focusingIds = new Set<string>();
        for (const key of Object.keys(state)) {
          if (key !== user.id && friends.some((f) => f.id === key)) {
            const presences = state[key] as Array<{ isFocusing?: boolean }>;
            if (presences.some((p) => p.isFocusing)) {
              focusingIds.add(key);
            }
          }
        }
        setFocusingFriendIds(focusingIds);
      })
      .subscribe();

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [user, friends]);

  const searchUsers = useCallback(
    async (query: string): Promise<Profile[]> => {
      if (!user || query.trim().length < 2) return [];

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${query}%`)
        .neq("id", user.id)
        .limit(20);

      return data ?? [];
    },
    [user]
  );

  const sendRequest = useCallback(
    async (addresseeId: string) => {
      if (!user) return { error: "Not logged in" };

      const { error } = await supabase.from("friendships").insert({
        requester_id: user.id,
        addressee_id: addresseeId,
      });

      if (error) {
        if (error.code === "23505") {
          return { error: "Friend request already sent" };
        }
        return { error: error.message };
      }

      await fetchFriendships();
      return { error: null };
    },
    [user, fetchFriendships]
  );

  const acceptRequest = useCallback(
    async (friendshipId: string) => {
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);
      await fetchFriendships();
    },
    [fetchFriendships]
  );

  const rejectRequest = useCallback(
    async (friendshipId: string) => {
      await supabase
        .from("friendships")
        .update({ status: "rejected" })
        .eq("id", friendshipId);
      await fetchFriendships();
    },
    [fetchFriendships]
  );

  const removeFriend = useCallback(
    async (friendshipId: string) => {
      await supabase.from("friendships").delete().eq("id", friendshipId);
      await fetchFriendships();
    },
    [fetchFriendships]
  );

  const value = useMemo(
    () => ({
      friends,
      incomingRequests,
      outgoingRequests,
      focusingFriendIds,
      isLoading,
      searchUsers,
      sendRequest,
      acceptRequest,
      rejectRequest,
      removeFriend,
      refresh: fetchFriendships,
    }),
    [
      friends,
      incomingRequests,
      outgoingRequests,
      focusingFriendIds,
      isLoading,
      searchUsers,
      sendRequest,
      acceptRequest,
      rejectRequest,
      removeFriend,
      fetchFriendships,
    ]
  );

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) {
    throw new Error("useFriends must be used within a FriendsProvider");
  }
  return ctx;
}

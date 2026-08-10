export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_key: string;
          id: string;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          achievement_key: string;
          id?: string;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          achievement_key?: string;
          id?: string;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      blocking_sessions: {
        Row: {
          completed: boolean;
          created_at: string;
          duration_minutes: number;
          ended_at: string | null;
          growth_cm: number;
          id: string;
          started_at: string;
          user_id: string;
          was_strong_block: boolean;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          duration_minutes?: number;
          ended_at?: string | null;
          growth_cm?: number;
          id?: string;
          started_at?: string;
          user_id: string;
          was_strong_block?: boolean;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          duration_minutes?: number;
          ended_at?: string | null;
          growth_cm?: number;
          id?: string;
          started_at?: string;
          user_id?: string;
          was_strong_block?: boolean;
        };
        Relationships: [];
      };
      cosmetics: {
        Row: {
          created_at: string;
          id: string;
          is_premium: boolean;
          name: string;
          preview_data: Json;
          rarity: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_premium?: boolean;
          name: string;
          preview_data?: Json;
          rarity?: string;
          type: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_premium?: boolean;
          name?: string;
          preview_data?: Json;
          rarity?: string;
          type?: string;
        };
        Relationships: [];
      };
      focus_sessions: {
        Row: {
          completed_at: string;
          duration_minutes: number;
          focus_mode: string;
          growth_cm: number;
          id: string;
          user_id: string;
        };
        Insert: {
          completed_at: string;
          duration_minutes: number;
          focus_mode: string;
          growth_cm: number;
          id?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          duration_minutes?: number;
          focus_mode?: string;
          growth_cm?: number;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "focus_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marshmallows: {
        Row: {
          color: string;
          color_changes_used: number;
          created_at: string;
          id: string;
          name: string;
          name_changes_used: number;
          size_cm: number;
          total_blocked_minutes: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          color_changes_used?: number;
          created_at?: string;
          id?: string;
          name?: string;
          name_changes_used?: number;
          size_cm?: number;
          total_blocked_minutes?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string;
          color_changes_used?: number;
          created_at?: string;
          id?: string;
          name?: string;
          name_changes_used?: number;
          size_cm?: number;
          total_blocked_minutes?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      premium_config: {
        Row: {
          key: string;
          value: Json;
        };
        Insert: {
          key: string;
          value: Json;
        };
        Update: {
          key?: string;
          value?: Json;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          friend_code: string;
          id: string;
          marshmallow_color: string | null;
          total_focus_minutes: number;
          total_growth_cm: number;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          friend_code?: string;
          id: string;
          marshmallow_color?: string | null;
          total_focus_minutes?: number;
          total_growth_cm?: number;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          friend_code?: string;
          id?: string;
          marshmallow_color?: string | null;
          total_focus_minutes?: number;
          total_growth_cm?: number;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      scheduled_blocks: {
        Row: {
          created_at: string;
          days_of_week: number[];
          end_time: string;
          id: string;
          is_active: boolean;
          is_strong_block: boolean;
          name: string;
          start_time: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          days_of_week?: number[];
          end_time: string;
          id?: string;
          is_active?: boolean;
          is_strong_block?: boolean;
          name?: string;
          start_time: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          days_of_week?: number[];
          end_time?: string;
          id?: string;
          is_active?: boolean;
          is_strong_block?: boolean;
          name?: string;
          start_time?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      streaks: {
        Row: {
          current_streak: number;
          id: string;
          last_active_date: string | null;
          longest_streak: number;
          streak_saver_used_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          current_streak?: number;
          id?: string;
          last_active_date?: string | null;
          longest_streak?: number;
          streak_saver_used_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          current_streak?: number;
          id?: string;
          last_active_date?: string | null;
          longest_streak?: number;
          streak_saver_used_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          is_trial: boolean;
          latest_receipt: string | null;
          original_transaction_id: string | null;
          product_id: string;
          purchase_date: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_trial?: boolean;
          latest_receipt?: string | null;
          original_transaction_id?: string | null;
          product_id?: string;
          purchase_date?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_trial?: boolean;
          latest_receipt?: string | null;
          original_transaction_id?: string | null;
          product_id?: string;
          purchase_date?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_cosmetics: {
        Row: {
          cosmetic_id: string;
          id: string;
          is_equipped: boolean;
          unlocked_at: string;
          user_id: string;
        };
        Insert: {
          cosmetic_id: string;
          id?: string;
          is_equipped?: boolean;
          unlocked_at?: string;
          user_id: string;
        };
        Update: {
          cosmetic_id?: string;
          id?: string;
          is_equipped?: boolean;
          unlocked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_cosmetics_cosmetic_id_fkey";
            columns: ["cosmetic_id"];
            isOneToOne: false;
            referencedRelation: "cosmetics";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          ads_enabled: boolean;
          created_at: string;
          growth_rate_multiplier: number;
          id: string;
          notifications_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ads_enabled?: boolean;
          created_at?: string;
          growth_rate_multiplier?: number;
          id?: string;
          notifications_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ads_enabled?: boolean;
          created_at?: string;
          growth_rate_multiplier?: number;
          id?: string;
          notifications_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_create_scheduled_block: {
        Args: { check_user_id: string };
        Returns: boolean;
      };
      generate_friend_code: { Args: never; Returns: string };
      get_premium_status: { Args: { check_user_id: string }; Returns: Json };
      is_premium: { Args: { check_user_id: string }; Returns: boolean };
      use_streak_saver: { Args: { check_user_id: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Convenience type aliases used throughout the app
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type FocusSessionRow = Database["public"]["Tables"]["focus_sessions"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];

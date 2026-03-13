export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          image: string | null
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          image?: string | null
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          image?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "ai_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chats: {
        Row: {
          created_at: string
          id: string
          mode: string
          model: string
          pinned: boolean | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          model?: string
          pinned?: boolean | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          model?: string
          pinned?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      call_events: {
        Row: {
          call_type: string
          caller_id: string
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          receiver_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          call_type: string
          caller_id: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id: string
          started_at?: string | null
          status: string
        }
        Update: {
          call_type?: string
          caller_id?: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      cashout_requests: {
        Row: {
          amount: number
          created_at: string
          details: string | null
          id: string
          reward_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          details?: string | null
          id?: string
          reward_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          details?: string | null
          id?: string
          reward_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_files: {
        Row: {
          chat_id: string | null
          chat_type: string
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          chat_type: string
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string | null
          chat_type?: string
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          from_user_id: string | null
          id: string
          to_user_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          from_user_id?: string | null
          id?: string
          to_user_id: string
          transaction_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          from_user_id?: string | null
          id?: string
          to_user_id?: string
          transaction_type?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          edit_history: Json | null
          edited_at: string | null
          id: string
          image_url: string | null
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      friends_chat_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edit_history: Json | null
          edited_at: string | null
          id: string
          image_url: string | null
          reply_to: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_chat_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "friends_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          max_players: number
          name: string
          owner_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          max_players?: number
          name: string
          owner_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          max_players?: number
          name?: string
          owner_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edit_history: Json | null
          edited_at: string | null
          group_id: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          group_id: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          group_id?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          message_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          message_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          message_type?: string
          user_id?: string
        }
        Relationships: []
      }
      model_permissions: {
        Row: {
          created_at: string | null
          id: string
          is_allowed: boolean
          model_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean
          model_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean
          model_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string | null
          created_at: string
          id: string
          items: Json
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          items?: Json
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          items?: Json
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          purpose?: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          verified?: boolean
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          rating: number
          rating_count: number
          stock: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
          rating?: number
          rating_count?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          rating?: number
          rating_count?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      public_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edit_history: Json | null
          edited_at: string | null
          id: string
          image_url: string | null
          reply_to: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_messages_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "public_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_count: number
          action_type: string
          created_at: string | null
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          action_count?: number
          action_type: string
          created_at?: string | null
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action_count?: number
          action_type?: string
          created_at?: string | null
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      reel_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_earnings: {
        Row: {
          coins_awarded: number
          created_at: string
          id: string
          story_id: string
          user_id: string
          views_milestone: number
        }
        Insert: {
          coins_awarded?: number
          created_at?: string
          id?: string
          story_id: string
          user_id: string
          views_milestone: number
        }
        Update: {
          coins_awarded?: number
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
          views_milestone?: number
        }
        Relationships: [
          {
            foreignKeyName: "reel_earnings_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      role_abilities: {
        Row: {
          ability_name: string
          created_at: string | null
          id: string
          is_allowed: boolean
          max_target_role: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          ability_name: string
          created_at?: string | null
          id?: string
          is_allowed?: boolean
          max_target_role?: Database["public"]["Enums"]["app_role"] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          ability_name?: string
          created_at?: string | null
          id?: string
          is_allowed?: boolean
          max_target_role?: Database["public"]["Enums"]["app_role"] | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          is_allowed: boolean
          permission_name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean
          permission_name: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_allowed?: boolean
          permission_name?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          current_weapon: string | null
          deaths: number | null
          health: number | null
          id: string
          is_alive: boolean | null
          joined_at: string | null
          kills: number | null
          player_name: string
          position_x: number | null
          position_y: number | null
          position_z: number | null
          room_id: string
          rotation_y: number | null
          score: number | null
          team: string | null
          user_id: string
        }
        Insert: {
          current_weapon?: string | null
          deaths?: number | null
          health?: number | null
          id?: string
          is_alive?: boolean | null
          joined_at?: string | null
          kills?: number | null
          player_name: string
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          room_id: string
          rotation_y?: number | null
          score?: number | null
          team?: string | null
          user_id: string
        }
        Update: {
          current_weapon?: string | null
          deaths?: number | null
          health?: number | null
          id?: string
          is_alive?: boolean | null
          joined_at?: string | null
          kills?: number | null
          player_name?: string
          position_x?: number | null
          position_y?: number | null
          position_z?: number | null
          room_id?: string
          rotation_y?: number | null
          score?: number | null
          team?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      security_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      skribbl_drawings: {
        Row: {
          created_at: string
          drawing_data: Json
          id: string
          room_id: string
          round_number: number
        }
        Insert: {
          created_at?: string
          drawing_data: Json
          id?: string
          room_id: string
          round_number: number
        }
        Update: {
          created_at?: string
          drawing_data?: Json
          id?: string
          room_id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "skribbl_drawings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "skribbl_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      skribbl_guesses: {
        Row: {
          created_at: string
          guess: string
          id: string
          is_correct: boolean
          player_id: string
          room_id: string
        }
        Insert: {
          created_at?: string
          guess: string
          id?: string
          is_correct?: boolean
          player_id: string
          room_id: string
        }
        Update: {
          created_at?: string
          guess?: string
          id?: string
          is_correct?: boolean
          player_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skribbl_guesses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "skribbl_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skribbl_guesses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "skribbl_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      skribbl_players: {
        Row: {
          avatar_color: string
          has_guessed: boolean
          id: string
          is_connected: boolean
          joined_at: string
          player_name: string
          room_id: string
          score: number
          user_id: string
        }
        Insert: {
          avatar_color: string
          has_guessed?: boolean
          id?: string
          is_connected?: boolean
          joined_at?: string
          player_name: string
          room_id: string
          score?: number
          user_id: string
        }
        Update: {
          avatar_color?: string
          has_guessed?: boolean
          id?: string
          is_connected?: boolean
          joined_at?: string
          player_name?: string
          room_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skribbl_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "skribbl_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      skribbl_rooms: {
        Row: {
          created_at: string
          current_drawer_id: string | null
          current_round: number
          current_word: string | null
          host_id: string
          id: string
          max_players: number
          max_rounds: number
          room_code: string
          round_time: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_drawer_id?: string | null
          current_round?: number
          current_word?: string | null
          host_id: string
          id?: string
          max_players?: number
          max_rounds?: number
          room_code: string
          round_time?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_drawer_id?: string | null
          current_round?: number
          current_word?: string | null
          host_id?: string
          id?: string
          max_players?: number
          max_rounds?: number
          room_code?: string
          round_time?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      snaps: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          receiver_id: string
          sender_id: string
          viewed_at: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          receiver_id: string
          sender_id: string
          viewed_at?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          receiver_id?: string
          sender_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snaps_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snaps_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          user_id: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          user_id: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          coin_price: number
          created_at: string
          description: string | null
          display_name: string
          features: Json
          id: string
          is_active: boolean
          is_popular: boolean
          role_name: string
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          coin_price?: number
          created_at?: string
          description?: string | null
          display_name: string
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          role_name: string
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          coin_price?: number
          created_at?: string
          description?: string | null
          display_name?: string
          features?: Json
          id?: string
          is_active?: boolean
          is_popular?: boolean
          role_name?: string
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          created_at: string
          id: string
          mode: string | null
          model_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string | null
          model_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string | null
          model_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_coins: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_daily_claim: string | null
          unlimited: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          last_daily_claim?: string | null
          unlimited?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          last_daily_claim?: string | null
          unlimited?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_message_limits: {
        Row: {
          created_at: string | null
          daily_limit: number
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_limit?: number
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          last_seen?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          last_seen?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_restrictions: {
        Row: {
          ai_chat_disabled: boolean | null
          banned_from_direct_messages: boolean | null
          banned_from_groups: boolean | null
          banned_from_public_chat: boolean | null
          created_at: string | null
          id: string
          image_generation_disabled: boolean | null
          live_video_call_disabled: boolean | null
          math_solver_disabled: boolean | null
          minecraft_plugin_disabled: boolean | null
          public_chat_timeout_until: string | null
          updated_at: string | null
          user_id: string
          video_generation_disabled: boolean | null
          voice_chat_disabled: boolean | null
        }
        Insert: {
          ai_chat_disabled?: boolean | null
          banned_from_direct_messages?: boolean | null
          banned_from_groups?: boolean | null
          banned_from_public_chat?: boolean | null
          created_at?: string | null
          id?: string
          image_generation_disabled?: boolean | null
          live_video_call_disabled?: boolean | null
          math_solver_disabled?: boolean | null
          minecraft_plugin_disabled?: boolean | null
          public_chat_timeout_until?: string | null
          updated_at?: string | null
          user_id: string
          video_generation_disabled?: boolean | null
          voice_chat_disabled?: boolean | null
        }
        Update: {
          ai_chat_disabled?: boolean | null
          banned_from_direct_messages?: boolean | null
          banned_from_groups?: boolean | null
          banned_from_public_chat?: boolean | null
          created_at?: string | null
          id?: string
          image_generation_disabled?: boolean | null
          live_video_call_disabled?: boolean | null
          math_solver_disabled?: boolean | null
          minecraft_plugin_disabled?: boolean | null
          public_chat_timeout_until?: string | null
          updated_at?: string | null
          user_id?: string
          video_generation_disabled?: boolean | null
          voice_chat_disabled?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_give_coins: {
        Args: {
          _admin_user_id: string
          _amount: number
          _set_unlimited?: boolean
          _to_user_id: string
        }
        Returns: boolean
      }
      can_access_model: {
        Args: { _model_id: string; _user_id: string }
        Returns: boolean
      }
      can_claim_owner: { Args: { _user_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_count: number
          _user_id: string
          _window_seconds: number
        }
        Returns: boolean
      }
      claim_daily_coins: {
        Args: { _amount?: number; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_creator: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_owner_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_timed_out: { Args: { _user_id: string }; Returns: boolean }
      purchase_subscription: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
      record_rate_limit: {
        Args: { _action_type: string; _user_id: string }
        Returns: undefined
      }
      transfer_coins: {
        Args: { _amount: number; _from_user_id: string; _to_user_id: string }
        Returns: boolean
      }
      user_has_restriction: {
        Args: { _restriction_type: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "owner"
        | "ceo"
        | "founder"
        | "co_founder"
        | "friend"
        | "plus"
        | "pro"
        | "elite"
        | "silver"
        | "gold"
        | "platinum"
        | "basic"
        | "premium"
        | "vip"
        | "education_admin"
        | "learning_department"
        | "learning_manager"
        | "sr_moderator"
        | "sr_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "owner",
        "ceo",
        "founder",
        "co_founder",
        "friend",
        "plus",
        "pro",
        "elite",
        "silver",
        "gold",
        "platinum",
        "basic",
        "premium",
        "vip",
        "education_admin",
        "learning_department",
        "learning_manager",
        "sr_moderator",
        "sr_admin",
      ],
    },
  },
} as const

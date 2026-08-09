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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      coach_sessions: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          active_minutes: number
          active_minutes_goal: number
          calorie_burn_goal: number
          calories_burned: number
          created_at: string
          date: string
          id: string
          resting_heart_rate: number | null
          sleep_goal_hours: number
          sleep_hours: number
          sleep_score: number | null
          step_goal: number
          steps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_minutes?: number
          active_minutes_goal?: number
          calorie_burn_goal?: number
          calories_burned?: number
          created_at?: string
          date?: string
          id?: string
          resting_heart_rate?: number | null
          sleep_goal_hours?: number
          sleep_hours?: number
          sleep_score?: number | null
          step_goal?: number
          steps?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_minutes?: number
          active_minutes_goal?: number
          calorie_burn_goal?: number
          calories_burned?: number
          created_at?: string
          date?: string
          id?: string
          resting_heart_rate?: number | null
          sleep_goal_hours?: number
          sleep_hours?: number
          sleep_score?: number | null
          step_goal?: number
          steps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          ai_analysis: Json | null
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          food_name: string
          id: string
          image_url: string | null
          logged_at: string
          meal_type: string
          portion_size: string | null
          protein_g: number
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          food_name: string
          id?: string
          image_url?: string | null
          logged_at?: string
          meal_type?: string
          portion_size?: string | null
          protein_g?: number
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          food_name?: string
          id?: string
          image_url?: string | null
          logged_at?: string
          meal_type?: string
          portion_size?: string | null
          protein_g?: number
          user_id?: string
        }
        Relationships: []
      }
      food_scans: {
        Row: {
          added_at: string | null
          additives: string[]
          ai_summary: string | null
          allergens: string[]
          alternatives: Json
          barcode: string | null
          brand: string | null
          category: string | null
          coach_tip: string | null
          concerns: Json
          created_at: string
          goal_at_scan: string | null
          goal_fit_score: number
          health_score: number
          id: string
          image_url: string | null
          ingredient_intelligence: Json
          ingredients: Json
          nova_group: number | null
          nutrition: Json
          personalized_recommendation: string | null
          positives: Json
          product_name: string
          scan_type: string
          score_category: string
          source: string | null
          things_to_know: Json
          user_id: string
        }
        Insert: {
          added_at?: string | null
          additives?: string[]
          ai_summary?: string | null
          allergens?: string[]
          alternatives?: Json
          barcode?: string | null
          brand?: string | null
          category?: string | null
          coach_tip?: string | null
          concerns?: Json
          created_at?: string
          goal_at_scan?: string | null
          goal_fit_score?: number
          health_score?: number
          id?: string
          image_url?: string | null
          ingredient_intelligence?: Json
          ingredients?: Json
          nova_group?: number | null
          nutrition?: Json
          personalized_recommendation?: string | null
          positives?: Json
          product_name?: string
          scan_type: string
          score_category?: string
          source?: string | null
          things_to_know?: Json
          user_id: string
        }
        Update: {
          added_at?: string | null
          additives?: string[]
          ai_summary?: string | null
          allergens?: string[]
          alternatives?: Json
          barcode?: string | null
          brand?: string | null
          category?: string | null
          coach_tip?: string | null
          concerns?: Json
          created_at?: string
          goal_at_scan?: string | null
          goal_fit_score?: number
          health_score?: number
          id?: string
          image_url?: string | null
          ingredient_intelligence?: Json
          ingredients?: Json
          nova_group?: number | null
          nutrition?: Json
          personalized_recommendation?: string | null
          positives?: Json
          product_name?: string
          scan_type?: string
          score_category?: string
          source?: string | null
          things_to_know?: Json
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          count: number
          created_at: string
          date: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          date?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          category: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          target_per_day: number
          unit: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          target_per_day?: number
          unit?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          target_per_day?: number
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          file_url: string | null
          id: string
          status: string
          title: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          file_url?: string | null
          id?: string
          status?: string
          title?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          file_url?: string | null
          id?: string
          status?: string
          title?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string | null
          created_at: string
          date: string
          id: string
          is_completed: boolean
          is_todo: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          date?: string
          id?: string
          is_completed?: boolean
          is_todo?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          date?: string
          id?: string
          is_completed?: boolean
          is_todo?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string
          age: number | null
          avatar_url: string | null
          calorie_input_mode: string
          created_at: string
          daily_calorie_limit: number
          display_name: string | null
          gender: string | null
          health_goals: string[] | null
          height_cm: number | null
          id: string
          nutrition_goal: string
          target_weight_kg: number | null
          updated_at: string
          user_id: string
          weekly_goal_kg: number | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string
          age?: number | null
          avatar_url?: string | null
          calorie_input_mode?: string
          created_at?: string
          daily_calorie_limit?: number
          display_name?: string | null
          gender?: string | null
          health_goals?: string[] | null
          height_cm?: number | null
          id?: string
          nutrition_goal?: string
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
          weekly_goal_kg?: number | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string
          age?: number | null
          avatar_url?: string | null
          calorie_input_mode?: string
          created_at?: string
          daily_calorie_limit?: number
          display_name?: string | null
          gender?: string | null
          health_goals?: string[] | null
          height_cm?: number | null
          id?: string
          nutrition_goal?: string
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
          weekly_goal_kg?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      telegram_bot_settings: {
        Row: {
          chat_id: number
          created_at: string
          lang: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          created_at?: string
          lang?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          created_at?: string
          lang?: string
          updated_at?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      wellness_points: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          scan_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          scan_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          scan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_points_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "food_scans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_habit_streak: {
        Args: { p_habit_id: string; p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

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
      attachments: {
        Row: {
          filename: string
          id: string
          uploaded_at: string
          uploaded_by: string
          url: string
          work_order_id: string
        }
        Insert: {
          filename: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
          url: string
          work_order_id: string
        }
        Update: {
          filename?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
          url?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      equipments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          location: string | null
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          location?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          invoice_number: string
          pdf_url: string | null
          work_order_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          invoice_number: string
          pdf_url?: string | null
          work_order_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          invoice_number?: string
          pdf_url?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          payload: Json | null
          status: string
          type: string
          user_id: string
          work_order_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json | null
          status?: string
          type: string
          user_id: string
          work_order_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          payload?: Json | null
          status?: string
          type?: string
          user_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          id: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          duration_hours: number | null
          end_time: string | null
          id: string
          note: string | null
          pause_reason: Database["public"]["Enums"]["pause_reason"] | null
          start_time: string
          updated_at: string
          user_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          note?: string | null
          pause_reason?: Database["public"]["Enums"]["pause_reason"] | null
          start_time: string
          updated_at?: string
          user_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          duration_hours?: number | null
          end_time?: string | null
          id?: string
          note?: string | null
          pause_reason?: Database["public"]["Enums"]["pause_reason"] | null
          start_time?: string
          updated_at?: string
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_order_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          user_id: string
          work_order_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          user_id: string
          work_order_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_assignments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_equipments: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_equipments_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_equipments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["work_order_priority"]
          reference: string | null
          scheduled_date: string | null
          service_type: Database["public"]["Enums"]["work_order_service_type"]
          status: Database["public"]["Enums"]["work_order_status"]
          title: string
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          reference?: string | null
          scheduled_date?: string | null
          service_type?: Database["public"]["Enums"]["work_order_service_type"]
          status?: Database["public"]["Enums"]["work_order_status"]
          title: string
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["work_order_priority"]
          reference?: string | null
          scheduled_date?: string | null
          service_type?: Database["public"]["Enums"]["work_order_service_type"]
          status?: Database["public"]["Enums"]["work_order_status"]
          title?: string
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_first_user: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "manager" | "employee" | "client"
      notification_channel: "email" | "sms" | "both"
      pause_reason:
        | "falta_material"
        | "enviado_oficina"
        | "enviado_orcamento"
        | "assinatura_gerente"
      user_role: "manager" | "employee" | "client"
      work_order_priority: "low" | "medium" | "high" | "urgent"
      work_order_service_type:
        | "repair"
        | "maintenance"
        | "installation"
        | "warranty"
      work_order_status:
        | "pending"
        | "approved"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "awaiting_approval"
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
      app_role: ["manager", "employee", "client"],
      notification_channel: ["email", "sms", "both"],
      pause_reason: [
        "falta_material",
        "enviado_oficina",
        "enviado_orcamento",
        "assinatura_gerente",
      ],
      user_role: ["manager", "employee", "client"],
      work_order_priority: ["low", "medium", "high", "urgent"],
      work_order_service_type: [
        "repair",
        "maintenance",
        "installation",
        "warranty",
      ],
      work_order_status: [
        "pending",
        "approved",
        "in_progress",
        "completed",
        "cancelled",
        "awaiting_approval",
      ],
    },
  },
} as const

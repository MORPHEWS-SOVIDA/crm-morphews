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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_action_costs: {
        Row: {
          action_key: string
          action_name: string
          base_energy_cost: number
          created_at: string | null
          default_model_key: string | null
          description: string | null
          estimated_real_cost_usd: number | null
          id: string
          is_active: boolean | null
          is_fixed_cost: boolean | null
          updated_at: string | null
        }
        Insert: {
          action_key: string
          action_name: string
          base_energy_cost?: number
          created_at?: string | null
          default_model_key?: string | null
          description?: string | null
          estimated_real_cost_usd?: number | null
          id?: string
          is_active?: boolean | null
          is_fixed_cost?: boolean | null
          updated_at?: string | null
        }
        Update: {
          action_key?: string
          action_name?: string
          base_energy_cost?: number
          created_at?: string | null
          default_model_key?: string | null
          description?: string | null
          estimated_real_cost_usd?: number | null
          id?: string
          is_active?: boolean | null
          is_fixed_cost?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_bot_knowledge: {
        Row: {
          answer: string | null
          bot_id: string
          content_url: string | null
          created_at: string
          id: string
          is_active: boolean
          knowledge_type: string
          organization_id: string
          priority: number | null
          question: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          answer?: string | null
          bot_id: string
          content_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          knowledge_type: string
          organization_id: string
          priority?: number | null
          question?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          answer?: string | null
          bot_id?: string
          content_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          knowledge_type?: string
          organization_id?: string
          priority?: number | null
          question?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_bot_knowledge_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_knowledge_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_bot_products: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          organization_id: string
          product_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          organization_id: string
          product_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_bot_products_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_bot_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_bots: {
        Row: {
          age_range: string
          avatar_url: string | null
          brazilian_state: string | null
          company_differential: string | null
          created_at: string
          document_reply_message: string | null
          gender: string
          id: string
          image_reply_message: string | null
          initial_qualification_enabled: boolean | null
          initial_questions: Json | null
          interpret_audio: boolean
          interpret_documents: boolean
          interpret_images: boolean
          is_active: boolean
          max_energy_per_conversation: number | null
          max_energy_per_message: number | null
          max_messages_before_transfer: number | null
          name: string
          organization_id: string
          out_of_hours_message: string | null
          personality_description: string | null
          product_scope: string | null
          regional_expressions: string[] | null
          response_length: string
          service_type: string
          system_prompt: string
          transfer_keywords: string[] | null
          transfer_message: string | null
          transfer_on_confusion: boolean | null
          updated_at: string
          use_rag_search: boolean | null
          welcome_message: string | null
          working_days: number[] | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          age_range?: string
          avatar_url?: string | null
          brazilian_state?: string | null
          company_differential?: string | null
          created_at?: string
          document_reply_message?: string | null
          gender?: string
          id?: string
          image_reply_message?: string | null
          initial_qualification_enabled?: boolean | null
          initial_questions?: Json | null
          interpret_audio?: boolean
          interpret_documents?: boolean
          interpret_images?: boolean
          is_active?: boolean
          max_energy_per_conversation?: number | null
          max_energy_per_message?: number | null
          max_messages_before_transfer?: number | null
          name: string
          organization_id: string
          out_of_hours_message?: string | null
          personality_description?: string | null
          product_scope?: string | null
          regional_expressions?: string[] | null
          response_length?: string
          service_type?: string
          system_prompt?: string
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_on_confusion?: boolean | null
          updated_at?: string
          use_rag_search?: boolean | null
          welcome_message?: string | null
          working_days?: number[] | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          age_range?: string
          avatar_url?: string | null
          brazilian_state?: string | null
          company_differential?: string | null
          created_at?: string
          document_reply_message?: string | null
          gender?: string
          id?: string
          image_reply_message?: string | null
          initial_qualification_enabled?: boolean | null
          initial_questions?: Json | null
          interpret_audio?: boolean
          interpret_documents?: boolean
          interpret_images?: boolean
          is_active?: boolean
          max_energy_per_conversation?: number | null
          max_energy_per_message?: number | null
          max_messages_before_transfer?: number | null
          name?: string
          organization_id?: string
          out_of_hours_message?: string | null
          personality_description?: string | null
          product_scope?: string | null
          regional_expressions?: string[] | null
          response_length?: string
          service_type?: string
          system_prompt?: string
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_on_confusion?: boolean | null
          updated_at?: string
          use_rag_search?: boolean | null
          welcome_message?: string | null
          working_days?: number[] | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_bots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_costs: {
        Row: {
          created_at: string | null
          energy_per_1000_tokens: number | null
          energy_per_call: number | null
          fixed_cost_usd: number | null
          id: string
          input_cost_per_million_tokens: number | null
          is_active: boolean | null
          margin_multiplier: number | null
          max_context_tokens: number | null
          model_key: string
          model_name: string
          notes: string | null
          output_cost_per_million_tokens: number | null
          provider: string
          supports_audio: boolean | null
          supports_vision: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          energy_per_1000_tokens?: number | null
          energy_per_call?: number | null
          fixed_cost_usd?: number | null
          id?: string
          input_cost_per_million_tokens?: number | null
          is_active?: boolean | null
          margin_multiplier?: number | null
          max_context_tokens?: number | null
          model_key: string
          model_name: string
          notes?: string | null
          output_cost_per_million_tokens?: number | null
          provider?: string
          supports_audio?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          energy_per_1000_tokens?: number | null
          energy_per_call?: number | null
          fixed_cost_usd?: number | null
          id?: string
          input_cost_per_million_tokens?: number | null
          is_active?: boolean | null
          margin_multiplier?: number | null
          max_context_tokens?: number | null
          model_key?: string
          model_name?: string
          notes?: string | null
          output_cost_per_million_tokens?: number | null
          provider?: string
          supports_audio?: boolean | null
          supports_vision?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      carrier_tracking_statuses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          message_template: string | null
          organization_id: string
          position: number
          status_key: string
          updated_at: string
          webhook_url: string | null
          whatsapp_instance_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          organization_id: string
          position?: number
          status_key: string
          updated_at?: string
          webhook_url?: string | null
          whatsapp_instance_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          organization_id?: string
          position?: number
          status_key?: string
          updated_at?: string
          webhook_url?: string | null
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_tracking_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_tracking_statuses_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_tracking_statuses_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_identities: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          organization_id: string
          type: string
          value: string
          value_normalized: string
          verified_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          organization_id: string
          type: string
          value: string
          value_normalized: string
          verified_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          organization_id?: string
          type?: string
          value?: string
          value_normalized?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_identities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_identities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_activity_at: string | null
          metadata: Json | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      continuous_medications: {
        Row: {
          created_at: string
          id: string
          name: string
          normalized_name: string
          organization_id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          normalized_name: string
          organization_id: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
          organization_id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "continuous_medications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_satisfaction_ratings: {
        Row: {
          assigned_user_id: string | null
          closed_at: string
          conversation_id: string
          created_at: string
          id: string
          instance_id: string
          is_pending_review: boolean | null
          lead_id: string | null
          organization_id: string
          rating: number | null
          raw_response: string | null
          responded_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          closed_at?: string
          conversation_id: string
          created_at?: string
          id?: string
          instance_id: string
          is_pending_review?: boolean | null
          lead_id?: string | null
          organization_id: string
          rating?: number | null
          raw_response?: string | null
          responded_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          closed_at?: string
          conversation_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          is_pending_review?: boolean | null
          lead_id?: string | null
          organization_id?: string
          rating?: number | null
          raw_response?: string | null
          responded_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_satisfaction_ratings_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_satisfaction_ratings_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      delivery_region_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          id: string
          region_id: string
          shift: Database["public"]["Enums"]["delivery_shift"]
        }
        Insert: {
          created_at?: string
          day_of_week: number
          id?: string
          region_id: string
          shift?: Database["public"]["Enums"]["delivery_shift"]
        }
        Update: {
          created_at?: string
          day_of_week?: number
          id?: string
          region_id?: string
          shift?: Database["public"]["Enums"]["delivery_shift"]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_region_schedules_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "delivery_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_region_users: {
        Row: {
          created_at: string
          id: string
          region_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          region_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          region_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_region_users_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "delivery_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_regions: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_regions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_return_reasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_return_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          demand_id: string
          id: string
          notified_at: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          demand_id: string
          id?: string
          notified_at?: string | null
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          demand_id?: string
          id?: string
          notified_at?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_assignees_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_assignees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_attachments: {
        Row: {
          created_at: string
          demand_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demand_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          demand_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_attachments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_boards: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_boards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          demand_id: string
          id: string
          is_completed: boolean
          organization_id: string
          position: number
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          demand_id: string
          id?: string
          is_completed?: boolean
          organization_id: string
          position?: number
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          demand_id?: string
          id?: string
          is_completed?: boolean
          organization_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_checklist_items_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_checklist_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_columns: {
        Row: {
          board_id: string
          color: string | null
          created_at: string
          id: string
          is_final: boolean
          name: string
          organization_id: string
          position: number
          updated_at: string
        }
        Insert: {
          board_id: string
          color?: string | null
          created_at?: string
          id?: string
          is_final?: boolean
          name: string
          organization_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          board_id?: string
          color?: string | null
          created_at?: string
          id?: string
          is_final?: boolean
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "demand_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_columns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_comments: {
        Row: {
          content: string
          created_at: string
          demand_id: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          demand_id: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          demand_id?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_comments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_history: {
        Row: {
          action: string
          created_at: string
          demand_id: string
          id: string
          new_value: Json | null
          old_value: Json | null
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          demand_id: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          demand_id?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_history_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_label_assignments: {
        Row: {
          created_at: string
          demand_id: string
          id: string
          label_id: string
        }
        Insert: {
          created_at?: string
          demand_id: string
          id?: string
          label_id: string
        }
        Update: {
          created_at?: string
          demand_id?: string
          id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_label_assignments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "demand_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_sla_config: {
        Row: {
          created_at: string
          hours: number
          id: string
          organization_id: string
          updated_at: string
          urgency: string
        }
        Insert: {
          created_at?: string
          hours?: number
          id?: string
          organization_id: string
          updated_at?: string
          urgency: string
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          organization_id?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_sla_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_time_entries: {
        Row: {
          created_at: string
          demand_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          organization_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          demand_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          demand_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_time_entries_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          board_id: string
          column_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          estimated_time_seconds: number | null
          id: string
          is_archived: boolean
          lead_id: string | null
          organization_id: string
          position: number
          sla_deadline: string | null
          title: string
          total_time_seconds: number
          updated_at: string
          urgency: string
        }
        Insert: {
          board_id: string
          column_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          estimated_time_seconds?: number | null
          id?: string
          is_archived?: boolean
          lead_id?: string | null
          organization_id: string
          position?: number
          sla_deadline?: string | null
          title: string
          total_time_seconds?: number
          updated_at?: string
          urgency?: string
        }
        Update: {
          board_id?: string
          column_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          estimated_time_seconds?: number | null
          id?: string
          is_archived?: boolean
          lead_id?: string | null
          organization_id?: string
          position?: number
          sla_deadline?: string | null
          title?: string
          total_time_seconds?: number
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "demands_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "demand_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "demand_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_authorizations: {
        Row: {
          authorization_code: string
          authorized_price_cents: number
          authorizer_user_id: string
          created_at: string
          discount_amount_cents: number
          id: string
          minimum_price_cents: number
          organization_id: string
          product_id: string
          sale_id: string | null
          sale_item_id: string | null
          seller_user_id: string
        }
        Insert: {
          authorization_code: string
          authorized_price_cents: number
          authorizer_user_id: string
          created_at?: string
          discount_amount_cents: number
          id?: string
          minimum_price_cents: number
          organization_id: string
          product_id: string
          sale_id?: string | null
          sale_item_id?: string | null
          seller_user_id: string
        }
        Update: {
          authorization_code?: string
          authorized_price_cents?: number
          authorizer_user_id?: string
          created_at?: string
          discount_amount_cents?: number
          id?: string
          minimum_price_cents?: number
          organization_id?: string
          product_id?: string
          sale_id?: string | null
          sale_item_id?: string | null
          seller_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_authorizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_authorizations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_authorizations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_authorizations_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "manipulated_sale_items_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_authorizations_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_uses: number
          discount_value_cents: number
          id: string
          is_active: boolean
          max_uses: number | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          discount_value_cents?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_uses?: number
          discount_value_cents?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          valid_until?: string | null
        }
        Relationships: []
      }
      energy_usage_log: {
        Row: {
          action_type: string
          bot_id: string | null
          conversation_id: string | null
          created_at: string
          details: Json | null
          energy_consumed: number
          id: string
          model_used: string | null
          organization_id: string
          real_cost_usd: number | null
          tokens_used: number | null
        }
        Insert: {
          action_type: string
          bot_id?: string | null
          conversation_id?: string | null
          created_at?: string
          details?: Json | null
          energy_consumed: number
          id?: string
          model_used?: string | null
          organization_id: string
          real_cost_usd?: number | null
          tokens_used?: number | null
        }
        Update: {
          action_type?: string
          bot_id?: string | null
          conversation_id?: string | null
          created_at?: string
          details?: Json | null
          energy_consumed?: number
          id?: string
          model_used?: string | null
          organization_id?: string
          real_cost_usd?: number | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "energy_usage_log_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "energy_usage_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string
          error_type: string
          id: string
          organization_id: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message: string
          error_type: string
          id?: string
          organization_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string
          error_type?: string
          id?: string
          organization_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installment_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          installment_id: string
          new_status: string
          notes: string | null
          organization_id: string
          previous_status: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          installment_id: string
          new_status: string
          notes?: string | null
          organization_id: string
          previous_status?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          installment_id?: string
          new_status?: string
          notes?: string | null
          organization_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_history_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "sale_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_bot_schedules: {
        Row: {
          bot_id: string
          created_at: string
          days_of_week: number[]
          end_time: string
          id: string
          instance_id: string
          is_active: boolean
          organization_id: string
          priority: number
          start_time: string
          updated_at: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          id?: string
          instance_id: string
          is_active?: boolean
          organization_id: string
          priority?: number
          start_time?: string
          updated_at?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          organization_id?: string
          priority?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_bot_schedules_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_bot_schedules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_bot_schedules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_bot_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_events: {
        Row: {
          created_at: string
          event_type: string
          headers: Json | null
          id: string
          integration_id: string
          is_active: boolean
          method: string
          organization_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          event_type: string
          headers?: Json | null
          id?: string
          integration_id: string
          is_active?: boolean
          method?: string
          organization_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          event_type?: string
          headers?: Json | null
          id?: string
          integration_id?: string
          is_active?: boolean
          method?: string
          organization_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_field_mappings: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          organization_id: string
          source_field: string
          target_field: string
          transform_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          organization_id: string
          source_field: string
          target_field: string
          transform_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          organization_id?: string
          source_field?: string
          target_field?: string
          transform_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_field_mappings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_field_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          direction: string
          error_message: string | null
          event_type: string | null
          id: string
          integration_id: string
          lead_id: string | null
          organization_id: string
          processing_time_ms: number | null
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          integration_id: string
          lead_id?: string | null
          organization_id: string
          processing_time_ms?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          direction?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          integration_id?: string
          lead_id?: string | null
          organization_id?: string
          processing_time_ms?: number | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_token: string
          auto_followup_days: number | null
          created_at: string
          created_by: string | null
          default_product_id: string | null
          default_responsible_user_ids: string[] | null
          default_stage: string | null
          description: string | null
          event_mode: string | null
          id: string
          name: string
          non_purchase_reason_id: string | null
          organization_id: string
          sac_category: string | null
          sac_default_description: string | null
          sac_priority: string | null
          sac_subcategory: string | null
          sale_status_on_create: string | null
          sale_tag: string | null
          settings: Json | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          auth_token?: string
          auto_followup_days?: number | null
          created_at?: string
          created_by?: string | null
          default_product_id?: string | null
          default_responsible_user_ids?: string[] | null
          default_stage?: string | null
          description?: string | null
          event_mode?: string | null
          id?: string
          name: string
          non_purchase_reason_id?: string | null
          organization_id: string
          sac_category?: string | null
          sac_default_description?: string | null
          sac_priority?: string | null
          sac_subcategory?: string | null
          sale_status_on_create?: string | null
          sale_tag?: string | null
          settings?: Json | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          auth_token?: string
          auto_followup_days?: number | null
          created_at?: string
          created_by?: string | null
          default_product_id?: string | null
          default_responsible_user_ids?: string[] | null
          default_stage?: string | null
          description?: string | null
          event_mode?: string | null
          id?: string
          name?: string
          non_purchase_reason_id?: string | null
          organization_id?: string
          sac_category?: string | null
          sac_default_description?: string | null
          sac_priority?: string | null
          sac_subcategory?: string | null
          sale_status_on_create?: string | null
          sale_tag?: string | null
          settings?: Json | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_default_product_id_fkey"
            columns: ["default_product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_non_purchase_reason_id_fkey"
            columns: ["non_purchase_reason_id"]
            isOneToOne: false
            referencedRelation: "non_purchase_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interested_leads: {
        Row: {
          converted_at: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          plan_id: string | null
          plan_name: string | null
          status: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          plan_id?: string | null
          plan_name?: string | null
          status?: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          plan_id?: string | null
          plan_name?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "interested_leads_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interested_leads_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_addresses: {
        Row: {
          cep: string | null
          city: string | null
          complement: string | null
          created_at: string
          delivery_notes: string | null
          delivery_region_id: string | null
          google_maps_link: string | null
          id: string
          is_primary: boolean
          label: string
          lead_id: string
          neighborhood: string | null
          organization_id: string
          state: string | null
          street: string | null
          street_number: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_region_id?: string | null
          google_maps_link?: string | null
          id?: string
          is_primary?: boolean
          label?: string
          lead_id: string
          neighborhood?: string | null
          organization_id: string
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_region_id?: string | null
          google_maps_link?: string | null
          id?: string
          is_primary?: boolean
          label?: string
          lead_id?: string
          neighborhood?: string | null
          organization_id?: string
          state?: string | null
          street?: string | null
          street_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_addresses_delivery_region_id_fkey"
            columns: ["delivery_region_id"]
            isOneToOne: false
            referencedRelation: "delivery_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_addresses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ai_preferences: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          last_observed_at: string
          lead_id: string
          observation_count: number | null
          organization_id: string
          preference_key: string
          preference_type: string
          preference_value: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_observed_at?: string
          lead_id: string
          observation_count?: number | null
          organization_id: string
          preference_key: string
          preference_type: string
          preference_value: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          last_observed_at?: string
          lead_id?: string
          observation_count?: number | null
          organization_id?: string
          preference_key?: string
          preference_type?: string
          preference_value?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_ai_preferences_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversation_summaries: {
        Row: {
          action_items: string[] | null
          conversation_id: string | null
          created_at: string
          energy_consumed: number | null
          id: string
          key_topics: string[] | null
          lead_id: string
          next_steps: string | null
          organization_id: string
          sentiment: string | null
          summary_text: string
        }
        Insert: {
          action_items?: string[] | null
          conversation_id?: string | null
          created_at?: string
          energy_consumed?: number | null
          id?: string
          key_topics?: string[] | null
          lead_id: string
          next_steps?: string | null
          organization_id: string
          sentiment?: string | null
          summary_text: string
        }
        Update: {
          action_items?: string[] | null
          conversation_id?: string | null
          created_at?: string
          energy_consumed?: number | null
          id?: string
          key_topics?: string[] | null
          lead_id?: string
          next_steps?: string | null
          organization_id?: string
          sentiment?: string | null
          summary_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_summaries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_summaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_custom_field_definitions: {
        Row: {
          created_at: string
          field_label: string
          field_name: string
          field_type: string
          id: string
          is_active: boolean | null
          is_required: boolean | null
          organization_id: string
          position: number | null
          updated_at: string
          webhook_alias: string | null
        }
        Insert: {
          created_at?: string
          field_label: string
          field_name: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          organization_id: string
          position?: number | null
          updated_at?: string
          webhook_alias?: string | null
        }
        Update: {
          created_at?: string
          field_label?: string
          field_name?: string
          field_type?: string
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          organization_id?: string
          position?: number | null
          updated_at?: string
          webhook_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_custom_field_values: {
        Row: {
          created_at: string
          field_definition_id: string
          id: string
          lead_id: string
          organization_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_definition_id: string
          id?: string
          lead_id: string
          organization_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_definition_id?: string
          id?: string
          lead_id?: string
          organization_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "lead_custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_custom_field_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          google_event_id: string | null
          id: string
          lead_id: string
          location: string | null
          meeting_link: string | null
          organization_id: string | null
          start_time: string
          synced_to_google: boolean | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          google_event_id?: string | null
          id?: string
          lead_id: string
          location?: string | null
          meeting_link?: string | null
          organization_id?: string | null
          start_time: string
          synced_to_google?: boolean | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          google_event_id?: string | null
          id?: string
          lead_id?: string
          location?: string | null
          meeting_link?: string | null
          organization_id?: string | null
          start_time?: string
          synced_to_google?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          organization_id: string
          reason: string | null
          result: string | null
          scheduled_at: string
          source_id: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          organization_id: string
          reason?: string | null
          result?: string | null
          scheduled_at: string
          source_id?: string | null
          source_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          organization_id?: string
          reason?: string | null
          result?: string | null
          scheduled_at?: string
          source_id?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_followups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_kit_rejections: {
        Row: {
          created_at: string
          id: string
          kit_id: string
          kit_price_cents: number
          kit_quantity: number
          lead_id: string
          organization_id: string
          product_id: string
          rejected_by: string
          rejection_reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          kit_id: string
          kit_price_cents: number
          kit_quantity: number
          lead_id: string
          organization_id: string
          product_id: string
          rejected_by: string
          rejection_reason: string
        }
        Update: {
          created_at?: string
          id?: string
          kit_id?: string
          kit_price_cents?: number
          kit_quantity?: number
          lead_id?: string
          organization_id?: string
          product_id?: string
          rejected_by?: string
          rejection_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_kit_rejections_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "product_price_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_kit_rejections_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_kit_rejections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_kit_rejections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ownership_transfers: {
        Row: {
          created_at: string
          from_user_id: string | null
          id: string
          lead_id: string
          notes: string | null
          organization_id: string
          to_user_id: string
          transfer_reason: string
          transferred_by: string
        }
        Insert: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          organization_id: string
          to_user_id: string
          transfer_reason: string
          transferred_by: string
        }
        Update: {
          created_at?: string
          from_user_id?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          organization_id?: string
          to_user_id?: string
          transfer_reason?: string
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_ownership_transfers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ownership_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_product_answers: {
        Row: {
          answer_1: string | null
          answer_2: string | null
          answer_3: string | null
          created_at: string
          id: string
          lead_id: string
          organization_id: string
          product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answer_1?: string | null
          answer_2?: string | null
          answer_3?: string | null
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
          product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answer_1?: string | null
          answer_2?: string | null
          answer_3?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_product_answers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_answers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_product_question_answers: {
        Row: {
          answer_text: string | null
          created_at: string
          id: string
          lead_id: string
          organization_id: string
          product_id: string
          question_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
          product_id: string
          question_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          product_id?: string
          question_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_product_question_answers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_question_answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_question_answers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "product_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_products: {
        Row: {
          barcode_ean: string | null
          brand_id: string | null
          category: string
          cost_cents: number | null
          created_at: string
          crosssell_product_1_id: string | null
          crosssell_product_2_id: string | null
          depth_cm: number | null
          description: string | null
          gross_weight_grams: number | null
          gtin_tax: string | null
          height_cm: number | null
          hot_site_url: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          key_question_1: string | null
          key_question_2: string | null
          key_question_3: string | null
          label_image_url: string | null
          minimum_price: number | null
          minimum_stock: number | null
          name: string
          net_weight_grams: number | null
          organization_id: string | null
          price_1_unit: number | null
          price_12_units: number | null
          price_3_units: number | null
          price_6_units: number | null
          restrict_to_users: boolean
          sales_script: string | null
          sku: string | null
          stock_quantity: number | null
          stock_reserved: number | null
          track_stock: boolean | null
          unit: string | null
          updated_at: string | null
          usage_period_days: number | null
          width_cm: number | null
          youtube_video_url: string | null
        }
        Insert: {
          barcode_ean?: string | null
          brand_id?: string | null
          category?: string
          cost_cents?: number | null
          created_at?: string
          crosssell_product_1_id?: string | null
          crosssell_product_2_id?: string | null
          depth_cm?: number | null
          description?: string | null
          gross_weight_grams?: number | null
          gtin_tax?: string | null
          height_cm?: number | null
          hot_site_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          key_question_1?: string | null
          key_question_2?: string | null
          key_question_3?: string | null
          label_image_url?: string | null
          minimum_price?: number | null
          minimum_stock?: number | null
          name: string
          net_weight_grams?: number | null
          organization_id?: string | null
          price_1_unit?: number | null
          price_12_units?: number | null
          price_3_units?: number | null
          price_6_units?: number | null
          restrict_to_users?: boolean
          sales_script?: string | null
          sku?: string | null
          stock_quantity?: number | null
          stock_reserved?: number | null
          track_stock?: boolean | null
          unit?: string | null
          updated_at?: string | null
          usage_period_days?: number | null
          width_cm?: number | null
          youtube_video_url?: string | null
        }
        Update: {
          barcode_ean?: string | null
          brand_id?: string | null
          category?: string
          cost_cents?: number | null
          created_at?: string
          crosssell_product_1_id?: string | null
          crosssell_product_2_id?: string | null
          depth_cm?: number | null
          description?: string | null
          gross_weight_grams?: number | null
          gtin_tax?: string | null
          height_cm?: number | null
          hot_site_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          key_question_1?: string | null
          key_question_2?: string | null
          key_question_3?: string | null
          label_image_url?: string | null
          minimum_price?: number | null
          minimum_stock?: number | null
          name?: string
          net_weight_grams?: number | null
          organization_id?: string | null
          price_1_unit?: number | null
          price_12_units?: number | null
          price_3_units?: number | null
          price_6_units?: number | null
          restrict_to_users?: boolean
          sales_script?: string | null
          sku?: string | null
          stock_quantity?: number | null
          stock_reserved?: number | null
          track_stock?: boolean | null
          unit?: string | null
          updated_at?: string | null
          usage_period_days?: number | null
          width_cm?: number | null
          youtube_video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_crosssell_product_1_id_fkey"
            columns: ["crosssell_product_1_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_crosssell_product_2_id_fkey"
            columns: ["crosssell_product_2_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_responsibles: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_responsibles_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scheduled_messages: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          failure_reason: string | null
          fallback_bot_enabled: boolean | null
          fallback_bot_id: string | null
          fallback_status: string | null
          fallback_timeout_minutes: number | null
          fallback_triggered_at: string | null
          final_message: string
          id: string
          lead_id: string
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          organization_id: string
          original_scheduled_at: string
          scheduled_at: string
          sent_at: string | null
          status: string
          template_id: string | null
          updated_at: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          failure_reason?: string | null
          fallback_bot_enabled?: boolean | null
          fallback_bot_id?: string | null
          fallback_status?: string | null
          fallback_timeout_minutes?: number | null
          fallback_triggered_at?: string | null
          final_message: string
          id?: string
          lead_id: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          organization_id: string
          original_scheduled_at: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          failure_reason?: string | null
          fallback_bot_enabled?: boolean | null
          fallback_bot_id?: string | null
          fallback_status?: string | null
          fallback_timeout_minutes?: number | null
          fallback_triggered_at?: string | null
          final_message?: string
          id?: string
          lead_id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          organization_id?: string
          original_scheduled_at?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_scheduled_messages_fallback_bot_id_fkey"
            columns: ["fallback_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "non_purchase_message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_messages_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scheduled_messages_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_source_history: {
        Row: {
          id: string
          lead_id: string
          notes: string | null
          organization_id: string
          recorded_at: string
          recorded_by: string | null
          source_id: string
        }
        Insert: {
          id?: string
          lead_id: string
          notes?: string | null
          organization_id: string
          recorded_at?: string
          recorded_by?: string | null
          source_id: string
        }
        Update: {
          id?: string
          lead_id?: string
          notes?: string | null
          organization_id?: string
          recorded_at?: string
          recorded_by?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_source_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_source_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_source_history_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          lead_id: string
          organization_id: string
          previous_stage: Database["public"]["Enums"]["funnel_stage"] | null
          reason: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id: string
          organization_id: string
          previous_stage?: Database["public"]["Enums"]["funnel_stage"] | null
          reason?: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          previous_stage?: Database["public"]["Enums"]["funnel_stage"] | null
          reason?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_standard_question_answers: {
        Row: {
          answered_by: string | null
          created_at: string
          id: string
          imc_age: number | null
          imc_category: string | null
          imc_height: number | null
          imc_result: number | null
          imc_weight: number | null
          lead_id: string
          numeric_value: number | null
          organization_id: string
          question_id: string
          selected_option_ids: string[] | null
          text_value: string | null
          updated_at: string
        }
        Insert: {
          answered_by?: string | null
          created_at?: string
          id?: string
          imc_age?: number | null
          imc_category?: string | null
          imc_height?: number | null
          imc_result?: number | null
          imc_weight?: number | null
          lead_id: string
          numeric_value?: number | null
          organization_id: string
          question_id: string
          selected_option_ids?: string[] | null
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          answered_by?: string | null
          created_at?: string
          id?: string
          imc_age?: number | null
          imc_category?: string | null
          imc_height?: number | null
          imc_result?: number | null
          imc_weight?: number | null
          lead_id?: string
          numeric_value?: number | null
          organization_id?: string
          question_id?: string
          selected_option_ids?: string[] | null
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_standard_question_answers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_standard_question_answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_standard_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "standard_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_webhook_history: {
        Row: {
          error_message: string | null
          id: string
          integration_id: string | null
          integration_name: string | null
          lead_id: string
          organization_id: string
          payload: Json
          processed_successfully: boolean | null
          received_at: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          integration_id?: string | null
          integration_name?: string | null
          lead_id: string
          organization_id: string
          payload: Json
          processed_successfully?: boolean | null
          received_at?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          integration_id?: string | null
          integration_name?: string | null
          lead_id?: string
          organization_id?: string
          payload?: Json
          processed_successfully?: boolean | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_webhook_history_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_webhook_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_webhook_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string
          birth_date: string | null
          cep: string | null
          city: string | null
          complement: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          delivery_notes: string | null
          delivery_region_id: string | null
          desired_products: string | null
          email: string | null
          favorite_team: string | null
          followers: number | null
          gender: string | null
          google_maps_link: string | null
          id: string
          instagram: string | null
          lead_source: string | null
          linkedin: string | null
          meeting_date: string | null
          meeting_link: string | null
          meeting_time: string | null
          name: string
          negotiated_value: number | null
          neighborhood: string | null
          observations: string | null
          organization_id: string | null
          paid_value: number | null
          products: string[] | null
          recorded_call_link: string | null
          secondary_phone: string | null
          site: string | null
          specialty: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
          stars: number
          state: string | null
          street: string | null
          street_number: string | null
          tiktok: string | null
          updated_at: string
          webhook_data: Json | null
          whatsapp: string
          whatsapp_group: string | null
        }
        Insert: {
          assigned_to: string
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          delivery_region_id?: string | null
          desired_products?: string | null
          email?: string | null
          favorite_team?: string | null
          followers?: number | null
          gender?: string | null
          google_maps_link?: string | null
          id?: string
          instagram?: string | null
          lead_source?: string | null
          linkedin?: string | null
          meeting_date?: string | null
          meeting_link?: string | null
          meeting_time?: string | null
          name: string
          negotiated_value?: number | null
          neighborhood?: string | null
          observations?: string | null
          organization_id?: string | null
          paid_value?: number | null
          products?: string[] | null
          recorded_call_link?: string | null
          secondary_phone?: string | null
          site?: string | null
          specialty?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          stars?: number
          state?: string | null
          street?: string | null
          street_number?: string | null
          tiktok?: string | null
          updated_at?: string
          webhook_data?: Json | null
          whatsapp: string
          whatsapp_group?: string | null
        }
        Update: {
          assigned_to?: string
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          delivery_notes?: string | null
          delivery_region_id?: string | null
          desired_products?: string | null
          email?: string | null
          favorite_team?: string | null
          followers?: number | null
          gender?: string | null
          google_maps_link?: string | null
          id?: string
          instagram?: string | null
          lead_source?: string | null
          linkedin?: string | null
          meeting_date?: string | null
          meeting_link?: string | null
          meeting_time?: string | null
          name?: string
          negotiated_value?: number | null
          neighborhood?: string | null
          observations?: string | null
          organization_id?: string | null
          paid_value?: number | null
          products?: string[] | null
          recorded_call_link?: string | null
          secondary_phone?: string | null
          site?: string | null
          specialty?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          stars?: number
          state?: string | null
          street?: string | null
          street_number?: string | null
          tiktok?: string | null
          updated_at?: string
          webhook_data?: Json | null
          whatsapp?: string
          whatsapp_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_delivery_region_id_fkey"
            columns: ["delivery_region_id"]
            isOneToOne: false
            referencedRelation: "delivery_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      motoboy_tracking_statuses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          message_template: string | null
          organization_id: string
          position: number
          status_key: string
          updated_at: string
          webhook_url: string | null
          whatsapp_instance_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          organization_id: string
          position?: number
          status_key: string
          updated_at?: string
          webhook_url?: string | null
          whatsapp_instance_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          organization_id?: string
          position?: number
          status_key?: string
          updated_at?: string
          webhook_url?: string | null
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motoboy_tracking_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motoboy_tracking_statuses_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motoboy_tracking_statuses_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      non_purchase_message_templates: {
        Row: {
          created_at: string
          delay_minutes: number
          fallback_bot_enabled: boolean | null
          fallback_bot_id: string | null
          fallback_timeout_minutes: number | null
          id: string
          is_active: boolean
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          message_template: string
          non_purchase_reason_id: string
          organization_id: string
          position: number
          send_end_hour: number | null
          send_start_hour: number | null
          updated_at: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          created_at?: string
          delay_minutes?: number
          fallback_bot_enabled?: boolean | null
          fallback_bot_id?: string | null
          fallback_timeout_minutes?: number | null
          id?: string
          is_active?: boolean
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template: string
          non_purchase_reason_id: string
          organization_id: string
          position?: number
          send_end_hour?: number | null
          send_start_hour?: number | null
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          created_at?: string
          delay_minutes?: number
          fallback_bot_enabled?: boolean | null
          fallback_bot_id?: string | null
          fallback_timeout_minutes?: number | null
          id?: string
          is_active?: boolean
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string
          non_purchase_reason_id?: string
          organization_id?: string
          position?: number
          send_end_hour?: number | null
          send_start_hour?: number | null
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_purchase_message_templates_fallback_bot_id_fkey"
            columns: ["fallback_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_purchase_message_templates_non_purchase_reason_id_fkey"
            columns: ["non_purchase_reason_id"]
            isOneToOne: false
            referencedRelation: "non_purchase_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_purchase_message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_purchase_message_templates_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_purchase_message_templates_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      non_purchase_reasons: {
        Row: {
          created_at: string
          exclusivity_hours: number | null
          followup_hours: number | null
          followup_webhook_url: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          lead_visibility: string
          name: string
          organization_id: string
          position: number
          target_stage_id: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          exclusivity_hours?: number | null
          followup_hours?: number | null
          followup_webhook_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          lead_visibility?: string
          name: string
          organization_id: string
          position?: number
          target_stage_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          exclusivity_hours?: number | null
          followup_hours?: number | null
          followup_webhook_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          lead_visibility?: string
          name?: string
          organization_id?: string
          position?: number
          target_stage_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_purchase_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_purchase_reasons_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_data: {
        Row: {
          business_description: string | null
          cnpj: string | null
          company_site: string | null
          completed_at: string | null
          created_at: string
          crm_usage_intent: string | null
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_description?: string | null
          cnpj?: string | null
          company_site?: string | null
          completed_at?: string | null
          created_at?: string
          crm_usage_intent?: string | null
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_description?: string | null
          cnpj?: string | null
          company_site?: string | null
          completed_at?: string | null
          created_at?: string
          crm_usage_intent?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_energy: {
        Row: {
          bonus_energy: number
          created_at: string
          id: string
          included_energy: number
          organization_id: string
          reset_at: string
          updated_at: string
          used_energy: number
        }
        Insert: {
          bonus_energy?: number
          created_at?: string
          id?: string
          included_energy?: number
          organization_id: string
          reset_at?: string
          updated_at?: string
          used_energy?: number
        }
        Update: {
          bonus_energy?: number
          created_at?: string
          id?: string
          included_energy?: number
          organization_id?: string
          reset_at?: string
          updated_at?: string
          used_energy?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_energy_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_feature_overrides: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          organization_id: string
          overridden_by: string | null
          override_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled: boolean
          organization_id: string
          overridden_by?: string | null
          override_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          overridden_by?: string | null
          override_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_feature_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_funnel_stages: {
        Row: {
          color: string
          created_at: string
          enum_value: Database["public"]["Enums"]["funnel_stage"] | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          position: number
          requires_contact: boolean
          stage_type: string
          text_color: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          enum_value?: Database["public"]["Enums"]["funnel_stage"] | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          position: number
          requires_contact?: boolean
          stage_type?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          enum_value?: Database["public"]["Enums"]["funnel_stage"] | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          position?: number
          requires_contact?: boolean
          stage_type?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_funnel_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          can_see_all_leads: boolean
          commission_percentage: number | null
          created_at: string
          earns_team_commission: boolean
          extension: string | null
          id: string
          is_sales_manager: boolean
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          team_commission_percentage: number | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          can_see_all_leads?: boolean
          commission_percentage?: number | null
          created_at?: string
          earns_team_commission?: boolean
          extension?: string | null
          id?: string
          is_sales_manager?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          team_commission_percentage?: number | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          can_see_all_leads?: boolean
          commission_percentage?: number | null
          created_at?: string
          earns_team_commission?: boolean
          extension?: string | null
          id?: string
          is_sales_manager?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          team_commission_percentage?: number | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_whatsapp_credits: {
        Row: {
          created_at: string
          free_instances_count: number
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          free_instances_count?: number
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          free_instances_count?: number
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_whatsapp_credits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_whatsapp_providers: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          organization_id: string
          price_cents: number
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id: string
          price_cents?: number
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          price_cents?: number
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_whatsapp_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          auto_close_assigned_minutes: number | null
          auto_close_bot_minutes: number | null
          auto_close_business_end: string | null
          auto_close_business_start: string | null
          auto_close_enabled: boolean | null
          auto_close_message_template: string | null
          auto_close_only_business_hours: boolean | null
          auto_close_send_message: boolean | null
          created_at: string
          id: string
          name: string
          owner_email: string | null
          owner_name: string | null
          phone: string | null
          receptive_module_enabled: boolean
          satisfaction_survey_enabled: boolean | null
          satisfaction_survey_message: string | null
          satisfaction_survey_on_manual_close: boolean | null
          slug: string
          updated_at: string
          whatsapp_ai_learning_enabled: boolean
          whatsapp_ai_memory_enabled: boolean
          whatsapp_ai_seller_briefing_enabled: boolean
          whatsapp_audio_transcription_enabled: boolean
          whatsapp_dms_enabled: boolean
          whatsapp_document_auto_reply_message: string | null
          whatsapp_document_medical_mode: boolean | null
          whatsapp_document_reading_enabled: boolean
          whatsapp_image_interpretation: boolean | null
          whatsapp_image_medical_mode: boolean | null
          whatsapp_sender_name_prefix_enabled: boolean
        }
        Insert: {
          auto_close_assigned_minutes?: number | null
          auto_close_bot_minutes?: number | null
          auto_close_business_end?: string | null
          auto_close_business_start?: string | null
          auto_close_enabled?: boolean | null
          auto_close_message_template?: string | null
          auto_close_only_business_hours?: boolean | null
          auto_close_send_message?: boolean | null
          created_at?: string
          id?: string
          name: string
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          receptive_module_enabled?: boolean
          satisfaction_survey_enabled?: boolean | null
          satisfaction_survey_message?: string | null
          satisfaction_survey_on_manual_close?: boolean | null
          slug: string
          updated_at?: string
          whatsapp_ai_learning_enabled?: boolean
          whatsapp_ai_memory_enabled?: boolean
          whatsapp_ai_seller_briefing_enabled?: boolean
          whatsapp_audio_transcription_enabled?: boolean
          whatsapp_dms_enabled?: boolean
          whatsapp_document_auto_reply_message?: string | null
          whatsapp_document_medical_mode?: boolean | null
          whatsapp_document_reading_enabled?: boolean
          whatsapp_image_interpretation?: boolean | null
          whatsapp_image_medical_mode?: boolean | null
          whatsapp_sender_name_prefix_enabled?: boolean
        }
        Update: {
          auto_close_assigned_minutes?: number | null
          auto_close_bot_minutes?: number | null
          auto_close_business_end?: string | null
          auto_close_business_start?: string | null
          auto_close_enabled?: boolean | null
          auto_close_message_template?: string | null
          auto_close_only_business_hours?: boolean | null
          auto_close_send_message?: boolean | null
          created_at?: string
          id?: string
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          receptive_module_enabled?: boolean
          satisfaction_survey_enabled?: boolean | null
          satisfaction_survey_message?: string | null
          satisfaction_survey_on_manual_close?: boolean | null
          slug?: string
          updated_at?: string
          whatsapp_ai_learning_enabled?: boolean
          whatsapp_ai_memory_enabled?: boolean
          whatsapp_ai_seller_briefing_enabled?: boolean
          whatsapp_audio_transcription_enabled?: boolean
          whatsapp_dms_enabled?: boolean
          whatsapp_document_auto_reply_message?: string | null
          whatsapp_document_medical_mode?: boolean | null
          whatsapp_document_reading_enabled?: boolean
          whatsapp_image_interpretation?: boolean | null
          whatsapp_image_medical_mode?: boolean | null
          whatsapp_sender_name_prefix_enabled?: boolean
        }
        Relationships: []
      }
      payment_acquirers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_acquirers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_bank_destinations: {
        Row: {
          created_at: string
          id: string
          name: string
          normalized_name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          normalized_name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_bank_destinations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_cnpj_destinations: {
        Row: {
          cnpj: string
          created_at: string
          id: string
          normalized_cnpj: string
          organization_id: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          id?: string
          normalized_cnpj: string
          organization_id: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          id?: string
          normalized_cnpj?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_cnpj_destinations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_cost_centers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_cost_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_transaction_fees: {
        Row: {
          created_at: string
          fee_fixed_cents: number
          fee_percentage: number
          id: string
          is_enabled: boolean
          organization_id: string
          payment_method_id: string
          settlement_days: number
          transaction_type: Database["public"]["Enums"]["card_transaction_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_fixed_cents?: number
          fee_percentage?: number
          id?: string
          is_enabled?: boolean
          organization_id: string
          payment_method_id: string
          settlement_days?: number
          transaction_type: Database["public"]["Enums"]["card_transaction_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_fixed_cents?: number
          fee_percentage?: number
          id?: string
          is_enabled?: boolean
          organization_id?: string
          payment_method_id?: string
          settlement_days?: number
          transaction_type?: Database["public"]["Enums"]["card_transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_transaction_fees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_method_transaction_fees_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          acquirer_id: string | null
          anticipation_fee_percentage: number | null
          bank_destination_id: string | null
          category: Database["public"]["Enums"]["payment_category"] | null
          cnpj_destination_id: string | null
          cost_center_id: string | null
          created_at: string
          destination_bank: string | null
          destination_cnpj: string | null
          display_order: number | null
          fee_fixed_cents: number | null
          fee_percentage: number | null
          id: string
          installment_flow:
            | Database["public"]["Enums"]["installment_flow"]
            | null
          is_active: boolean | null
          max_installments: number | null
          min_installment_value_cents: number | null
          name: string
          organization_id: string
          payment_timing: string
          requires_proof: boolean | null
          requires_transaction_data: boolean | null
          settlement_days: number | null
          updated_at: string
        }
        Insert: {
          acquirer_id?: string | null
          anticipation_fee_percentage?: number | null
          bank_destination_id?: string | null
          category?: Database["public"]["Enums"]["payment_category"] | null
          cnpj_destination_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          destination_bank?: string | null
          destination_cnpj?: string | null
          display_order?: number | null
          fee_fixed_cents?: number | null
          fee_percentage?: number | null
          id?: string
          installment_flow?:
            | Database["public"]["Enums"]["installment_flow"]
            | null
          is_active?: boolean | null
          max_installments?: number | null
          min_installment_value_cents?: number | null
          name: string
          organization_id: string
          payment_timing?: string
          requires_proof?: boolean | null
          requires_transaction_data?: boolean | null
          settlement_days?: number | null
          updated_at?: string
        }
        Update: {
          acquirer_id?: string | null
          anticipation_fee_percentage?: number | null
          bank_destination_id?: string | null
          category?: Database["public"]["Enums"]["payment_category"] | null
          cnpj_destination_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          destination_bank?: string | null
          destination_cnpj?: string | null
          display_order?: number | null
          fee_fixed_cents?: number | null
          fee_percentage?: number | null
          id?: string
          installment_flow?:
            | Database["public"]["Enums"]["installment_flow"]
            | null
          is_active?: boolean | null
          max_installments?: number | null
          min_installment_value_cents?: number | null
          name?: string
          organization_id?: string
          payment_timing?: string
          requires_proof?: boolean | null
          requires_transaction_data?: boolean | null
          settlement_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_acquirer_id_fkey"
            columns: ["acquirer_id"]
            isOneToOne: false
            referencedRelation: "payment_acquirers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_bank_destination_id_fkey"
            columns: ["bank_destination_id"]
            isOneToOne: false
            referencedRelation: "payment_bank_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_cnpj_destination_id_fkey"
            columns: ["cnpj_destination_id"]
            isOneToOne: false
            referencedRelation: "payment_cnpj_destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "payment_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          plan_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          plan_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans_public"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_surveys: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          completed_by: string | null
          continuous_medication_details: string | null
          created_at: string
          delivery_rating: number | null
          delivery_type: string | null
          id: string
          knows_how_to_use: boolean | null
          lead_id: string
          notes: string | null
          organization_id: string
          received_order: boolean | null
          sale_id: string
          seller_rating: number | null
          status: string
          updated_at: string
          uses_continuous_medication: boolean | null
        }
        Insert: {
          attempted_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          continuous_medication_details?: string | null
          created_at?: string
          delivery_rating?: number | null
          delivery_type?: string | null
          id?: string
          knows_how_to_use?: boolean | null
          lead_id: string
          notes?: string | null
          organization_id: string
          received_order?: boolean | null
          sale_id: string
          seller_rating?: number | null
          status?: string
          updated_at?: string
          uses_continuous_medication?: boolean | null
        }
        Update: {
          attempted_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          continuous_medication_details?: string | null
          created_at?: string
          delivery_rating?: number | null
          delivery_type?: string | null
          id?: string
          knows_how_to_use?: boolean | null
          lead_id?: string
          notes?: string | null
          organization_id?: string
          received_order?: boolean | null
          sale_id?: string
          seller_rating?: number | null
          status?: string
          updated_at?: string
          uses_continuous_medication?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_surveys_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_surveys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_surveys_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_embeddings: {
        Row: {
          content_hash: string
          content_text: string
          content_type: string
          created_at: string | null
          embedding: string | null
          id: string
          organization_id: string
          product_id: string
          updated_at: string | null
        }
        Insert: {
          content_hash: string
          content_text: string
          content_type: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          organization_id: string
          product_id: string
          updated_at?: string | null
        }
        Update: {
          content_hash?: string
          content_text?: string
          content_type?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_embeddings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_embeddings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          organization_id: string
          position: number
          product_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          organization_id: string
          position?: number
          product_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          organization_id?: string
          position?: number
          product_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_faqs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_faqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          position: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          position?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          position?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_kits: {
        Row: {
          created_at: string
          id: string
          minimum_custom_commission: number | null
          minimum_price_cents: number | null
          minimum_use_default_commission: boolean
          organization_id: string
          points_minimum: number | null
          points_promotional: number | null
          points_promotional_2: number | null
          points_regular: number | null
          position: number
          product_id: string
          promotional_2_custom_commission: number | null
          promotional_2_use_default_commission: boolean
          promotional_custom_commission: number | null
          promotional_price_2_cents: number | null
          promotional_price_cents: number | null
          promotional_use_default_commission: boolean
          quantity: number
          regular_custom_commission: number | null
          regular_price_cents: number
          regular_use_default_commission: boolean
          sales_hack: string | null
          sku: string | null
          updated_at: string
          usage_period_days: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          minimum_custom_commission?: number | null
          minimum_price_cents?: number | null
          minimum_use_default_commission?: boolean
          organization_id: string
          points_minimum?: number | null
          points_promotional?: number | null
          points_promotional_2?: number | null
          points_regular?: number | null
          position?: number
          product_id: string
          promotional_2_custom_commission?: number | null
          promotional_2_use_default_commission?: boolean
          promotional_custom_commission?: number | null
          promotional_price_2_cents?: number | null
          promotional_price_cents?: number | null
          promotional_use_default_commission?: boolean
          quantity?: number
          regular_custom_commission?: number | null
          regular_price_cents?: number
          regular_use_default_commission?: boolean
          sales_hack?: string | null
          sku?: string | null
          updated_at?: string
          usage_period_days?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          minimum_custom_commission?: number | null
          minimum_price_cents?: number | null
          minimum_use_default_commission?: boolean
          organization_id?: string
          points_minimum?: number | null
          points_promotional?: number | null
          points_promotional_2?: number | null
          points_regular?: number | null
          position?: number
          product_id?: string
          promotional_2_custom_commission?: number | null
          promotional_2_use_default_commission?: boolean
          promotional_custom_commission?: number | null
          promotional_price_2_cents?: number | null
          promotional_price_cents?: number | null
          promotional_use_default_commission?: boolean
          quantity?: number
          regular_custom_commission?: number | null
          regular_price_cents?: number
          regular_use_default_commission?: boolean
          sales_hack?: string | null
          sku?: string | null
          updated_at?: string
          usage_period_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_kits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_kits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          created_at: string
          id: string
          is_standard: boolean
          organization_id: string
          position: number
          product_id: string
          question_text: string
          standard_question_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_standard?: boolean
          organization_id: string
          position?: number
          product_id: string
          question_text: string
          standard_question_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_standard?: boolean
          organization_id?: string
          position?: number
          product_id?: string
          question_text?: string
          standard_question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_questions_standard_question_id_fkey"
            columns: ["standard_question_id"]
            isOneToOne: false
            referencedRelation: "standard_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_standard_questions: {
        Row: {
          created_at: string
          id: string
          position: number
          product_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          product_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_standard_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_standard_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "standard_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_user_visibility: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_user_visibility_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_user_visibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_cartoon_url: string | null
          avatar_fighter_url: string | null
          avatar_horse_url: string | null
          avatar_url: string | null
          created_at: string
          daily_goal_cents: number | null
          dream_prize: string | null
          email: string | null
          favorite_chocolate: string | null
          favorite_drink: string | null
          first_name: string
          id: string
          instagram: string | null
          last_name: string
          monthly_goal_cents: number | null
          nickname: string | null
          organization_id: string | null
          updated_at: string
          user_id: string
          weekly_goal_cents: number | null
          whatsapp: string | null
        }
        Insert: {
          avatar_cartoon_url?: string | null
          avatar_fighter_url?: string | null
          avatar_horse_url?: string | null
          avatar_url?: string | null
          created_at?: string
          daily_goal_cents?: number | null
          dream_prize?: string | null
          email?: string | null
          favorite_chocolate?: string | null
          favorite_drink?: string | null
          first_name: string
          id?: string
          instagram?: string | null
          last_name: string
          monthly_goal_cents?: number | null
          nickname?: string | null
          organization_id?: string | null
          updated_at?: string
          user_id: string
          weekly_goal_cents?: number | null
          whatsapp?: string | null
        }
        Update: {
          avatar_cartoon_url?: string | null
          avatar_fighter_url?: string | null
          avatar_horse_url?: string | null
          avatar_url?: string | null
          created_at?: string
          daily_goal_cents?: number | null
          dream_prize?: string | null
          email?: string | null
          favorite_chocolate?: string | null
          favorite_drink?: string | null
          first_name?: string
          id?: string
          instagram?: string | null
          last_name?: string
          monthly_goal_cents?: number | null
          nickname?: string | null
          organization_id?: string | null
          updated_at?: string
          user_id?: string
          weekly_goal_cents?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      receptive_attendances: {
        Row: {
          call_quality_score: Json | null
          call_recording_url: string | null
          completed: boolean
          conversation_mode: string
          created_at: string
          id: string
          lead_existed: boolean
          lead_id: string | null
          non_purchase_reason_id: string | null
          notes: string | null
          organization_id: string
          phone_searched: string
          product_answers: Json | null
          product_id: string | null
          purchase_potential_cents: number | null
          recording_storage_path: string | null
          sale_id: string | null
          transcription: string | null
          transcription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_quality_score?: Json | null
          call_recording_url?: string | null
          completed?: boolean
          conversation_mode: string
          created_at?: string
          id?: string
          lead_existed?: boolean
          lead_id?: string | null
          non_purchase_reason_id?: string | null
          notes?: string | null
          organization_id: string
          phone_searched: string
          product_answers?: Json | null
          product_id?: string | null
          purchase_potential_cents?: number | null
          recording_storage_path?: string | null
          sale_id?: string | null
          transcription?: string | null
          transcription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_quality_score?: Json | null
          call_recording_url?: string | null
          completed?: boolean
          conversation_mode?: string
          created_at?: string
          id?: string
          lead_existed?: boolean
          lead_id?: string | null
          non_purchase_reason_id?: string | null
          notes?: string | null
          organization_id?: string
          phone_searched?: string
          product_answers?: Json | null
          product_id?: string | null
          purchase_potential_cents?: number | null
          recording_storage_path?: string | null
          sale_id?: string | null
          transcription?: string | null
          transcription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receptive_attendances_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptive_attendances_non_purchase_reason_id_fkey"
            columns: ["non_purchase_reason_id"]
            isOneToOne: false
            referencedRelation: "non_purchase_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptive_attendances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptive_attendances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receptive_attendances_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          organization_id: string
          resource: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          organization_id: string
          resource: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          resource?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_ticket_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_internal: boolean
          organization_id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id: string
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          organization_id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_ticket_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_ticket_users: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_ticket_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_ticket_users_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sac_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sac_tickets: {
        Row: {
          category: Database["public"]["Enums"]["sac_category"]
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          description: string
          external_reference: string | null
          id: string
          lead_id: string
          organization_id: string
          priority: Database["public"]["Enums"]["sac_ticket_priority"]
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          sale_id: string | null
          source: string | null
          source_integration_id: string | null
          status: Database["public"]["Enums"]["sac_ticket_status"]
          subcategory: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["sac_category"]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          description: string
          external_reference?: string | null
          id?: string
          lead_id: string
          organization_id: string
          priority?: Database["public"]["Enums"]["sac_ticket_priority"]
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sale_id?: string | null
          source?: string | null
          source_integration_id?: string | null
          status?: Database["public"]["Enums"]["sac_ticket_status"]
          subcategory: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["sac_category"]
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string
          external_reference?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["sac_ticket_priority"]
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sale_id?: string | null
          source?: string | null
          source_integration_id?: string | null
          status?: Database["public"]["Enums"]["sac_ticket_status"]
          subcategory?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sac_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sac_tickets_source_integration_id_fkey"
            columns: ["source_integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_carrier_tracking: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          sale_id: string
          status: Database["public"]["Enums"]["carrier_tracking_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          sale_id: string
          status: Database["public"]["Enums"]["carrier_tracking_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          sale_id?: string
          status?: Database["public"]["Enums"]["carrier_tracking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sale_carrier_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_carrier_tracking_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_changes_log: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string
          created_at: string
          field_name: string | null
          id: string
          item_id: string | null
          new_value: string | null
          notes: string | null
          old_value: string | null
          organization_id: string
          product_name: string | null
          sale_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by: string
          created_at?: string
          field_name?: string | null
          id?: string
          item_id?: string | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          organization_id: string
          product_name?: string | null
          sale_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string
          created_at?: string
          field_name?: string | null
          id?: string
          item_id?: string | null
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          organization_id?: string
          product_name?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_changes_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "manipulated_sale_items_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_changes_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_changes_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_changes_log_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_checkpoint_history: {
        Row: {
          action: string
          changed_by: string | null
          checkpoint_id: string | null
          checkpoint_type: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          sale_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          checkpoint_id?: string | null
          checkpoint_type: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          sale_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          checkpoint_id?: string | null
          checkpoint_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_checkpoint_history_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "sale_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_checkpoint_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_checkpoint_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_checkpoints: {
        Row: {
          checkpoint_type: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          sale_id: string
          updated_at: string
        }
        Insert: {
          checkpoint_type: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          sale_id: string
          updated_at?: string
        }
        Update: {
          checkpoint_type?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          sale_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_checkpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_checkpoints_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_installments: {
        Row: {
          acquirer_id: string | null
          amount_cents: number
          card_brand: Database["public"]["Enums"]["card_brand"] | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          due_date: string
          fee_cents: number | null
          fee_percentage: number | null
          id: string
          installment_number: number
          net_amount_cents: number | null
          notes: string | null
          nsu_cv: string | null
          organization_id: string
          payment_proof_url: string | null
          sale_id: string
          status: string
          total_installments: number
          transaction_date: string | null
          transaction_type:
            | Database["public"]["Enums"]["card_transaction_type"]
            | null
          updated_at: string
        }
        Insert: {
          acquirer_id?: string | null
          amount_cents: number
          card_brand?: Database["public"]["Enums"]["card_brand"] | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date: string
          fee_cents?: number | null
          fee_percentage?: number | null
          id?: string
          installment_number?: number
          net_amount_cents?: number | null
          notes?: string | null
          nsu_cv?: string | null
          organization_id: string
          payment_proof_url?: string | null
          sale_id: string
          status?: string
          total_installments?: number
          transaction_date?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["card_transaction_type"]
            | null
          updated_at?: string
        }
        Update: {
          acquirer_id?: string | null
          amount_cents?: number
          card_brand?: Database["public"]["Enums"]["card_brand"] | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date?: string
          fee_cents?: number | null
          fee_percentage?: number | null
          id?: string
          installment_number?: number
          net_amount_cents?: number | null
          notes?: string | null
          nsu_cv?: string | null
          organization_id?: string
          payment_proof_url?: string | null
          sale_id?: string
          status?: string
          total_installments?: number
          transaction_date?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["card_transaction_type"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_installments_acquirer_id_fkey"
            columns: ["acquirer_id"]
            isOneToOne: false
            referencedRelation: "payment_acquirers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_installments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_item_conferences: {
        Row: {
          conferenced_at: string
          conferenced_by: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          quantity_checked: number
          sale_id: string
          sale_item_id: string
          stage: string
        }
        Insert: {
          conferenced_at?: string
          conferenced_by: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          quantity_checked?: number
          sale_id: string
          sale_item_id: string
          stage?: string
        }
        Update: {
          conferenced_at?: string
          conferenced_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          quantity_checked?: number
          sale_id?: string
          sale_item_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_conferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_conferences_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_conferences_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "manipulated_sale_items_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_conferences_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          commission_cents: number | null
          commission_percentage: number | null
          cost_cents: number | null
          created_at: string
          discount_cents: number
          id: string
          kit_id: string | null
          kit_quantity: number | null
          multiplier: number | null
          notes: string | null
          product_id: string
          product_name: string
          quantity: number
          requisition_number: string | null
          sale_id: string
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          commission_cents?: number | null
          commission_percentage?: number | null
          cost_cents?: number | null
          created_at?: string
          discount_cents?: number
          id?: string
          kit_id?: string | null
          kit_quantity?: number | null
          multiplier?: number | null
          notes?: string | null
          product_id: string
          product_name: string
          quantity?: number
          requisition_number?: string | null
          sale_id: string
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          commission_cents?: number | null
          commission_percentage?: number | null
          cost_cents?: number | null
          created_at?: string
          discount_cents?: number
          id?: string
          kit_id?: string | null
          kit_quantity?: number | null
          multiplier?: number | null
          notes?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          requisition_number?: string | null
          sale_id?: string
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "product_price_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_motoboy_tracking: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          sale_id: string
          status: Database["public"]["Enums"]["motoboy_tracking_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          sale_id: string
          status: Database["public"]["Enums"]["motoboy_tracking_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          sale_id?: string
          status?: Database["public"]["Enums"]["motoboy_tracking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sale_motoboy_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_motoboy_tracking_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["sale_status"]
          notes: string | null
          organization_id: string
          previous_status: Database["public"]["Enums"]["sale_status"] | null
          sale_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["sale_status"]
          notes?: string | null
          organization_id: string
          previous_status?: Database["public"]["Enums"]["sale_status"] | null
          sale_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["sale_status"]
          notes?: string | null
          organization_id?: string
          previous_status?: Database["public"]["Enums"]["sale_status"] | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_status_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          assigned_delivery_user_id: string | null
          carrier_tracking_status:
            | Database["public"]["Enums"]["carrier_tracking_status"]
            | null
          conference_completed_at: string | null
          conference_completed_by: string | null
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_notes: string | null
          delivery_position: number | null
          delivery_region_id: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          discount_cents: number
          discount_type: string | null
          discount_value: number | null
          dispatched_at: string | null
          expedition_validated_at: string | null
          expedition_validated_by: string | null
          external_order_id: string | null
          external_order_url: string | null
          external_source: string | null
          id: string
          invoice_pdf_url: string | null
          invoice_xml_url: string | null
          lead_id: string
          missing_payment_proof: boolean | null
          motoboy_tracking_status:
            | Database["public"]["Enums"]["motoboy_tracking_status"]
            | null
          observation_1: string | null
          observation_2: string | null
          organization_id: string
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_installments: number | null
          payment_method: string | null
          payment_method_id: string | null
          payment_notes: string | null
          payment_proof_url: string | null
          payment_status: string | null
          post_sale_contact_status:
            | Database["public"]["Enums"]["post_sale_contact_status"]
            | null
          printed_at: string | null
          printed_by: string | null
          return_latitude: number | null
          return_longitude: number | null
          return_notes: string | null
          return_photo_url: string | null
          return_reason_id: string | null
          returned_at: string | null
          returned_by: string | null
          romaneio_number: number
          scheduled_delivery_date: string | null
          scheduled_delivery_shift:
            | Database["public"]["Enums"]["delivery_shift"]
            | null
          seller_commission_cents: number | null
          seller_commission_percentage: number | null
          seller_user_id: string | null
          shipping_address_id: string | null
          shipping_carrier_id: string | null
          shipping_cost_cents: number | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal_cents: number
          total_cents: number
          tracking_code: string | null
          updated_at: string
          was_edited: boolean | null
        }
        Insert: {
          assigned_delivery_user_id?: string | null
          carrier_tracking_status?:
            | Database["public"]["Enums"]["carrier_tracking_status"]
            | null
          conference_completed_at?: string | null
          conference_completed_by?: string | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_position?: number | null
          delivery_region_id?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount_cents?: number
          discount_type?: string | null
          discount_value?: number | null
          dispatched_at?: string | null
          expedition_validated_at?: string | null
          expedition_validated_by?: string | null
          external_order_id?: string | null
          external_order_url?: string | null
          external_source?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_xml_url?: string | null
          lead_id: string
          missing_payment_proof?: boolean | null
          motoboy_tracking_status?:
            | Database["public"]["Enums"]["motoboy_tracking_status"]
            | null
          observation_1?: string | null
          observation_2?: string | null
          organization_id: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          post_sale_contact_status?:
            | Database["public"]["Enums"]["post_sale_contact_status"]
            | null
          printed_at?: string | null
          printed_by?: string | null
          return_latitude?: number | null
          return_longitude?: number | null
          return_notes?: string | null
          return_photo_url?: string | null
          return_reason_id?: string | null
          returned_at?: string | null
          returned_by?: string | null
          romaneio_number?: number
          scheduled_delivery_date?: string | null
          scheduled_delivery_shift?:
            | Database["public"]["Enums"]["delivery_shift"]
            | null
          seller_commission_cents?: number | null
          seller_commission_percentage?: number | null
          seller_user_id?: string | null
          shipping_address_id?: string | null
          shipping_carrier_id?: string | null
          shipping_cost_cents?: number | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          updated_at?: string
          was_edited?: boolean | null
        }
        Update: {
          assigned_delivery_user_id?: string | null
          carrier_tracking_status?:
            | Database["public"]["Enums"]["carrier_tracking_status"]
            | null
          conference_completed_at?: string | null
          conference_completed_by?: string | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_position?: number | null
          delivery_region_id?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["delivery_status"]
            | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount_cents?: number
          discount_type?: string | null
          discount_value?: number | null
          dispatched_at?: string | null
          expedition_validated_at?: string | null
          expedition_validated_by?: string | null
          external_order_id?: string | null
          external_order_url?: string | null
          external_source?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_xml_url?: string | null
          lead_id?: string
          missing_payment_proof?: boolean | null
          motoboy_tracking_status?:
            | Database["public"]["Enums"]["motoboy_tracking_status"]
            | null
          observation_1?: string | null
          observation_2?: string | null
          organization_id?: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          post_sale_contact_status?:
            | Database["public"]["Enums"]["post_sale_contact_status"]
            | null
          printed_at?: string | null
          printed_by?: string | null
          return_latitude?: number | null
          return_longitude?: number | null
          return_notes?: string | null
          return_photo_url?: string | null
          return_reason_id?: string | null
          returned_at?: string | null
          returned_by?: string | null
          romaneio_number?: number
          scheduled_delivery_date?: string | null
          scheduled_delivery_shift?:
            | Database["public"]["Enums"]["delivery_shift"]
            | null
          seller_commission_cents?: number | null
          seller_commission_percentage?: number | null
          seller_user_id?: string | null
          shipping_address_id?: string | null
          shipping_carrier_id?: string | null
          shipping_cost_cents?: number | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          updated_at?: string
          was_edited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_delivery_region_id_fkey"
            columns: ["delivery_region_id"]
            isOneToOne: false
            referencedRelation: "delivery_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_reason_id_fkey"
            columns: ["return_reason_id"]
            isOneToOne: false
            referencedRelation: "delivery_return_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "lead_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipping_carrier_id_fkey"
            columns: ["shipping_carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_manager_team_members: {
        Row: {
          created_at: string
          id: string
          manager_user_id: string
          organization_id: string
          team_member_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_user_id: string
          organization_id: string
          team_member_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_user_id?: string
          organization_id?: string
          team_member_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_manager_team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      secretary_conversation_history: {
        Row: {
          created_at: string
          direction: string
          id: string
          message_content: string
          message_type: string | null
          phone: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          message_content: string
          message_type?: string | null
          phone: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          message_content?: string
          message_type?: string | null
          phone?: string
        }
        Relationships: []
      }
      secretary_message_templates: {
        Row: {
          created_at: string
          day_of_week: number | null
          days_without_contact: number | null
          id: string
          is_active: boolean
          message_content: string
          message_title: string
          message_type: Database["public"]["Enums"]["secretary_message_type"]
          recipient_type: Database["public"]["Enums"]["secretary_recipient_type"]
          scheduled_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          days_without_contact?: number | null
          id?: string
          is_active?: boolean
          message_content: string
          message_title: string
          message_type?: Database["public"]["Enums"]["secretary_message_type"]
          recipient_type: Database["public"]["Enums"]["secretary_recipient_type"]
          scheduled_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          days_without_contact?: number | null
          id?: string
          is_active?: boolean
          message_content?: string
          message_title?: string
          message_type?: Database["public"]["Enums"]["secretary_message_type"]
          recipient_type?: Database["public"]["Enums"]["secretary_recipient_type"]
          scheduled_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      secretary_sent_messages: {
        Row: {
          error_message: string | null
          id: string
          message_content: string
          recipient_name: string | null
          recipient_org_id: string | null
          recipient_phone: string
          recipient_user_id: string | null
          sent_at: string
          sent_date: string
          status: string
          template_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          message_content: string
          recipient_name?: string | null
          recipient_org_id?: string | null
          recipient_phone: string
          recipient_user_id?: string | null
          sent_at?: string
          sent_date?: string
          status?: string
          template_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          message_content?: string
          recipient_name?: string | null
          recipient_org_id?: string | null
          recipient_phone?: string
          recipient_user_id?: string | null
          sent_at?: string
          sent_date?: string
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secretary_sent_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "secretary_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_carriers: {
        Row: {
          cost_cents: number
          created_at: string
          estimated_days: number
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          estimated_days?: number
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          cost_cents?: number
          created_at?: string
          estimated_days?: number
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_carriers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_question_options: {
        Row: {
          created_at: string
          id: string
          option_text: string
          position: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_text: string
          position?: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_text?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standard_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "standard_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      standard_questions: {
        Row: {
          category: Database["public"]["Enums"]["standard_question_category"]
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          organization_id: string
          position: number
          question_text: string
          question_type: Database["public"]["Enums"]["standard_question_type"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["standard_question_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          organization_id: string
          position?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["standard_question_type"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["standard_question_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          organization_id?: string
          position?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["standard_question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standard_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          new_quantity: number
          notes: string | null
          organization_id: string
          previous_quantity: number
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          new_quantity: number
          notes?: string | null
          organization_id: string
          previous_quantity: number
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          new_quantity?: number
          notes?: string | null
          organization_id?: string
          previous_quantity?: number
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          annual_price_cents: number | null
          atomicpay_annual_url: string | null
          atomicpay_monthly_url: string | null
          created_at: string
          extra_energy_price_cents: number
          extra_instance_price_cents: number
          extra_user_price_cents: number
          id: string
          included_whatsapp_instances: number
          is_active: boolean
          is_visible_on_site: boolean | null
          max_leads: number | null
          max_users: number
          monthly_energy: number | null
          name: string
          payment_provider: string | null
          price_cents: number
          stripe_extra_energy_price_id: string | null
          stripe_extra_users_price_id: string | null
          stripe_extra_whatsapp_instances_price_id: string | null
          stripe_price_id: string | null
        }
        Insert: {
          annual_price_cents?: number | null
          atomicpay_annual_url?: string | null
          atomicpay_monthly_url?: string | null
          created_at?: string
          extra_energy_price_cents?: number
          extra_instance_price_cents?: number
          extra_user_price_cents?: number
          id?: string
          included_whatsapp_instances?: number
          is_active?: boolean
          is_visible_on_site?: boolean | null
          max_leads?: number | null
          max_users: number
          monthly_energy?: number | null
          name: string
          payment_provider?: string | null
          price_cents: number
          stripe_extra_energy_price_id?: string | null
          stripe_extra_users_price_id?: string | null
          stripe_extra_whatsapp_instances_price_id?: string | null
          stripe_price_id?: string | null
        }
        Update: {
          annual_price_cents?: number | null
          atomicpay_annual_url?: string | null
          atomicpay_monthly_url?: string | null
          created_at?: string
          extra_energy_price_cents?: number
          extra_instance_price_cents?: number
          extra_user_price_cents?: number
          id?: string
          included_whatsapp_instances?: number
          is_active?: boolean
          is_visible_on_site?: boolean | null
          max_leads?: number | null
          max_users?: number
          monthly_energy?: number | null
          name?: string
          payment_provider?: string | null
          price_cents?: number
          stripe_extra_energy_price_id?: string | null
          stripe_extra_users_price_id?: string | null
          stripe_extra_whatsapp_instances_price_id?: string | null
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          extra_energy_packs: number
          extra_users: number
          extra_whatsapp_instances: number
          id: string
          organization_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          extra_energy_packs?: number
          extra_users?: number
          extra_whatsapp_instances?: number
          id?: string
          organization_id: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          extra_energy_packs?: number
          extra_users?: number
          extra_whatsapp_instances?: number
          id?: string
          organization_id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans_public"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_password_resets: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding_progress: {
        Row: {
          created_at: string
          first_lead_created: boolean | null
          first_lead_tips_sent: boolean | null
          first_stage_update: boolean | null
          funnel_tips_sent: boolean | null
          id: string
          leads_count_milestone_3: boolean | null
          leads_created_count: number | null
          organization_id: string
          stage_tips_sent: boolean | null
          stage_updates_count: number | null
          updated_at: string
          user_id: string
          welcome_sent: boolean | null
        }
        Insert: {
          created_at?: string
          first_lead_created?: boolean | null
          first_lead_tips_sent?: boolean | null
          first_stage_update?: boolean | null
          funnel_tips_sent?: boolean | null
          id?: string
          leads_count_milestone_3?: boolean | null
          leads_created_count?: number | null
          organization_id: string
          stage_tips_sent?: boolean | null
          stage_updates_count?: number | null
          updated_at?: string
          user_id: string
          welcome_sent?: boolean | null
        }
        Update: {
          created_at?: string
          first_lead_created?: boolean | null
          first_lead_tips_sent?: boolean | null
          first_stage_update?: boolean | null
          funnel_tips_sent?: boolean | null
          id?: string
          leads_count_milestone_3?: boolean | null
          leads_created_count?: number | null
          organization_id?: string
          stage_tips_sent?: boolean | null
          stage_updates_count?: number | null
          updated_at?: string
          user_id?: string
          welcome_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          ai_bots_view: boolean
          created_at: string
          dashboard_funnel_view: boolean
          dashboard_kanban_view: boolean
          default_landing_page: string | null
          deliveries_view_all: boolean
          deliveries_view_own: boolean
          demands_view: boolean
          expedition_report_view: boolean | null
          expedition_view: boolean
          hide_sidebar: boolean | null
          id: string
          instagram_view: boolean
          integrations_view: boolean
          leads_create: boolean
          leads_delete: boolean
          leads_edit: boolean
          leads_hide_new_button: boolean
          leads_view: boolean
          leads_view_only_own: boolean
          organization_id: string
          post_sale_manage: boolean
          post_sale_view: boolean
          products_manage: boolean
          products_view: boolean
          products_view_cost: boolean
          receptive_module_access: boolean
          reports_view: boolean
          sac_manage: boolean
          sac_view: boolean
          sales_cancel: boolean
          sales_confirm_payment: boolean
          sales_create: boolean
          sales_dashboard_view: boolean
          sales_dispatch: boolean
          sales_edit_draft: boolean
          sales_hide_new_button: boolean
          sales_mark_delivered: boolean
          sales_mark_printed: boolean
          sales_report_view: boolean | null
          sales_validate_expedition: boolean
          sales_view: boolean
          sales_view_all: boolean
          scheduled_messages_manage: boolean
          scheduled_messages_view: boolean
          seller_panel_view: boolean
          settings_carriers: boolean
          settings_delivery_regions: boolean
          settings_funnel_stages: boolean
          settings_lead_sources: boolean
          settings_manage: boolean
          settings_non_purchase_reasons: boolean
          settings_payment_methods: boolean
          settings_standard_questions: boolean
          settings_teams: boolean
          settings_view: boolean
          team_add_member: boolean
          team_change_commission: boolean
          team_change_permissions: boolean
          team_change_role: boolean
          team_delete_member: boolean
          team_edit_member: boolean
          team_toggle_manager: boolean
          team_view: boolean
          updated_at: string
          user_id: string
          whatsapp_ai_settings_view: boolean | null
          whatsapp_manage_view: boolean
          whatsapp_send: boolean
          whatsapp_v2_view: boolean | null
          whatsapp_view: boolean
        }
        Insert: {
          ai_bots_view?: boolean
          created_at?: string
          dashboard_funnel_view?: boolean
          dashboard_kanban_view?: boolean
          default_landing_page?: string | null
          deliveries_view_all?: boolean
          deliveries_view_own?: boolean
          demands_view?: boolean
          expedition_report_view?: boolean | null
          expedition_view?: boolean
          hide_sidebar?: boolean | null
          id?: string
          instagram_view?: boolean
          integrations_view?: boolean
          leads_create?: boolean
          leads_delete?: boolean
          leads_edit?: boolean
          leads_hide_new_button?: boolean
          leads_view?: boolean
          leads_view_only_own?: boolean
          organization_id: string
          post_sale_manage?: boolean
          post_sale_view?: boolean
          products_manage?: boolean
          products_view?: boolean
          products_view_cost?: boolean
          receptive_module_access?: boolean
          reports_view?: boolean
          sac_manage?: boolean
          sac_view?: boolean
          sales_cancel?: boolean
          sales_confirm_payment?: boolean
          sales_create?: boolean
          sales_dashboard_view?: boolean
          sales_dispatch?: boolean
          sales_edit_draft?: boolean
          sales_hide_new_button?: boolean
          sales_mark_delivered?: boolean
          sales_mark_printed?: boolean
          sales_report_view?: boolean | null
          sales_validate_expedition?: boolean
          sales_view?: boolean
          sales_view_all?: boolean
          scheduled_messages_manage?: boolean
          scheduled_messages_view?: boolean
          seller_panel_view?: boolean
          settings_carriers?: boolean
          settings_delivery_regions?: boolean
          settings_funnel_stages?: boolean
          settings_lead_sources?: boolean
          settings_manage?: boolean
          settings_non_purchase_reasons?: boolean
          settings_payment_methods?: boolean
          settings_standard_questions?: boolean
          settings_teams?: boolean
          settings_view?: boolean
          team_add_member?: boolean
          team_change_commission?: boolean
          team_change_permissions?: boolean
          team_change_role?: boolean
          team_delete_member?: boolean
          team_edit_member?: boolean
          team_toggle_manager?: boolean
          team_view?: boolean
          updated_at?: string
          user_id: string
          whatsapp_ai_settings_view?: boolean | null
          whatsapp_manage_view?: boolean
          whatsapp_send?: boolean
          whatsapp_v2_view?: boolean | null
          whatsapp_view?: boolean
        }
        Update: {
          ai_bots_view?: boolean
          created_at?: string
          dashboard_funnel_view?: boolean
          dashboard_kanban_view?: boolean
          default_landing_page?: string | null
          deliveries_view_all?: boolean
          deliveries_view_own?: boolean
          demands_view?: boolean
          expedition_report_view?: boolean | null
          expedition_view?: boolean
          hide_sidebar?: boolean | null
          id?: string
          instagram_view?: boolean
          integrations_view?: boolean
          leads_create?: boolean
          leads_delete?: boolean
          leads_edit?: boolean
          leads_hide_new_button?: boolean
          leads_view?: boolean
          leads_view_only_own?: boolean
          organization_id?: string
          post_sale_manage?: boolean
          post_sale_view?: boolean
          products_manage?: boolean
          products_view?: boolean
          products_view_cost?: boolean
          receptive_module_access?: boolean
          reports_view?: boolean
          sac_manage?: boolean
          sac_view?: boolean
          sales_cancel?: boolean
          sales_confirm_payment?: boolean
          sales_create?: boolean
          sales_dashboard_view?: boolean
          sales_dispatch?: boolean
          sales_edit_draft?: boolean
          sales_hide_new_button?: boolean
          sales_mark_delivered?: boolean
          sales_mark_printed?: boolean
          sales_report_view?: boolean | null
          sales_validate_expedition?: boolean
          sales_view?: boolean
          sales_view_all?: boolean
          scheduled_messages_manage?: boolean
          scheduled_messages_view?: boolean
          seller_panel_view?: boolean
          settings_carriers?: boolean
          settings_delivery_regions?: boolean
          settings_funnel_stages?: boolean
          settings_lead_sources?: boolean
          settings_manage?: boolean
          settings_non_purchase_reasons?: boolean
          settings_payment_methods?: boolean
          settings_standard_questions?: boolean
          settings_teams?: boolean
          settings_view?: boolean
          team_add_member?: boolean
          team_change_commission?: boolean
          team_change_permissions?: boolean
          team_change_role?: boolean
          team_delete_member?: boolean
          team_edit_member?: boolean
          team_toggle_manager?: boolean
          team_view?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_ai_settings_view?: boolean | null
          whatsapp_manage_view?: boolean
          whatsapp_send?: boolean
          whatsapp_v2_view?: boolean | null
          whatsapp_view?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_assistant_states: {
        Row: {
          expires_at: string
          phone: string
          state: Json
          updated_at: string
        }
        Insert: {
          expires_at: string
          phone: string
          state: Json
          updated_at?: string
        }
        Update: {
          expires_at?: string
          phone?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_bot_configs: {
        Row: {
          bot_gender: string | null
          bot_name: string | null
          company_name: string | null
          company_website: string | null
          created_at: string
          forbidden_words: string[] | null
          id: string
          instance_id: string
          is_enabled: boolean
          is_human_like: boolean
          main_objective: string | null
          products_prices: string | null
          supervisor_mode: boolean
          tokens_limit_month: number
          tokens_used_month: number
          updated_at: string
        }
        Insert: {
          bot_gender?: string | null
          bot_name?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          forbidden_words?: string[] | null
          id?: string
          instance_id: string
          is_enabled?: boolean
          is_human_like?: boolean
          main_objective?: string | null
          products_prices?: string | null
          supervisor_mode?: boolean
          tokens_limit_month?: number
          tokens_used_month?: number
          updated_at?: string
        }
        Update: {
          bot_gender?: string | null
          bot_name?: string | null
          company_name?: string | null
          company_website?: string | null
          created_at?: string
          forbidden_words?: string[] | null
          id?: string
          instance_id?: string
          is_enabled?: boolean
          is_human_like?: boolean
          main_objective?: string | null
          products_prices?: string | null
          supervisor_mode?: boolean
          tokens_limit_month?: number
          tokens_used_month?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_configs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_configs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_call_logs: {
        Row: {
          answered_at: string | null
          call_direction: string
          call_status: string
          contact_name: string | null
          contact_phone: string
          conversation_id: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          instance_id: string
          is_video: boolean
          lead_id: string | null
          organization_id: string
          started_at: string
          user_id: string | null
        }
        Insert: {
          answered_at?: string | null
          call_direction: string
          call_status?: string
          contact_name?: string | null
          contact_phone: string
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          instance_id: string
          is_video?: boolean
          lead_id?: string | null
          organization_id: string
          started_at?: string
          user_id?: string | null
        }
        Update: {
          answered_at?: string | null
          call_direction?: string
          call_status?: string
          contact_name?: string | null
          contact_phone?: string
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string
          is_video?: boolean
          lead_id?: string | null
          organization_id?: string
          started_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_call_queue: {
        Row: {
          calls_received: number
          created_at: string
          id: string
          instance_id: string
          is_available: boolean
          last_call_at: string | null
          organization_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calls_received?: number
          created_at?: string
          id?: string
          instance_id: string
          is_available?: boolean
          last_call_at?: string | null
          organization_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calls_received?: number
          created_at?: string
          id?: string
          instance_id?: string
          is_available?: boolean
          last_call_at?: string | null
          organization_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_call_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_queue_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_call_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_assignments: {
        Row: {
          action: string
          assigned_by: string | null
          conversation_id: string
          created_at: string
          from_user_id: string | null
          id: string
          notes: string | null
          organization_id: string
          to_user_id: string | null
        }
        Insert: {
          action: string
          assigned_by?: string | null
          conversation_id: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          to_user_id?: string | null
        }
        Update: {
          action?: string
          assigned_by?: string | null
          conversation_id?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_at: string | null
          assigned_user_id: string | null
          awaiting_satisfaction_response: boolean | null
          bot_energy_consumed: number | null
          bot_messages_count: number | null
          bot_qualification_completed: boolean | null
          bot_qualification_step: number | null
          bot_started_at: string | null
          chat_id: string | null
          closed_at: string | null
          contact_id: string | null
          contact_name: string | null
          contact_profile_pic: string | null
          created_at: string
          current_instance_id: string | null
          customer_phone_e164: string | null
          designated_at: string | null
          designated_user_id: string | null
          display_name: string | null
          group_subject: string | null
          handling_bot_id: string | null
          id: string
          instance_id: string | null
          is_group: boolean
          last_customer_message_at: string | null
          last_message_at: string | null
          lead_id: string | null
          organization_id: string
          original_instance_name: string | null
          phone_number: string
          satisfaction_sent_at: string | null
          sendable_phone: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          awaiting_satisfaction_response?: boolean | null
          bot_energy_consumed?: number | null
          bot_messages_count?: number | null
          bot_qualification_completed?: boolean | null
          bot_qualification_step?: number | null
          bot_started_at?: string | null
          chat_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_profile_pic?: string | null
          created_at?: string
          current_instance_id?: string | null
          customer_phone_e164?: string | null
          designated_at?: string | null
          designated_user_id?: string | null
          display_name?: string | null
          group_subject?: string | null
          handling_bot_id?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean
          last_customer_message_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          organization_id: string
          original_instance_name?: string | null
          phone_number: string
          satisfaction_sent_at?: string | null
          sendable_phone?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          awaiting_satisfaction_response?: boolean | null
          bot_energy_consumed?: number | null
          bot_messages_count?: number | null
          bot_qualification_completed?: boolean | null
          bot_qualification_step?: number | null
          bot_started_at?: string | null
          chat_id?: string | null
          closed_at?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_profile_pic?: string | null
          created_at?: string
          current_instance_id?: string | null
          customer_phone_e164?: string | null
          designated_at?: string | null
          designated_user_id?: string | null
          display_name?: string | null
          group_subject?: string | null
          handling_bot_id?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean
          last_customer_message_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          organization_id?: string
          original_instance_name?: string | null
          phone_number?: string
          satisfaction_sent_at?: string | null
          sendable_phone?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_current_instance_id_fkey"
            columns: ["current_instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_current_instance_id_fkey"
            columns: ["current_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_handling_bot_id_fkey"
            columns: ["handling_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_document_readings: {
        Row: {
          auto_replied: boolean | null
          conversation_id: string
          created_at: string
          document_type: string
          document_url: string
          error_message: string | null
          id: string
          lead_id: string | null
          medications: Json | null
          message_id: string
          organization_id: string
          prescriber_info: Json | null
          processed_at: string | null
          raw_text: string | null
          seller_notified: boolean | null
          status: string
          structured_data: Json | null
          summary: string | null
        }
        Insert: {
          auto_replied?: boolean | null
          conversation_id: string
          created_at?: string
          document_type?: string
          document_url: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          medications?: Json | null
          message_id: string
          organization_id: string
          prescriber_info?: Json | null
          processed_at?: string | null
          raw_text?: string | null
          seller_notified?: boolean | null
          status?: string
          structured_data?: Json | null
          summary?: string | null
        }
        Update: {
          auto_replied?: boolean | null
          conversation_id?: string
          created_at?: string
          document_type?: string
          document_url?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          medications?: Json | null
          message_id?: string
          organization_id?: string
          prescriber_info?: Json | null
          processed_at?: string | null
          raw_text?: string | null
          seller_notified?: boolean | null
          status?: string
          structured_data?: Json | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_document_readings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_document_readings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_document_readings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_document_readings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_document_readings_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_document_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instance_bots: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          instance_id: string
          is_active: boolean
          organization_id: string
          priority: number | null
          updated_at: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          instance_id: string
          is_active?: boolean
          organization_id: string
          priority?: number | null
          updated_at?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          organization_id?: string
          priority?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instance_bots_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instance_bots_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instance_bots_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instance_bots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instance_users: {
        Row: {
          available_from: string | null
          available_until: string | null
          can_send: boolean
          can_use_phone: boolean
          can_view: boolean
          created_at: string
          id: string
          instance_id: string
          is_always_available: boolean
          is_instance_admin: boolean
          participates_in_distribution: boolean
          user_id: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          can_send?: boolean
          can_use_phone?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          instance_id: string
          is_always_available?: boolean
          is_instance_admin?: boolean
          participates_in_distribution?: boolean
          user_id: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          can_send?: boolean
          can_use_phone?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          instance_id?: string
          is_always_available?: boolean
          is_instance_admin?: boolean
          participates_in_distribution?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instance_users_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instance_users_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          active_bot_id: string | null
          applied_coupon_id: string | null
          auto_close_assigned_minutes: number | null
          auto_close_bot_minutes: number | null
          auto_close_business_end: string | null
          auto_close_business_start: string | null
          auto_close_enabled: boolean | null
          auto_close_hours: number | null
          auto_close_message_template: string | null
          auto_close_only_business_hours: boolean | null
          auto_close_send_message: boolean | null
          auto_transcribe_enabled: boolean | null
          auto_transcribe_inbound: boolean | null
          auto_transcribe_outbound: boolean | null
          created_at: string
          deleted_at: string | null
          discount_applied_cents: number | null
          display_name_for_team: string | null
          distribution_mode: string
          evolution_api_token: string | null
          evolution_instance_id: string | null
          evolution_settings: Json | null
          evolution_webhook_configured: boolean | null
          id: string
          is_connected: boolean
          last_assigned_user_id: string | null
          manual_device_label: string | null
          manual_instance_number: string | null
          monthly_price_cents: number
          name: string
          organization_id: string
          payment_source: string
          phone_number: string | null
          provider: string
          qr_code_base64: string | null
          redistribution_timeout_minutes: number | null
          satisfaction_survey_enabled: boolean | null
          satisfaction_survey_message: string | null
          status: string
          stripe_subscription_item_id: string | null
          updated_at: string
          wasender_api_key: string | null
          wasender_session_id: string | null
          wavoip_api_key: string | null
          wavoip_device_token: string | null
          wavoip_enabled: boolean
          wavoip_server_url: string | null
          z_api_client_token: string | null
          z_api_instance_id: string | null
          z_api_token: string | null
        }
        Insert: {
          active_bot_id?: string | null
          applied_coupon_id?: string | null
          auto_close_assigned_minutes?: number | null
          auto_close_bot_minutes?: number | null
          auto_close_business_end?: string | null
          auto_close_business_start?: string | null
          auto_close_enabled?: boolean | null
          auto_close_hours?: number | null
          auto_close_message_template?: string | null
          auto_close_only_business_hours?: boolean | null
          auto_close_send_message?: boolean | null
          auto_transcribe_enabled?: boolean | null
          auto_transcribe_inbound?: boolean | null
          auto_transcribe_outbound?: boolean | null
          created_at?: string
          deleted_at?: string | null
          discount_applied_cents?: number | null
          display_name_for_team?: string | null
          distribution_mode?: string
          evolution_api_token?: string | null
          evolution_instance_id?: string | null
          evolution_settings?: Json | null
          evolution_webhook_configured?: boolean | null
          id?: string
          is_connected?: boolean
          last_assigned_user_id?: string | null
          manual_device_label?: string | null
          manual_instance_number?: string | null
          monthly_price_cents?: number
          name: string
          organization_id: string
          payment_source?: string
          phone_number?: string | null
          provider?: string
          qr_code_base64?: string | null
          redistribution_timeout_minutes?: number | null
          satisfaction_survey_enabled?: boolean | null
          satisfaction_survey_message?: string | null
          status?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
          wasender_api_key?: string | null
          wasender_session_id?: string | null
          wavoip_api_key?: string | null
          wavoip_device_token?: string | null
          wavoip_enabled?: boolean
          wavoip_server_url?: string | null
          z_api_client_token?: string | null
          z_api_instance_id?: string | null
          z_api_token?: string | null
        }
        Update: {
          active_bot_id?: string | null
          applied_coupon_id?: string | null
          auto_close_assigned_minutes?: number | null
          auto_close_bot_minutes?: number | null
          auto_close_business_end?: string | null
          auto_close_business_start?: string | null
          auto_close_enabled?: boolean | null
          auto_close_hours?: number | null
          auto_close_message_template?: string | null
          auto_close_only_business_hours?: boolean | null
          auto_close_send_message?: boolean | null
          auto_transcribe_enabled?: boolean | null
          auto_transcribe_inbound?: boolean | null
          auto_transcribe_outbound?: boolean | null
          created_at?: string
          deleted_at?: string | null
          discount_applied_cents?: number | null
          display_name_for_team?: string | null
          distribution_mode?: string
          evolution_api_token?: string | null
          evolution_instance_id?: string | null
          evolution_settings?: Json | null
          evolution_webhook_configured?: boolean | null
          id?: string
          is_connected?: boolean
          last_assigned_user_id?: string | null
          manual_device_label?: string | null
          manual_instance_number?: string | null
          monthly_price_cents?: number
          name?: string
          organization_id?: string
          payment_source?: string
          phone_number?: string | null
          provider?: string
          qr_code_base64?: string | null
          redistribution_timeout_minutes?: number | null
          satisfaction_survey_enabled?: boolean | null
          satisfaction_survey_message?: string | null
          status?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
          wasender_api_key?: string | null
          wasender_session_id?: string | null
          wavoip_api_key?: string | null
          wavoip_device_token?: string | null
          wavoip_enabled?: boolean
          wavoip_server_url?: string | null
          z_api_client_token?: string | null
          z_api_instance_id?: string | null
          z_api_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_active_bot_id_fkey"
            columns: ["active_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_applied_coupon_id_fkey"
            columns: ["applied_coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_media_tokens: {
        Row: {
          bucket_id: string
          content_type: string | null
          created_at: string
          expires_at: string
          id: string
          object_path: string
          token: string
        }
        Insert: {
          bucket_id?: string
          content_type?: string | null
          created_at?: string
          expires_at: string
          id?: string
          object_path: string
          token: string
        }
        Update: {
          bucket_id?: string
          content_type?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          object_path?: string
          token?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          contact_id: string | null
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          instance_id: string
          is_from_bot: boolean
          media_caption: string | null
          media_url: string | null
          message_type: string
          provider: string | null
          provider_message_id: string | null
          sent_by_user_id: string | null
          status: string | null
          transcription: string | null
          transcription_status: string | null
          z_api_message_id: string | null
        }
        Insert: {
          contact_id?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          instance_id: string
          is_from_bot?: boolean
          media_caption?: string | null
          media_url?: string | null
          message_type?: string
          provider?: string | null
          provider_message_id?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          transcription?: string | null
          transcription_status?: string | null
          z_api_message_id?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          instance_id?: string
          is_from_bot?: boolean
          media_caption?: string | null
          media_url?: string | null
          message_type?: string
          provider?: string | null
          provider_message_id?: string | null
          sent_by_user_id?: string | null
          status?: string | null
          transcription?: string | null
          transcription_status?: string | null
          z_api_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_v2_chats: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          image_url: string | null
          instance_id: string
          is_archived: boolean | null
          is_group: boolean | null
          is_pinned: boolean | null
          last_message: string | null
          last_message_time: string | null
          lead_id: string | null
          name: string | null
          tenant_id: string
          unread_count: number | null
          updated_at: string
          whatsapp_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          instance_id: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_pinned?: boolean | null
          last_message?: string | null
          last_message_time?: string | null
          lead_id?: string | null
          name?: string | null
          tenant_id: string
          unread_count?: number | null
          updated_at?: string
          whatsapp_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          instance_id?: string
          is_archived?: boolean | null
          is_group?: boolean | null
          is_pinned?: boolean | null
          last_message?: string | null
          last_message_time?: string | null
          lead_id?: string | null
          name?: string | null
          tenant_id?: string
          unread_count?: number | null
          updated_at?: string
          whatsapp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_v2_chats_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_v2_chats_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_v2_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_v2_chats_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_v2_chats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_v2_instance_users: {
        Row: {
          can_manage: boolean | null
          can_send: boolean | null
          can_view: boolean | null
          created_at: string
          id: string
          instance_id: string
          user_id: string
        }
        Insert: {
          can_manage?: boolean | null
          can_send?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          instance_id: string
          user_id: string
        }
        Update: {
          can_manage?: boolean | null
          can_send?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          instance_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_v2_instance_users_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_v2_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_v2_instances: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          is_active: boolean | null
          last_connected_at: string | null
          name: string
          phone_number: string | null
          qr_code: string | null
          session_data: Json | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name: string
          phone_number?: string | null
          qr_code?: string | null
          session_data?: Json | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name?: string
          phone_number?: string | null
          qr_code?: string | null
          session_data?: Json | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_v2_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_v2_messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          error_message: string | null
          id: string
          is_from_me: boolean | null
          media_filename: string | null
          media_mime_type: string | null
          media_type: string | null
          media_url: string | null
          metadata: Json | null
          quoted_content: string | null
          quoted_message_id: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string | null
          tenant_id: string
          wa_message_id: string | null
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_from_me?: boolean | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          quoted_content?: string | null
          quoted_message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          tenant_id: string
          wa_message_id?: string | null
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_from_me?: boolean | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          quoted_content?: string | null
          quoted_message_id?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string | null
          tenant_id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_v2_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_v2_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_v2_messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_v2_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_v2_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      channel_users: {
        Row: {
          can_send: boolean | null
          can_view: boolean | null
          channel_id: string | null
          created_at: string | null
          id: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instance_users_instance_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instance_users_instance_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string | null
          external_account_id: string | null
          id: string | null
          is_connected: boolean | null
          monthly_price_cents: number | null
          name: string | null
          payment_source: string | null
          phone_e164: string | null
          provider: string | null
          qr_code_base64: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          external_account_id?: never
          id?: string | null
          is_connected?: boolean | null
          monthly_price_cents?: number | null
          name?: string | null
          payment_source?: string | null
          phone_e164?: string | null
          provider?: string | null
          qr_code_base64?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          external_account_id?: never
          id?: string | null
          is_connected?: boolean | null
          monthly_price_cents?: number | null
          name?: string | null
          payment_source?: string | null
          phone_e164?: string | null
          provider?: string | null
          qr_code_base64?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      manipulated_sale_items_view: {
        Row: {
          client_name: string | null
          cost_cents: number | null
          created_at: string | null
          id: string | null
          organization_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          requisition_number: string | null
          sale_created_at: string | null
          sale_id: string | null
          sale_status: Database["public"]["Enums"]["sale_status"] | null
          seller_name: string | null
          total_cents: number | null
          unit_price_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans_public: {
        Row: {
          annual_price_cents: number | null
          atomicpay_annual_url: string | null
          atomicpay_monthly_url: string | null
          created_at: string | null
          extra_energy_price_cents: number | null
          extra_instance_price_cents: number | null
          extra_user_price_cents: number | null
          id: string | null
          included_whatsapp_instances: number | null
          is_active: boolean | null
          is_visible_on_site: boolean | null
          max_leads: number | null
          max_users: number | null
          monthly_energy: number | null
          name: string | null
          payment_provider: string | null
          price_cents: number | null
        }
        Insert: {
          annual_price_cents?: number | null
          atomicpay_annual_url?: string | null
          atomicpay_monthly_url?: string | null
          created_at?: string | null
          extra_energy_price_cents?: number | null
          extra_instance_price_cents?: number | null
          extra_user_price_cents?: number | null
          id?: string | null
          included_whatsapp_instances?: number | null
          is_active?: boolean | null
          is_visible_on_site?: boolean | null
          max_leads?: number | null
          max_users?: number | null
          monthly_energy?: number | null
          name?: string | null
          payment_provider?: string | null
          price_cents?: number | null
        }
        Update: {
          annual_price_cents?: number | null
          atomicpay_annual_url?: string | null
          atomicpay_monthly_url?: string | null
          created_at?: string | null
          extra_energy_price_cents?: number | null
          extra_instance_price_cents?: number | null
          extra_user_price_cents?: number | null
          id?: string | null
          included_whatsapp_instances?: number | null
          is_active?: boolean | null
          is_visible_on_site?: boolean | null
          max_leads?: number | null
          max_users?: number | null
          monthly_energy?: number | null
          name?: string | null
          payment_provider?: string | null
          price_cents?: number | null
        }
        Relationships: []
      }
      threads: {
        Row: {
          assigned_user_id: string | null
          channel_id: string | null
          contact_id: string | null
          contact_name: string | null
          contact_profile_pic: string | null
          created_at: string | null
          customer_phone_e164: string | null
          id: string | null
          last_message_at: string | null
          lead_id: string | null
          phone_number: string | null
          sendable_phone: string | null
          status: string | null
          tenant_id: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          channel_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_profile_pic?: string | null
          created_at?: string | null
          customer_phone_e164?: string | null
          id?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          phone_number?: string | null
          sendable_phone?: string | null
          status?: string | null
          tenant_id?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          channel_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_profile_pic?: string | null
          created_at?: string | null
          customer_phone_e164?: string | null
          id?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          phone_number?: string | null
          sendable_phone?: string | null
          status?: string | null
          tenant_id?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations_view: {
        Row: {
          assigned_at: string | null
          assigned_user_id: string | null
          bot_energy_consumed: number | null
          bot_messages_count: number | null
          bot_qualification_completed: boolean | null
          bot_qualification_step: number | null
          bot_started_at: string | null
          channel_name: string | null
          channel_phone_number: string | null
          chat_id: string | null
          closed_at: string | null
          contact_id: string | null
          contact_name: string | null
          contact_profile_pic: string | null
          created_at: string | null
          current_instance_id: string | null
          customer_phone_e164: string | null
          designated_at: string | null
          designated_user_id: string | null
          display_name: string | null
          group_subject: string | null
          handling_bot_id: string | null
          id: string | null
          instance_deleted_at: string | null
          instance_id: string | null
          instance_is_connected: boolean | null
          instance_status: string | null
          is_group: boolean | null
          last_customer_message_at: string | null
          last_message_at: string | null
          lead_id: string | null
          lead_instagram: string | null
          lead_name: string | null
          lead_stage: Database["public"]["Enums"]["funnel_stage"] | null
          organization_id: string | null
          original_instance_name: string | null
          phone_number: string | null
          sendable_phone: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_current_instance_id_fkey"
            columns: ["current_instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_current_instance_id_fkey"
            columns: ["current_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_handling_bot_id_fkey"
            columns: ["handling_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_bonus_energy: {
        Args: { amount: number; org_id: string }
        Returns: undefined
      }
      backfill_contacts_from_existing_conversations: {
        Args: { _organization_id: string }
        Returns: number
      }
      calculate_energy_cost: {
        Args: {
          p_action_key?: string
          p_input_tokens?: number
          p_model_key: string
          p_output_tokens?: number
        }
        Returns: Json
      }
      claim_lead: {
        Args: {
          p_lead_id: string
          p_organization_id: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_whatsapp_conversation: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: Json
      }
      close_whatsapp_conversation: {
        Args: { p_conversation_id: string }
        Returns: Json
      }
      consume_energy: {
        Args: {
          p_action_type: string
          p_bot_id: string
          p_conversation_id: string
          p_details?: Json
          p_energy_amount: number
          p_organization_id: string
          p_tokens_used?: number
        }
        Returns: Json
      }
      current_tenant_id: { Args: never; Returns: string }
      deduct_stock_for_delivered_sale: {
        Args: { _sale_id: string }
        Returns: undefined
      }
      find_contact_by_phone: {
        Args: { _organization_id: string; _phone: string }
        Returns: string
      }
      find_lead_by_whatsapp: {
        Args: { p_whatsapp: string }
        Returns: {
          is_current_user_responsible: boolean
          lead_id: string
          lead_name: string
          lead_whatsapp: string
          owner_name: string
          owner_user_id: string
        }[]
      }
      generate_bot_system_prompt: {
        Args: {
          p_age_range: string
          p_company_differential: string
          p_gender: string
          p_personality_description: string
          p_regional_expressions: string[]
          p_response_length: string
          p_service_type: string
          p_state: string
        }
        Returns: string
      }
      get_active_bot_for_instance: {
        Args: {
          p_current_day?: number
          p_current_time?: string
          p_instance_id: string
        }
        Returns: string
      }
      get_admin_whatsapp_config: { Args: never; Returns: Json }
      get_any_bot_for_instance: {
        Args: { p_instance_id: string }
        Returns: string
      }
      get_available_energy: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_default_permissions_for_role: {
        Args: { p_role: string }
        Returns: Json
      }
      get_instance_credentials: {
        Args: { p_instance_id: string }
        Returns: {
          evolution_api_token: string
          evolution_instance_id: string
          wasender_api_key: string
          z_api_client_token: string
          z_api_token: string
        }[]
      }
      get_instance_nps_metrics: {
        Args: { p_days?: number; p_instance_id: string }
        Returns: Json
      }
      get_linked_lead_for_conversation: {
        Args: { p_conversation_id: string }
        Returns: {
          lead_id: string
          lead_instagram: string
          lead_name: string
          lead_stage: string
          lead_stars: number
        }[]
      }
      get_manipulated_costs_summary: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_next_available_user_for_distribution: {
        Args: { p_instance_id: string; p_organization_id: string }
        Returns: string
      }
      get_or_create_contact_by_phone: {
        Args: { _name?: string; _organization_id: string; _phone: string }
        Returns: string
      }
      get_org_nps_metrics: {
        Args: { p_days?: number; p_organization_id: string }
        Returns: Json
      }
      get_sale_items_costs: {
        Args: { item_ids: string[] }
        Returns: {
          cost_cents: number
          id: string
        }[]
      }
      get_tenant_channels: {
        Args: { _tenant_id?: string }
        Returns: {
          channel_id: string
          channel_name: string
          is_connected: boolean
          phone_e164: string
          provider: string
          status: string
        }[]
      }
      get_tenant_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string
      }
      get_tenant_stats: {
        Args: { _tenant_id?: string }
        Returns: {
          connected_channels: number
          total_channels: number
          total_conversations: number
          total_leads: number
          total_members: number
          unread_conversations: number
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenants: {
        Args: { _user_id?: string }
        Returns: {
          joined_at: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          user_role: string
        }[]
      }
      grant_user_instance_access: {
        Args: {
          _can_send?: boolean
          _can_view?: boolean
          _instance_id: string
          _user_id: string
        }
        Returns: undefined
      }
      has_onboarding_completed: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { coupon_id: string }
        Returns: undefined
      }
      initialize_demand_board_columns: {
        Args: { p_board_id: string; p_organization_id: string }
        Returns: undefined
      }
      initialize_demand_sla_config: {
        Args: { org_id: string }
        Returns: undefined
      }
      initialize_org_funnel_stages: {
        Args: { org_id: string }
        Returns: undefined
      }
      initialize_org_role_permissions: {
        Args: { org_id: string }
        Returns: undefined
      }
      initialize_organization_energy: {
        Args: { org_id: string; plan_energy: number }
        Returns: undefined
      }
      is_current_user_org_admin: { Args: never; Returns: boolean }
      is_master_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      link_conversation_to_contact: {
        Args: { _contact_id: string; _conversation_id: string }
        Returns: undefined
      }
      match_product_embeddings: {
        Args: {
          filter_organization_id?: string
          filter_product_ids?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content_text: string
          content_type: string
          metadata: Json
          product_id: string
          similarity: number
        }[]
      }
      normalize_cnpj: { Args: { input: string }; Returns: string }
      normalize_phone_digits: { Args: { p: string }; Returns: string }
      normalize_phone_e164: { Args: { phone: string }; Returns: string }
      normalize_text_for_comparison: {
        Args: { input: string }
        Returns: string
      }
      org_has_feature: {
        Args: { _feature_key: string; _org_id: string }
        Returns: boolean
      }
      reopen_whatsapp_conversation: {
        Args: { p_conversation_id: string; p_instance_id: string }
        Returns: Json
      }
      reserve_stock_for_sale: { Args: { _sale_id: string }; Returns: undefined }
      restore_stock_for_cancelled_delivered_sale: {
        Args: { _sale_id: string }
        Returns: undefined
      }
      save_admin_whatsapp_config: { Args: { p_config: Json }; Returns: boolean }
      save_onboarding_data: {
        Args: {
          _business_description?: string
          _cnpj?: string
          _company_site?: string
          _crm_usage_intent?: string
        }
        Returns: undefined
      }
      seed_standard_questions_for_org: {
        Args: { _org_id: string }
        Returns: undefined
      }
      soft_delete_whatsapp_instance: {
        Args: { p_instance_id: string }
        Returns: undefined
      }
      start_bot_handling: {
        Args: { p_bot_id: string; p_conversation_id: string }
        Returns: Json
      }
      transfer_from_bot_to_human: {
        Args: {
          p_conversation_id: string
          p_reason?: string
          p_user_id?: string
        }
        Returns: Json
      }
      transfer_whatsapp_conversation: {
        Args: {
          p_conversation_id: string
          p_notes?: string
          p_to_user_id: string
        }
        Returns: Json
      }
      unreserve_stock_for_sale: {
        Args: { _sale_id: string }
        Returns: undefined
      }
      update_sale_item_cost: {
        Args: { p_cost_cents: number; p_item_id: string }
        Returns: undefined
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_insert_to_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_see_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _action: string; _resource: string; _user_id: string }
        Returns: boolean
      }
      user_has_settings_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      card_brand: "visa" | "master" | "elo" | "amex" | "banricompras"
      card_transaction_type:
        | "debit"
        | "credit_cash"
        | "credit_installment"
        | "credit_predate"
        | "pix"
      carrier_tracking_status:
        | "waiting_post"
        | "posted"
        | "in_destination_city"
        | "attempt_1_failed"
        | "attempt_2_failed"
        | "attempt_3_failed"
        | "waiting_pickup"
        | "returning_to_sender"
        | "delivered"
      delivery_shift: "morning" | "afternoon" | "full_day"
      delivery_status:
        | "pending"
        | "delivered_normal"
        | "delivered_missing_prescription"
        | "delivered_no_money"
        | "delivered_no_card_limit"
        | "delivered_customer_absent"
        | "delivered_customer_denied"
        | "delivered_customer_gave_up"
        | "delivered_wrong_product"
        | "delivered_missing_product"
        | "delivered_insufficient_address"
        | "delivered_wrong_time"
        | "delivered_other"
      delivery_type: "pickup" | "motoboy" | "carrier"
      funnel_stage:
        | "prospect"
        | "contacted"
        | "convincing"
        | "scheduled"
        | "positive"
        | "waiting_payment"
        | "success"
        | "trash"
        | "cloud"
        | "new_lead"
        | "no_contact"
        | "unclassified"
        | "needs_contact"
        | "active_prospecting"
        | "internet_lead"
        | "contact_failed"
        | "contact_success"
        | "scheduling"
        | "no_show"
        | "positive_meeting"
        | "formulating_proposal"
        | "proposal_sent"
        | "paid"
        | "awaiting_contract"
        | "contract_signed"
        | "sale_completed"
        | "post_sale"
        | "awaiting_repurchase"
        | "nurturing"
        | "gave_up"
      installment_flow: "anticipation" | "receive_per_installment"
      motoboy_tracking_status:
        | "waiting_expedition"
        | "expedition_ready"
        | "handed_to_motoboy"
        | "with_motoboy"
        | "next_delivery"
        | "special_delay"
        | "call_motoboy"
        | "delivered"
        | "returned"
      org_role:
        | "owner"
        | "admin"
        | "member"
        | "manager"
        | "seller"
        | "shipping"
        | "finance"
        | "entregador"
        | "delivery"
      payment_category:
        | "cash"
        | "pix"
        | "card_machine"
        | "payment_link"
        | "ecommerce"
        | "boleto_prepaid"
        | "boleto_postpaid"
        | "boleto_installment"
        | "gift"
      post_sale_contact_status:
        | "pending"
        | "attempted_1"
        | "attempted_2"
        | "attempted_3"
        | "sent_whatsapp"
        | "callback_later"
        | "completed_call"
        | "completed_whatsapp"
        | "refused"
        | "not_needed"
      sac_category: "complaint" | "question" | "request" | "financial"
      sac_ticket_priority: "low" | "normal" | "high"
      sac_ticket_status:
        | "pending"
        | "open"
        | "in_progress"
        | "resolved"
        | "closed"
      sale_status:
        | "draft"
        | "pending_expedition"
        | "dispatched"
        | "delivered"
        | "payment_pending"
        | "payment_confirmed"
        | "cancelled"
        | "returned"
      secretary_message_type:
        | "scheduled"
        | "followup"
        | "birthday"
        | "welcome"
        | "reactivation"
      secretary_recipient_type: "owners" | "users"
      standard_question_category:
        | "dores_articulares"
        | "emagrecimento"
        | "diabetes"
        | "saude_geral"
      standard_question_type:
        | "single_choice"
        | "multiple_choice"
        | "number"
        | "imc_calculator"
      subscription_status:
        | "active"
        | "canceled"
        | "past_due"
        | "trialing"
        | "unpaid"
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
      app_role: ["admin", "user"],
      card_brand: ["visa", "master", "elo", "amex", "banricompras"],
      card_transaction_type: [
        "debit",
        "credit_cash",
        "credit_installment",
        "credit_predate",
        "pix",
      ],
      carrier_tracking_status: [
        "waiting_post",
        "posted",
        "in_destination_city",
        "attempt_1_failed",
        "attempt_2_failed",
        "attempt_3_failed",
        "waiting_pickup",
        "returning_to_sender",
        "delivered",
      ],
      delivery_shift: ["morning", "afternoon", "full_day"],
      delivery_status: [
        "pending",
        "delivered_normal",
        "delivered_missing_prescription",
        "delivered_no_money",
        "delivered_no_card_limit",
        "delivered_customer_absent",
        "delivered_customer_denied",
        "delivered_customer_gave_up",
        "delivered_wrong_product",
        "delivered_missing_product",
        "delivered_insufficient_address",
        "delivered_wrong_time",
        "delivered_other",
      ],
      delivery_type: ["pickup", "motoboy", "carrier"],
      funnel_stage: [
        "prospect",
        "contacted",
        "convincing",
        "scheduled",
        "positive",
        "waiting_payment",
        "success",
        "trash",
        "cloud",
        "new_lead",
        "no_contact",
        "unclassified",
        "needs_contact",
        "active_prospecting",
        "internet_lead",
        "contact_failed",
        "contact_success",
        "scheduling",
        "no_show",
        "positive_meeting",
        "formulating_proposal",
        "proposal_sent",
        "paid",
        "awaiting_contract",
        "contract_signed",
        "sale_completed",
        "post_sale",
        "awaiting_repurchase",
        "nurturing",
        "gave_up",
      ],
      installment_flow: ["anticipation", "receive_per_installment"],
      motoboy_tracking_status: [
        "waiting_expedition",
        "expedition_ready",
        "handed_to_motoboy",
        "with_motoboy",
        "next_delivery",
        "special_delay",
        "call_motoboy",
        "delivered",
        "returned",
      ],
      org_role: [
        "owner",
        "admin",
        "member",
        "manager",
        "seller",
        "shipping",
        "finance",
        "entregador",
        "delivery",
      ],
      payment_category: [
        "cash",
        "pix",
        "card_machine",
        "payment_link",
        "ecommerce",
        "boleto_prepaid",
        "boleto_postpaid",
        "boleto_installment",
        "gift",
      ],
      post_sale_contact_status: [
        "pending",
        "attempted_1",
        "attempted_2",
        "attempted_3",
        "sent_whatsapp",
        "callback_later",
        "completed_call",
        "completed_whatsapp",
        "refused",
        "not_needed",
      ],
      sac_category: ["complaint", "question", "request", "financial"],
      sac_ticket_priority: ["low", "normal", "high"],
      sac_ticket_status: [
        "pending",
        "open",
        "in_progress",
        "resolved",
        "closed",
      ],
      sale_status: [
        "draft",
        "pending_expedition",
        "dispatched",
        "delivered",
        "payment_pending",
        "payment_confirmed",
        "cancelled",
        "returned",
      ],
      secretary_message_type: [
        "scheduled",
        "followup",
        "birthday",
        "welcome",
        "reactivation",
      ],
      secretary_recipient_type: ["owners", "users"],
      standard_question_category: [
        "dores_articulares",
        "emagrecimento",
        "diabetes",
        "saude_geral",
      ],
      standard_question_type: [
        "single_choice",
        "multiple_choice",
        "number",
        "imc_calculator",
      ],
      subscription_status: [
        "active",
        "canceled",
        "past_due",
        "trialing",
        "unpaid",
      ],
    },
  },
} as const

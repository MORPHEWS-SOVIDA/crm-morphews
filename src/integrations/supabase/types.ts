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
      lead_products: {
        Row: {
          category: string
          cost_cents: number | null
          created_at: string
          crosssell_product_1_id: string | null
          crosssell_product_2_id: string | null
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          key_question_1: string | null
          key_question_2: string | null
          key_question_3: string | null
          minimum_price: number | null
          minimum_stock: number | null
          name: string
          organization_id: string | null
          price_1_unit: number | null
          price_12_units: number | null
          price_3_units: number | null
          price_6_units: number | null
          sales_script: string | null
          stock_quantity: number | null
          stock_reserved: number | null
          track_stock: boolean | null
          updated_at: string | null
          usage_period_days: number | null
        }
        Insert: {
          category?: string
          cost_cents?: number | null
          created_at?: string
          crosssell_product_1_id?: string | null
          crosssell_product_2_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          key_question_1?: string | null
          key_question_2?: string | null
          key_question_3?: string | null
          minimum_price?: number | null
          minimum_stock?: number | null
          name: string
          organization_id?: string | null
          price_1_unit?: number | null
          price_12_units?: number | null
          price_3_units?: number | null
          price_6_units?: number | null
          sales_script?: string | null
          stock_quantity?: number | null
          stock_reserved?: number | null
          track_stock?: boolean | null
          updated_at?: string | null
          usage_period_days?: number | null
        }
        Update: {
          category?: string
          cost_cents?: number | null
          created_at?: string
          crosssell_product_1_id?: string | null
          crosssell_product_2_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          key_question_1?: string | null
          key_question_2?: string | null
          key_question_3?: string | null
          minimum_price?: number | null
          minimum_stock?: number | null
          name?: string
          organization_id?: string | null
          price_1_unit?: number | null
          price_12_units?: number | null
          price_3_units?: number | null
          price_6_units?: number | null
          sales_script?: string | null
          stock_quantity?: number | null
          stock_reserved?: number | null
          track_stock?: boolean | null
          updated_at?: string | null
          usage_period_days?: number | null
        }
        Relationships: [
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
      leads: {
        Row: {
          assigned_to: string
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
          followers: number | null
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
          whatsapp: string
          whatsapp_group: string | null
        }
        Insert: {
          assigned_to: string
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
          followers?: number | null
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
          whatsapp: string
          whatsapp_group?: string | null
        }
        Update: {
          assigned_to?: string
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
          followers?: number | null
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
      non_purchase_reasons: {
        Row: {
          created_at: string
          followup_hours: number | null
          followup_webhook_url: string | null
          id: string
          is_active: boolean
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
          followup_hours?: number | null
          followup_webhook_url?: string | null
          id?: string
          is_active?: boolean
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
          followup_hours?: number | null
          followup_webhook_url?: string | null
          id?: string
          is_active?: boolean
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
      organization_funnel_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          organization_id: string
          position: number
          stage_type: string
          text_color: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
          position: number
          stage_type?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          position?: number
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
          extension: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          can_see_all_leads?: boolean
          commission_percentage?: number | null
          created_at?: string
          extension?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          can_see_all_leads?: boolean
          commission_percentage?: number | null
          created_at?: string
          extension?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
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
          created_at: string
          id: string
          name: string
          owner_email: string | null
          owner_name: string | null
          phone: string | null
          receptive_module_enabled: boolean
          slug: string
          updated_at: string
          whatsapp_dms_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          receptive_module_enabled?: boolean
          slug: string
          updated_at?: string
          whatsapp_dms_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          receptive_module_enabled?: boolean
          slug?: string
          updated_at?: string
          whatsapp_dms_enabled?: boolean
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          destination_bank: string | null
          destination_cnpj: string | null
          display_order: number | null
          fee_percentage: number | null
          id: string
          is_active: boolean | null
          max_installments: number | null
          min_installment_value_cents: number | null
          name: string
          organization_id: string
          payment_timing: string
          requires_proof: boolean | null
          settlement_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_bank?: string | null
          destination_cnpj?: string | null
          display_order?: number | null
          fee_percentage?: number | null
          id?: string
          is_active?: boolean | null
          max_installments?: number | null
          min_installment_value_cents?: number | null
          name: string
          organization_id: string
          payment_timing?: string
          requires_proof?: boolean | null
          settlement_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_bank?: string | null
          destination_cnpj?: string | null
          display_order?: number | null
          fee_percentage?: number | null
          id?: string
          is_active?: boolean | null
          max_installments?: number | null
          min_installment_value_cents?: number | null
          name?: string
          organization_id?: string
          payment_timing?: string
          requires_proof?: boolean | null
          settlement_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          instagram: string | null
          last_name: string
          organization_id: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          instagram?: string | null
          last_name: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          instagram?: string | null
          last_name?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
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
          completed: boolean
          conversation_mode: string
          created_at: string
          id: string
          lead_existed: boolean
          lead_id: string | null
          non_purchase_reason_id: string | null
          organization_id: string
          phone_searched: string
          product_answers: Json | null
          product_id: string | null
          sale_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          conversation_mode: string
          created_at?: string
          id?: string
          lead_existed?: boolean
          lead_id?: string | null
          non_purchase_reason_id?: string | null
          organization_id: string
          phone_searched: string
          product_answers?: Json | null
          product_id?: string | null
          sale_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          conversation_mode?: string
          created_at?: string
          id?: string
          lead_existed?: boolean
          lead_id?: string | null
          non_purchase_reason_id?: string | null
          organization_id?: string
          phone_searched?: string
          product_answers?: Json | null
          product_id?: string | null
          sale_id?: string | null
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
      sale_installments: {
        Row: {
          amount_cents: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          organization_id: string
          payment_proof_url: string | null
          sale_id: string
          status: string
          total_installments: number
          updated_at: string
        }
        Insert: {
          amount_cents: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date: string
          id?: string
          installment_number?: number
          notes?: string | null
          organization_id: string
          payment_proof_url?: string | null
          sale_id: string
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          organization_id?: string
          payment_proof_url?: string | null
          sale_id?: string
          status?: string
          total_installments?: number
          updated_at?: string
        }
        Relationships: [
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
      sale_items: {
        Row: {
          created_at: string
          discount_cents: number
          id: string
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
          created_at?: string
          discount_cents?: number
          id?: string
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
          created_at?: string
          discount_cents?: number
          id?: string
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
          id: string
          invoice_pdf_url: string | null
          invoice_xml_url: string | null
          lead_id: string
          organization_id: string
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_installments: number | null
          payment_method: string | null
          payment_method_id: string | null
          payment_notes: string | null
          payment_proof_url: string | null
          payment_status: string | null
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
          seller_user_id: string | null
          shipping_carrier_id: string | null
          shipping_cost_cents: number | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal_cents: number
          total_cents: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          assigned_delivery_user_id?: string | null
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
          id?: string
          invoice_pdf_url?: string | null
          invoice_xml_url?: string | null
          lead_id: string
          organization_id: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
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
          seller_user_id?: string | null
          shipping_carrier_id?: string | null
          shipping_cost_cents?: number | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          assigned_delivery_user_id?: string | null
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
          id?: string
          invoice_pdf_url?: string | null
          invoice_xml_url?: string | null
          lead_id?: string
          organization_id?: string
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_installments?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_notes?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
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
          seller_user_id?: string | null
          shipping_carrier_id?: string | null
          shipping_cost_cents?: number | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          updated_at?: string
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
            foreignKeyName: "sales_shipping_carrier_id_fkey"
            columns: ["shipping_carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carriers"
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
          created_at: string
          extra_user_price_cents: number
          id: string
          is_active: boolean
          max_leads: number | null
          max_users: number
          name: string
          price_cents: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          extra_user_price_cents?: number
          id?: string
          is_active?: boolean
          max_leads?: number | null
          max_users: number
          name: string
          price_cents: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          extra_user_price_cents?: number
          id?: string
          is_active?: boolean
          max_leads?: number | null
          max_users?: number
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          extra_users: number
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
          extra_users?: number
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
          extra_users?: number
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
          created_at: string
          deliveries_view_all: boolean
          deliveries_view_own: boolean
          id: string
          instagram_view: boolean
          leads_create: boolean
          leads_delete: boolean
          leads_edit: boolean
          leads_view: boolean
          organization_id: string
          post_sale_manage: boolean
          post_sale_view: boolean
          products_manage: boolean
          products_view: boolean
          products_view_cost: boolean
          receptive_module_access: boolean
          reports_view: boolean
          sales_cancel: boolean
          sales_confirm_payment: boolean
          sales_create: boolean
          sales_dispatch: boolean
          sales_edit_draft: boolean
          sales_mark_delivered: boolean
          sales_validate_expedition: boolean
          sales_view: boolean
          sales_view_all: boolean
          settings_manage: boolean
          settings_view: boolean
          team_view: boolean
          updated_at: string
          user_id: string
          whatsapp_send: boolean
          whatsapp_view: boolean
        }
        Insert: {
          created_at?: string
          deliveries_view_all?: boolean
          deliveries_view_own?: boolean
          id?: string
          instagram_view?: boolean
          leads_create?: boolean
          leads_delete?: boolean
          leads_edit?: boolean
          leads_view?: boolean
          organization_id: string
          post_sale_manage?: boolean
          post_sale_view?: boolean
          products_manage?: boolean
          products_view?: boolean
          products_view_cost?: boolean
          receptive_module_access?: boolean
          reports_view?: boolean
          sales_cancel?: boolean
          sales_confirm_payment?: boolean
          sales_create?: boolean
          sales_dispatch?: boolean
          sales_edit_draft?: boolean
          sales_mark_delivered?: boolean
          sales_validate_expedition?: boolean
          sales_view?: boolean
          sales_view_all?: boolean
          settings_manage?: boolean
          settings_view?: boolean
          team_view?: boolean
          updated_at?: string
          user_id: string
          whatsapp_send?: boolean
          whatsapp_view?: boolean
        }
        Update: {
          created_at?: string
          deliveries_view_all?: boolean
          deliveries_view_own?: boolean
          id?: string
          instagram_view?: boolean
          leads_create?: boolean
          leads_delete?: boolean
          leads_edit?: boolean
          leads_view?: boolean
          organization_id?: string
          post_sale_manage?: boolean
          post_sale_view?: boolean
          products_manage?: boolean
          products_view?: boolean
          products_view_cost?: boolean
          receptive_module_access?: boolean
          reports_view?: boolean
          sales_cancel?: boolean
          sales_confirm_payment?: boolean
          sales_create?: boolean
          sales_dispatch?: boolean
          sales_edit_draft?: boolean
          sales_mark_delivered?: boolean
          sales_validate_expedition?: boolean
          sales_view?: boolean
          sales_view_all?: boolean
          settings_manage?: boolean
          settings_view?: boolean
          team_view?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_send?: boolean
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
      whatsapp_conversations: {
        Row: {
          assigned_user_id: string | null
          chat_id: string | null
          contact_id: string | null
          contact_name: string | null
          contact_profile_pic: string | null
          created_at: string
          current_instance_id: string | null
          customer_phone_e164: string | null
          display_name: string | null
          group_subject: string | null
          id: string
          instance_id: string
          is_group: boolean
          last_message_at: string | null
          lead_id: string | null
          organization_id: string
          phone_number: string
          sendable_phone: string | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          chat_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_profile_pic?: string | null
          created_at?: string
          current_instance_id?: string | null
          customer_phone_e164?: string | null
          display_name?: string | null
          group_subject?: string | null
          id?: string
          instance_id: string
          is_group?: boolean
          last_message_at?: string | null
          lead_id?: string | null
          organization_id: string
          phone_number: string
          sendable_phone?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          chat_id?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_profile_pic?: string | null
          created_at?: string
          current_instance_id?: string | null
          customer_phone_e164?: string | null
          display_name?: string | null
          group_subject?: string | null
          id?: string
          instance_id?: string
          is_group?: boolean
          last_message_at?: string | null
          lead_id?: string | null
          organization_id?: string
          phone_number?: string
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
      whatsapp_instance_users: {
        Row: {
          can_send: boolean
          can_view: boolean
          created_at: string
          id: string
          instance_id: string
          user_id: string
        }
        Insert: {
          can_send?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          instance_id: string
          user_id: string
        }
        Update: {
          can_send?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          instance_id?: string
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
          applied_coupon_id: string | null
          created_at: string
          discount_applied_cents: number | null
          id: string
          is_connected: boolean
          monthly_price_cents: number
          name: string
          organization_id: string
          payment_source: string
          phone_number: string | null
          provider: string
          qr_code_base64: string | null
          status: string
          stripe_subscription_item_id: string | null
          updated_at: string
          wasender_api_key: string | null
          wasender_session_id: string | null
          z_api_client_token: string | null
          z_api_instance_id: string | null
          z_api_token: string | null
        }
        Insert: {
          applied_coupon_id?: string | null
          created_at?: string
          discount_applied_cents?: number | null
          id?: string
          is_connected?: boolean
          monthly_price_cents?: number
          name: string
          organization_id: string
          payment_source?: string
          phone_number?: string | null
          provider?: string
          qr_code_base64?: string | null
          status?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
          wasender_api_key?: string | null
          wasender_session_id?: string | null
          z_api_client_token?: string | null
          z_api_instance_id?: string | null
          z_api_token?: string | null
        }
        Update: {
          applied_coupon_id?: string | null
          created_at?: string
          discount_applied_cents?: number | null
          id?: string
          is_connected?: boolean
          monthly_price_cents?: number
          name?: string
          organization_id?: string
          payment_source?: string
          phone_number?: string | null
          provider?: string
          qr_code_base64?: string | null
          status?: string
          stripe_subscription_item_id?: string | null
          updated_at?: string
          wasender_api_key?: string | null
          wasender_session_id?: string | null
          z_api_client_token?: string | null
          z_api_instance_id?: string | null
          z_api_token?: string | null
        }
        Relationships: [
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
          status: string | null
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
          status?: string | null
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
          status?: string | null
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
          wasender_api_key: string | null
          z_api_client_token: string | null
          z_api_token: string | null
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
          wasender_api_key?: string | null
          z_api_client_token?: string | null
          z_api_token?: string | null
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
          wasender_api_key?: string | null
          z_api_client_token?: string | null
          z_api_token?: string | null
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
          assigned_user_id: string | null
          chat_id: string | null
          contact_id: string | null
          contact_name: string | null
          contact_profile_pic: string | null
          created_at: string | null
          current_instance_id: string | null
          customer_phone_e164: string | null
          display_name: string | null
          group_subject: string | null
          id: string | null
          instance_id: string | null
          is_group: boolean | null
          last_message_at: string | null
          lead_email: string | null
          lead_id: string | null
          lead_instagram: string | null
          lead_name: string | null
          lead_secondary_phone: string | null
          lead_stage: Database["public"]["Enums"]["funnel_stage"] | null
          lead_whatsapp: string | null
          organization_id: string | null
          phone_number: string | null
          sendable_phone: string | null
          status: string | null
          title: string | null
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
      backfill_contacts_from_existing_conversations: {
        Args: { _organization_id: string }
        Returns: number
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
      get_default_permissions_for_role: {
        Args: { _role: string }
        Returns: Json
      }
      get_or_create_contact_by_phone: {
        Args: { _name?: string; _organization_id: string; _phone: string }
        Returns: string
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
      initialize_org_funnel_stages: {
        Args: { org_id: string }
        Returns: undefined
      }
      initialize_org_role_permissions: {
        Args: { org_id: string }
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
      normalize_phone_e164: { Args: { phone: string }; Returns: string }
      reserve_stock_for_sale: { Args: { _sale_id: string }; Returns: undefined }
      restore_stock_for_cancelled_delivered_sale: {
        Args: { _sale_id: string }
        Returns: undefined
      }
      save_onboarding_data: {
        Args: {
          _business_description?: string
          _cnpj?: string
          _company_site?: string
          _crm_usage_intent?: string
        }
        Returns: undefined
      }
      unreserve_stock_for_sale: {
        Args: { _sale_id: string }
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
    }
    Enums: {
      app_role: "admin" | "user"
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
      sale_status:
        | "draft"
        | "pending_expedition"
        | "dispatched"
        | "delivered"
        | "payment_pending"
        | "payment_confirmed"
        | "cancelled"
        | "returned"
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

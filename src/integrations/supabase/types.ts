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
      lead_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key_question_1: string | null
          key_question_2: string | null
          key_question_3: string | null
          minimum_price: number | null
          name: string
          organization_id: string | null
          price_1_unit: number | null
          price_12_units: number | null
          price_3_units: number | null
          price_6_units: number | null
          sales_script: string | null
          updated_at: string | null
          usage_period_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key_question_1?: string | null
          key_question_2?: string | null
          key_question_3?: string | null
          minimum_price?: number | null
          name: string
          organization_id?: string | null
          price_1_unit?: number | null
          price_12_units?: number | null
          price_3_units?: number | null
          price_6_units?: number | null
          sales_script?: string | null
          updated_at?: string | null
          usage_period_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key_question_1?: string | null
          key_question_2?: string | null
          key_question_3?: string | null
          minimum_price?: number | null
          name?: string
          organization_id?: string | null
          price_1_unit?: number | null
          price_12_units?: number | null
          price_3_units?: number | null
          price_6_units?: number | null
          sales_script?: string | null
          updated_at?: string | null
          usage_period_days?: number | null
        }
        Relationships: [
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
          desired_products: string | null
          email: string | null
          followers: number | null
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
          desired_products?: string | null
          email?: string | null
          followers?: number | null
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
          desired_products?: string | null
          email?: string | null
          followers?: number | null
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
          updated_at?: string
          whatsapp?: string
          whatsapp_group?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          can_see_all_leads?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          can_see_all_leads?: boolean
          created_at?: string
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
          slug?: string
          updated_at?: string
          whatsapp_dms_enabled?: boolean
        }
        Relationships: []
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
      find_contact_by_phone: {
        Args: { _organization_id: string; _phone: string }
        Returns: string
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
      save_onboarding_data: {
        Args: {
          _business_description?: string
          _cnpj?: string
          _company_site?: string
          _crm_usage_intent?: string
        }
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

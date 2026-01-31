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
      accounts_payable: {
        Row: {
          amount_cents: number
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string | null
          barcode: string | null
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          discount_cents: number | null
          document_number: string | null
          due_date: string
          fine_cents: number | null
          id: string
          installment_number: number | null
          interest_cents: number | null
          is_recurring: boolean | null
          issue_date: string
          notes: string | null
          organization_id: string
          paid_amount_cents: number | null
          paid_at: string | null
          parent_payable_id: string | null
          payment_method: string | null
          pix_code: string | null
          purchase_invoice_id: string | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          requires_approval: boolean | null
          status: string | null
          supplier_id: string | null
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          discount_cents?: number | null
          document_number?: string | null
          due_date: string
          fine_cents?: number | null
          id?: string
          installment_number?: number | null
          interest_cents?: number | null
          is_recurring?: boolean | null
          issue_date: string
          notes?: string | null
          organization_id: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          parent_payable_id?: string | null
          payment_method?: string | null
          pix_code?: string | null
          purchase_invoice_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          requires_approval?: boolean | null
          status?: string | null
          supplier_id?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string | null
          barcode?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          discount_cents?: number | null
          document_number?: string | null
          due_date?: string
          fine_cents?: number | null
          id?: string
          installment_number?: number | null
          interest_cents?: number | null
          is_recurring?: boolean | null
          issue_date?: string
          notes?: string | null
          organization_id?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          parent_payable_id?: string | null
          payment_method?: string | null
          pix_code?: string | null
          purchase_invoice_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          requires_approval?: boolean | null
          status?: string | null
          supplier_id?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "payment_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_parent_payable_id_fkey"
            columns: ["parent_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_attributions: {
        Row: {
          affiliate_id: string | null
          attribution_type: string
          code_or_ref: string | null
          created_at: string
          id: string
          organization_id: string
          sale_id: string
        }
        Insert: {
          affiliate_id?: string | null
          attribution_type: string
          code_or_ref?: string | null
          created_at?: string
          id?: string
          organization_id: string
          sale_id: string
        }
        Update: {
          affiliate_id?: string | null
          attribution_type?: string
          code_or_ref?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_attributions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_attributions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_attributions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_network_checkouts: {
        Row: {
          checkout_id: string
          created_at: string
          id: string
          network_id: string
          organization_id: string
        }
        Insert: {
          checkout_id: string
          created_at?: string
          id?: string
          network_id: string
          organization_id: string
        }
        Update: {
          checkout_id?: string
          created_at?: string
          id?: string
          network_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_network_checkouts_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "standalone_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_checkouts_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "affiliate_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_checkouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_network_landings: {
        Row: {
          created_at: string
          id: string
          landing_page_id: string
          network_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          landing_page_id: string
          network_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          landing_page_id?: string
          network_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_network_landings_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_landings_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "affiliate_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_landings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_network_members: {
        Row: {
          affiliate_id: string | null
          commission_type: string
          commission_value: number
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string
          network_id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          commission_type?: string
          commission_value?: number
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          network_id: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string | null
          commission_type?: string
          commission_value?: number
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          network_id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_network_members_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "organization_affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_members_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "affiliate_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_network_storefronts: {
        Row: {
          created_at: string
          id: string
          network_id: string
          organization_id: string
          storefront_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          network_id: string
          organization_id: string
          storefront_id: string
        }
        Update: {
          created_at?: string
          id?: string
          network_id?: string
          organization_id?: string
          storefront_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_network_storefronts_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "affiliate_networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_storefronts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_network_storefronts_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_networks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          is_active: boolean
          name: string
          organization_id: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          name: string
          organization_id: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_networks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          commission_fixed_cents: number | null
          commission_percentage: number | null
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string
          total_commission_cents: number | null
          total_sales: number | null
          updated_at: string
          virtual_account_id: string
        }
        Insert: {
          affiliate_code: string
          commission_fixed_cents?: number | null
          commission_percentage?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          total_commission_cents?: number | null
          total_sales?: number | null
          updated_at?: string
          virtual_account_id: string
        }
        Update: {
          affiliate_code?: string
          commission_fixed_cents?: number | null
          commission_percentage?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          total_commission_cents?: number | null
          total_sales?: number | null
          updated_at?: string
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliates_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
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
          ai_model_chat: string | null
          audio_response_probability: number | null
          avatar_url: string | null
          brazilian_state: string | null
          company_differential: string | null
          company_name: string | null
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
          product_media_confidence_threshold: number | null
          product_scope: string | null
          regional_expressions: string[] | null
          response_length: string
          send_product_images: boolean | null
          send_product_links: boolean | null
          send_product_videos: boolean | null
          service_type: string
          system_prompt: string
          transfer_keywords: string[] | null
          transfer_message: string | null
          transfer_on_confusion: boolean | null
          updated_at: string
          use_rag_search: boolean | null
          voice_enabled: boolean | null
          voice_id: string | null
          voice_name: string | null
          voice_style: string | null
          welcome_message: string | null
          working_days: number[] | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          age_range?: string
          ai_model_chat?: string | null
          audio_response_probability?: number | null
          avatar_url?: string | null
          brazilian_state?: string | null
          company_differential?: string | null
          company_name?: string | null
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
          product_media_confidence_threshold?: number | null
          product_scope?: string | null
          regional_expressions?: string[] | null
          response_length?: string
          send_product_images?: boolean | null
          send_product_links?: boolean | null
          send_product_videos?: boolean | null
          service_type?: string
          system_prompt?: string
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_on_confusion?: boolean | null
          updated_at?: string
          use_rag_search?: boolean | null
          voice_enabled?: boolean | null
          voice_id?: string | null
          voice_name?: string | null
          voice_style?: string | null
          welcome_message?: string | null
          working_days?: number[] | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          age_range?: string
          ai_model_chat?: string | null
          audio_response_probability?: number | null
          avatar_url?: string | null
          brazilian_state?: string | null
          company_differential?: string | null
          company_name?: string | null
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
          product_media_confidence_threshold?: number | null
          product_scope?: string | null
          regional_expressions?: string[] | null
          response_length?: string
          send_product_images?: boolean | null
          send_product_links?: boolean | null
          send_product_videos?: boolean | null
          service_type?: string
          system_prompt?: string
          transfer_keywords?: string[] | null
          transfer_message?: string | null
          transfer_on_confusion?: boolean | null
          updated_at?: string
          use_rag_search?: boolean | null
          voice_enabled?: boolean | null
          voice_id?: string | null
          voice_name?: string | null
          voice_style?: string | null
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
      ai_lead_suggestions: {
        Row: {
          created_at: string
          energy_consumed: number | null
          feedback: string | null
          feedback_at: string | null
          feedback_note: string | null
          id: string
          lead_id: string
          lead_name: string
          lead_whatsapp: string | null
          organization_id: string
          priority: string | null
          reason: string
          recommended_products: string[] | null
          status: string
          suggested_action: string | null
          suggested_script: string | null
          suggestion_type: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          energy_consumed?: number | null
          feedback?: string | null
          feedback_at?: string | null
          feedback_note?: string | null
          id?: string
          lead_id: string
          lead_name: string
          lead_whatsapp?: string | null
          organization_id: string
          priority?: string | null
          reason: string
          recommended_products?: string[] | null
          status?: string
          suggested_action?: string | null
          suggested_script?: string | null
          suggestion_type: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          energy_consumed?: number | null
          feedback?: string | null
          feedback_at?: string | null
          feedback_note?: string | null
          id?: string
          lead_id?: string
          lead_name?: string
          lead_whatsapp?: string | null
          organization_id?: string
          priority?: string | null
          reason?: string
          recommended_products?: string[] | null
          status?: string
          suggested_action?: string | null
          suggested_script?: string | null
          suggestion_type?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_lead_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_lead_suggestions_organization_id_fkey"
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
      bank_accounts: {
        Row: {
          account_digit: string | null
          account_number: string | null
          account_type: string | null
          agency: string | null
          agency_digit: string | null
          bank_code: string | null
          bank_name: string | null
          color: string | null
          created_at: string
          current_balance_cents: number | null
          id: string
          initial_balance_cents: number | null
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          account_digit?: string | null
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          agency_digit?: string | null
          bank_code?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance_cents?: number | null
          id?: string
          initial_balance_cents?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          account_digit?: string | null
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          agency_digit?: string | null
          bank_code?: string | null
          bank_name?: string | null
          color?: string | null
          created_at?: string
          current_balance_cents?: number | null
          id?: string
          initial_balance_cents?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_payable_id: string | null
          amount_cents: number
          bank_account_id: string
          check_number: string | null
          created_at: string
          description: string | null
          fitid: string | null
          id: string
          import_batch_id: string | null
          is_reconciled: boolean | null
          manual_entry_id: string | null
          memo: string | null
          organization_id: string
          reconciled_at: string | null
          reconciled_by: string | null
          ref_number: string | null
          sale_installment_id: string | null
          transaction_date: string
          transaction_type: string | null
        }
        Insert: {
          account_payable_id?: string | null
          amount_cents: number
          bank_account_id: string
          check_number?: string | null
          created_at?: string
          description?: string | null
          fitid?: string | null
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          manual_entry_id?: string | null
          memo?: string | null
          organization_id: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          ref_number?: string | null
          sale_installment_id?: string | null
          transaction_date: string
          transaction_type?: string | null
        }
        Update: {
          account_payable_id?: string | null
          amount_cents?: number
          bank_account_id?: string
          check_number?: string | null
          created_at?: string
          description?: string | null
          fitid?: string | null
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          manual_entry_id?: string | null
          memo?: string | null
          organization_id?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          ref_number?: string | null
          sale_installment_id?: string | null
          transaction_date?: string
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_sale_installment_id_fkey"
            columns: ["sale_installment_id"]
            isOneToOne: false
            referencedRelation: "sale_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_team_members: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          organization_id: string
          role: string
          team_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          team_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_team_members_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "bot_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_team_routes: {
        Row: {
          condition_label: string | null
          condition_type: string
          created_at: string
          crm_conditions: Json | null
          id: string
          intent_description: string | null
          is_active: boolean
          keywords: string[] | null
          organization_id: string
          priority: number
          route_type: string
          sentiment_conditions: string[] | null
          target_bot_id: string
          team_id: string
          time_conditions: Json | null
          updated_at: string
        }
        Insert: {
          condition_label?: string | null
          condition_type?: string
          created_at?: string
          crm_conditions?: Json | null
          id?: string
          intent_description?: string | null
          is_active?: boolean
          keywords?: string[] | null
          organization_id: string
          priority?: number
          route_type?: string
          sentiment_conditions?: string[] | null
          target_bot_id: string
          team_id: string
          time_conditions?: Json | null
          updated_at?: string
        }
        Update: {
          condition_label?: string | null
          condition_type?: string
          created_at?: string
          crm_conditions?: Json | null
          id?: string
          intent_description?: string | null
          is_active?: boolean
          keywords?: string[] | null
          organization_id?: string
          priority?: number
          route_type?: string
          sentiment_conditions?: string[] | null
          target_bot_id?: string
          team_id?: string
          time_conditions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_team_routes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_team_routes_target_bot_id_fkey"
            columns: ["target_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_team_routes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "bot_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_teams: {
        Row: {
          created_at: string
          description: string | null
          fallback_bot_id: string | null
          id: string
          initial_bot_id: string | null
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fallback_bot_id?: string | null
          id?: string
          initial_bot_id?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fallback_bot_id?: string | null
          id?: string
          initial_bot_id?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_teams_fallback_bot_id_fkey"
            columns: ["fallback_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_teams_initial_bot_id_fkey"
            columns: ["initial_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      cash_payment_confirmations: {
        Row: {
          amount_cents: number | null
          confirmation_type: string
          confirmed_by: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          sale_id: string
        }
        Insert: {
          amount_cents?: number | null
          confirmation_type: string
          confirmed_by: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          sale_id: string
        }
        Update: {
          amount_cents?: number | null
          confirmation_type?: string
          confirmed_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_payment_confirmations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cash_payment_confirmations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_payment_confirmations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_affiliate_links: {
        Row: {
          affiliate_id: string
          checkout_id: string
          commission_type: string
          commission_value: number
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          affiliate_id: string
          checkout_id: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          affiliate_id?: string
          checkout_id?: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_affiliate_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "organization_affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_affiliate_links_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "standalone_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_affiliate_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_testimonials: {
        Row: {
          author_location: string | null
          author_name: string
          author_photo_url: string | null
          checkout_id: string
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string
          position: number | null
          rating: number | null
        }
        Insert: {
          author_location?: string | null
          author_name: string
          author_photo_url?: string | null
          checkout_id: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          position?: number | null
          rating?: number | null
        }
        Update: {
          author_location?: string | null
          author_name?: string
          author_photo_url?: string | null
          checkout_id?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          position?: number | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_testimonials_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "standalone_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_testimonials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          auto_classified: boolean | null
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
          auto_classified?: boolean | null
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
          auto_classified?: boolean | null
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
      conversion_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          lead_id: string | null
          organization_id: string
          payload: Json | null
          platform: string
          response: Json | null
          sale_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          organization_id: string
          payload?: Json | null
          platform: string
          response?: Json | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          organization_id?: string
          payload?: Json | null
          platform?: string
          response?: Json | null
          sale_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      coproducers: {
        Row: {
          commission_percentage: number
          created_at: string
          id: string
          is_active: boolean | null
          product_id: string
          virtual_account_id: string
        }
        Insert: {
          commission_percentage: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          product_id: string
          virtual_account_id: string
        }
        Update: {
          commission_percentage?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          product_id?: string
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coproducers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coproducers_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      correios_config: {
        Row: {
          ambiente: string
          cartao_postagem: string | null
          codigo_acesso_encrypted: string | null
          contrato: string | null
          created_at: string
          default_height_cm: number | null
          default_length_cm: number | null
          default_package_type: string | null
          default_service_code: string | null
          default_weight_grams: number | null
          default_width_cm: number | null
          id: string
          id_correios: string | null
          is_active: boolean
          organization_id: string
          sender_cep: string | null
          sender_city: string | null
          sender_complement: string | null
          sender_cpf_cnpj: string | null
          sender_email: string | null
          sender_name: string | null
          sender_neighborhood: string | null
          sender_number: string | null
          sender_phone: string | null
          sender_state: string | null
          sender_street: string | null
          updated_at: string
        }
        Insert: {
          ambiente?: string
          cartao_postagem?: string | null
          codigo_acesso_encrypted?: string | null
          contrato?: string | null
          created_at?: string
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_package_type?: string | null
          default_service_code?: string | null
          default_weight_grams?: number | null
          default_width_cm?: number | null
          id?: string
          id_correios?: string | null
          is_active?: boolean
          organization_id: string
          sender_cep?: string | null
          sender_city?: string | null
          sender_complement?: string | null
          sender_cpf_cnpj?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_neighborhood?: string | null
          sender_number?: string | null
          sender_phone?: string | null
          sender_state?: string | null
          sender_street?: string | null
          updated_at?: string
        }
        Update: {
          ambiente?: string
          cartao_postagem?: string | null
          codigo_acesso_encrypted?: string | null
          contrato?: string | null
          created_at?: string
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_package_type?: string | null
          default_service_code?: string | null
          default_weight_grams?: number | null
          default_width_cm?: number | null
          id?: string
          id_correios?: string | null
          is_active?: boolean
          organization_id?: string
          sender_cep?: string | null
          sender_city?: string | null
          sender_complement?: string | null
          sender_cpf_cnpj?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_neighborhood?: string | null
          sender_number?: string | null
          sender_phone?: string | null
          sender_state?: string | null
          sender_street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correios_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      correios_enabled_services: {
        Row: {
          created_at: string
          extra_handling_days: number
          id: string
          is_enabled: boolean
          organization_id: string
          picking_cost_cents: number
          position: number
          service_code: string
          service_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_handling_days?: number
          id?: string
          is_enabled?: boolean
          organization_id: string
          picking_cost_cents?: number
          position?: number
          service_code: string
          service_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_handling_days?: number
          id?: string
          is_enabled?: boolean
          organization_id?: string
          picking_cost_cents?: number
          position?: number
          service_code?: string
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correios_enabled_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      correios_labels: {
        Row: {
          api_response: Json | null
          correios_prepostagem_id: string | null
          created_at: string
          created_by: string | null
          declaration_pdf_url: string | null
          declared_value_cents: number | null
          error_message: string | null
          height_cm: number | null
          id: string
          label_pdf_url: string | null
          length_cm: number | null
          organization_id: string
          posted_at: string | null
          recipient_cep: string
          recipient_city: string | null
          recipient_complement: string | null
          recipient_cpf_cnpj: string | null
          recipient_name: string
          recipient_neighborhood: string | null
          recipient_number: string | null
          recipient_phone: string | null
          recipient_state: string | null
          recipient_street: string | null
          sale_id: string | null
          service_code: string
          service_name: string | null
          status: string
          tracking_code: string
          updated_at: string
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          api_response?: Json | null
          correios_prepostagem_id?: string | null
          created_at?: string
          created_by?: string | null
          declaration_pdf_url?: string | null
          declared_value_cents?: number | null
          error_message?: string | null
          height_cm?: number | null
          id?: string
          label_pdf_url?: string | null
          length_cm?: number | null
          organization_id: string
          posted_at?: string | null
          recipient_cep: string
          recipient_city?: string | null
          recipient_complement?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_name: string
          recipient_neighborhood?: string | null
          recipient_number?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_street?: string | null
          sale_id?: string | null
          service_code: string
          service_name?: string | null
          status?: string
          tracking_code: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          api_response?: Json | null
          correios_prepostagem_id?: string | null
          created_at?: string
          created_by?: string | null
          declaration_pdf_url?: string | null
          declared_value_cents?: number | null
          error_message?: string | null
          height_cm?: number | null
          id?: string
          label_pdf_url?: string | null
          length_cm?: number | null
          organization_id?: string
          posted_at?: string | null
          recipient_cep?: string
          recipient_city?: string | null
          recipient_complement?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_name?: string
          recipient_neighborhood?: string | null
          recipient_number?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_street?: string | null
          sale_id?: string | null
          service_code?: string
          service_name?: string | null
          status?: string
          tracking_code?: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "correios_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correios_labels_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      correios_quote_cache: {
        Row: {
          cached_at: string
          delivery_days: number | null
          destination_cep: string
          expires_at: string
          id: string
          organization_id: string
          origin_cep: string
          price_cents: number
          service_code: string
          weight_grams: number
        }
        Insert: {
          cached_at?: string
          delivery_days?: number | null
          destination_cep: string
          expires_at?: string
          id?: string
          organization_id: string
          origin_cep: string
          price_cents: number
          service_code: string
          weight_grams: number
        }
        Update: {
          cached_at?: string
          delivery_days?: number | null
          destination_cep?: string
          expires_at?: string
          id?: string
          organization_id?: string
          origin_cep?: string
          price_cents?: number
          service_code?: string
          weight_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "correios_quote_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          attributed_affiliate_id: string | null
          cart_id: string | null
          coupon_id: string
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          discount_cents: number
          id: string
          organization_id: string
          sale_id: string | null
        }
        Insert: {
          attributed_affiliate_id?: string | null
          cart_id?: string | null
          coupon_id: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          discount_cents: number
          id?: string
          organization_id: string
          sale_id?: string | null
        }
        Update: {
          attributed_affiliate_id?: string | null
          cart_id?: string | null
          coupon_id?: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          discount_cents?: number
          id?: string
          organization_id?: string
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_attributed_affiliate_id_fkey"
            columns: ["attributed_affiliate_id"]
            isOneToOne: false
            referencedRelation: "organization_affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          affiliate_id: string | null
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_order_cents: number | null
          organization_id: string
          product_ids: string[] | null
          redemptions_count: number
          updated_at: string
        }
        Insert: {
          affiliate_id?: string | null
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_order_cents?: number | null
          organization_id: string
          product_ids?: string[] | null
          redemptions_count?: number
          updated_at?: string
        }
        Update: {
          affiliate_id?: string | null
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_order_cents?: number | null
          organization_id?: string
          product_ids?: string[] | null
          redemptions_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_organization_id_fkey"
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
          affiliate_only: boolean | null
          allow_with_affiliate: boolean | null
          applies_to: string | null
          auto_attribute_affiliate_id: string | null
          code: string
          combo_ids: string[] | null
          created_at: string
          created_by: string | null
          current_uses: number
          description: string | null
          discount_type: string | null
          discount_value_cents: number
          id: string
          is_active: boolean
          max_uses: number | null
          max_uses_per_customer: number | null
          min_order_cents: number | null
          name: string | null
          organization_id: string | null
          product_ids: string[] | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          affiliate_only?: boolean | null
          allow_with_affiliate?: boolean | null
          applies_to?: string | null
          auto_attribute_affiliate_id?: string | null
          code: string
          combo_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string | null
          discount_value_cents?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number | null
          min_order_cents?: number | null
          name?: string | null
          organization_id?: string | null
          product_ids?: string[] | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          affiliate_only?: boolean | null
          allow_with_affiliate?: boolean | null
          applies_to?: string | null
          auto_attribute_affiliate_id?: string | null
          code?: string
          combo_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          current_uses?: number
          description?: string | null
          discount_type?: string | null
          discount_value_cents?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number | null
          min_order_cents?: number | null
          name?: string | null
          organization_id?: string | null
          product_ids?: string[] | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_coupons_auto_attribute_affiliate_id_fkey"
            columns: ["auto_attribute_affiliate_id"]
            isOneToOne: false
            referencedRelation: "organization_affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_coupons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_automation_config: {
        Row: {
          cart_abandonment_minutes: number
          cart_recovery_reason_id: string | null
          created_at: string
          default_seller_id: string | null
          email_recovery_delay_minutes: number
          enable_email_recovery: boolean
          enable_whatsapp_recovery: boolean
          id: string
          lead_assigned_user_id: string | null
          lead_creation_trigger: string
          lead_default_assignment: string | null
          lead_funnel_stage_id: string | null
          notify_team_on_cart: boolean
          notify_team_on_payment: boolean
          organization_id: string
          paid_notification_funnel_stage_id: string | null
          receptivo_sale_funnel_stage_id: string | null
          updated_at: string
          whatsapp_recovery_delay_minutes: number
        }
        Insert: {
          cart_abandonment_minutes?: number
          cart_recovery_reason_id?: string | null
          created_at?: string
          default_seller_id?: string | null
          email_recovery_delay_minutes?: number
          enable_email_recovery?: boolean
          enable_whatsapp_recovery?: boolean
          id?: string
          lead_assigned_user_id?: string | null
          lead_creation_trigger?: string
          lead_default_assignment?: string | null
          lead_funnel_stage_id?: string | null
          notify_team_on_cart?: boolean
          notify_team_on_payment?: boolean
          organization_id: string
          paid_notification_funnel_stage_id?: string | null
          receptivo_sale_funnel_stage_id?: string | null
          updated_at?: string
          whatsapp_recovery_delay_minutes?: number
        }
        Update: {
          cart_abandonment_minutes?: number
          cart_recovery_reason_id?: string | null
          created_at?: string
          default_seller_id?: string | null
          email_recovery_delay_minutes?: number
          enable_email_recovery?: boolean
          enable_whatsapp_recovery?: boolean
          id?: string
          lead_assigned_user_id?: string | null
          lead_creation_trigger?: string
          lead_default_assignment?: string | null
          lead_funnel_stage_id?: string | null
          notify_team_on_cart?: boolean
          notify_team_on_payment?: boolean
          organization_id?: string
          paid_notification_funnel_stage_id?: string | null
          receptivo_sale_funnel_stage_id?: string | null
          updated_at?: string
          whatsapp_recovery_delay_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_automation_config_cart_recovery_reason_id_fkey"
            columns: ["cart_recovery_reason_id"]
            isOneToOne: false
            referencedRelation: "non_purchase_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_automation_config_default_seller_id_fkey"
            columns: ["default_seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ecommerce_automation_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_automation_config_paid_notification_funnel_stage_fkey"
            columns: ["paid_notification_funnel_stage_id"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_automation_config_receptivo_sale_funnel_stage_id_fkey"
            columns: ["receptivo_sale_funnel_stage_id"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          landing_offer_id: string | null
          product_id: string
          quantity: number
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          landing_offer_id?: string | null
          product_id: string
          quantity?: number
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          landing_offer_id?: string | null
          product_id?: string
          quantity?: number
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_cart_items_landing_offer_id_fkey"
            columns: ["landing_offer_id"]
            isOneToOne: false
            referencedRelation: "landing_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_carts: {
        Row: {
          abandoned_at: string | null
          affiliate_id: string | null
          converted_sale_id: string | null
          coupon_code: string | null
          coupon_discount_cents: number | null
          coupon_id: string | null
          created_at: string
          customer_cpf: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_cents: number | null
          expires_at: string | null
          fbclid: string | null
          gclid: string | null
          id: string
          items: Json | null
          landing_page_id: string | null
          lead_id: string | null
          offer_id: string | null
          organization_id: string
          recovery_email_sent_at: string | null
          recovery_sent_at: string | null
          recovery_whatsapp_sent_at: string | null
          session_id: string
          shipping_address: string | null
          shipping_cents: number | null
          shipping_cep: string | null
          shipping_city: string | null
          shipping_state: string | null
          src: string | null
          status: string | null
          storefront_id: string | null
          subtotal_cents: number | null
          total_cents: number | null
          ttclid: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          abandoned_at?: string | null
          affiliate_id?: string | null
          converted_sale_id?: string | null
          coupon_code?: string | null
          coupon_discount_cents?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_cents?: number | null
          expires_at?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          items?: Json | null
          landing_page_id?: string | null
          lead_id?: string | null
          offer_id?: string | null
          organization_id: string
          recovery_email_sent_at?: string | null
          recovery_sent_at?: string | null
          recovery_whatsapp_sent_at?: string | null
          session_id: string
          shipping_address?: string | null
          shipping_cents?: number | null
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          src?: string | null
          status?: string | null
          storefront_id?: string | null
          subtotal_cents?: number | null
          total_cents?: number | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          abandoned_at?: string | null
          affiliate_id?: string | null
          converted_sale_id?: string | null
          coupon_code?: string | null
          coupon_discount_cents?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_cents?: number | null
          expires_at?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          items?: Json | null
          landing_page_id?: string | null
          lead_id?: string | null
          offer_id?: string | null
          organization_id?: string
          recovery_email_sent_at?: string | null
          recovery_sent_at?: string | null
          recovery_whatsapp_sent_at?: string | null
          session_id?: string
          shipping_address?: string | null
          shipping_cents?: number | null
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          src?: string | null
          status?: string | null
          storefront_id?: string | null
          subtotal_cents?: number | null
          total_cents?: number | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_carts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "organization_affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_carts_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_carts_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "discount_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_carts_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_carts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_carts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "landing_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_carts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_carts_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_image_url: string | null
          product_name: string
          quantity: number
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_image_url?: string | null
          product_name: string
          quantity?: number
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_orders: {
        Row: {
          affiliate_commission_cents: number | null
          affiliate_id: string | null
          canceled_at: string | null
          carrier: string | null
          cart_id: string | null
          created_at: string
          customer_cpf: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          discount_cents: number
          fbclid: string | null
          gclid: string | null
          id: string
          internal_notes: string | null
          landing_page_id: string | null
          lead_id: string | null
          order_number: string
          organization_id: string
          paid_at: string | null
          payment_gateway: string | null
          payment_method: string | null
          payment_transaction_id: string | null
          sale_id: string | null
          shipped_at: string | null
          shipping_cents: number
          shipping_cep: string | null
          shipping_city: string | null
          shipping_complement: string | null
          shipping_neighborhood: string | null
          shipping_number: string | null
          shipping_state: string | null
          shipping_street: string | null
          source: string | null
          status: string
          storefront_id: string | null
          subtotal_cents: number
          total_cents: number
          tracking_code: string | null
          ttclid: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          affiliate_commission_cents?: number | null
          affiliate_id?: string | null
          canceled_at?: string | null
          carrier?: string | null
          cart_id?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          discount_cents?: number
          fbclid?: string | null
          gclid?: string | null
          id?: string
          internal_notes?: string | null
          landing_page_id?: string | null
          lead_id?: string | null
          order_number?: string
          organization_id: string
          paid_at?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_transaction_id?: string | null
          sale_id?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          source?: string | null
          status?: string
          storefront_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          affiliate_commission_cents?: number | null
          affiliate_id?: string | null
          canceled_at?: string | null
          carrier?: string | null
          cart_id?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          discount_cents?: number
          fbclid?: string | null
          gclid?: string | null
          id?: string
          internal_notes?: string | null
          landing_page_id?: string | null
          lead_id?: string | null
          order_number?: string
          organization_id?: string
          paid_at?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_transaction_id?: string | null
          sale_id?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          shipping_cep?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          source?: string | null
          status?: string
          storefront_id?: string | null
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "organization_affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_orders_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          clicked_at: string | null
          created_at: string
          email: string
          energy_cost: number | null
          enrollment_id: string | null
          error_message: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          opened_at: string | null
          organization_id: string
          resend_id: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_id: string | null
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string
          email: string
          energy_cost?: number | null
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          organization_id: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
        }
        Update: {
          clicked_at?: string | null
          created_at?: string
          email?: string
          energy_cost?: number | null
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number | null
          email: string
          id: string
          lead_id: string | null
          next_send_at: string | null
          organization_id: string
          sequence_id: string
          status: string | null
          triggered_at: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          email: string
          id?: string
          lead_id?: string | null
          next_send_at?: string | null
          organization_id: string
          sequence_id: string
          status?: string | null
          triggered_at?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number | null
          email?: string
          id?: string
          lead_id?: string | null
          next_send_at?: string | null
          organization_id?: string
          sequence_id?: string
          status?: string | null
          triggered_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_presets: {
        Row: {
          created_at: string
          default_html_template: string
          default_subject: string
          delay_minutes: number
          id: string
          is_active: boolean | null
          preset_type: string
          step_number: number
          variables: Json | null
        }
        Insert: {
          created_at?: string
          default_html_template: string
          default_subject: string
          delay_minutes?: number
          id?: string
          is_active?: boolean | null
          preset_type: string
          step_number: number
          variables?: Json | null
        }
        Update: {
          created_at?: string
          default_html_template?: string
          default_subject?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean | null
          preset_type?: string
          step_number?: number
          variables?: Json | null
        }
        Relationships: []
      }
      email_sequence_steps: {
        Row: {
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean | null
          organization_id: string
          sequence_id: string
          step_order: number
          subject_override: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean | null
          organization_id: string
          sequence_id: string
          step_order?: number
          subject_override?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean | null
          organization_id?: string
          sequence_id?: string
          step_order?: number
          subject_override?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          ai_generated: boolean | null
          created_at: string
          description: string | null
          energy_cost_generation: number | null
          id: string
          is_active: boolean | null
          landing_page_id: string | null
          name: string
          organization_id: string
          storefront_id: string | null
          trigger_conditions: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string
          description?: string | null
          energy_cost_generation?: number | null
          id?: string
          is_active?: boolean | null
          landing_page_id?: string | null
          name: string
          organization_id: string
          storefront_id?: string | null
          trigger_conditions?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string
          description?: string | null
          energy_cost_generation?: number | null
          id?: string
          is_active?: boolean | null
          landing_page_id?: string | null
          name?: string
          organization_id?: string
          storefront_id?: string | null
          trigger_conditions?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequences_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          created_at: string
          daily_limit: number | null
          footer_html: string | null
          from_email: string | null
          from_name: string | null
          id: string
          is_enabled: boolean | null
          organization_id: string
          reply_to: string | null
          unsubscribe_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_limit?: number | null
          footer_html?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id: string
          reply_to?: string | null
          unsubscribe_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_limit?: number | null
          footer_html?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_enabled?: boolean | null
          organization_id?: string
          reply_to?: string | null
          unsubscribe_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          category: string | null
          created_at: string
          html_content: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          subject: string
          text_content: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          html_content: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          subject: string
          text_content?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          category?: string | null
          created_at?: string
          html_content?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          subject?: string
          text_content?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      factories: {
        Row: {
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          pix_key: string | null
          updated_at: string
          virtual_account_id: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          virtual_account_id?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          virtual_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "factories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factories_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_approval_rules: {
        Row: {
          approver_user_ids: string[] | null
          created_at: string
          id: string
          is_active: boolean | null
          max_amount_cents: number | null
          min_amount_cents: number
          name: string
          organization_id: string
          position: number | null
          require_all_approvers: boolean | null
          updated_at: string
        }
        Insert: {
          approver_user_ids?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_amount_cents?: number | null
          min_amount_cents: number
          name: string
          organization_id: string
          position?: number | null
          require_all_approvers?: boolean | null
          updated_at?: string
        }
        Update: {
          approver_user_ids?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_amount_cents?: number | null
          min_amount_cents?: number
          name?: string
          organization_id?: string
          position?: number | null
          require_all_approvers?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_approval_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          created_at: string
          dre_group: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          organization_id: string
          parent_id: string | null
          position: number | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dre_group?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dre_group?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_auto_send_config: {
        Row: {
          created_at: string
          email_body_template: string | null
          email_enabled: boolean
          email_from_address: string | null
          email_from_name: string | null
          email_send_danfe: boolean
          email_send_xml: boolean
          email_subject_template: string | null
          id: string
          organization_id: string
          resend_api_key_encrypted: string | null
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_instance_id: string | null
          whatsapp_message_template: string | null
          whatsapp_send_danfe: boolean
          whatsapp_send_xml: boolean
        }
        Insert: {
          created_at?: string
          email_body_template?: string | null
          email_enabled?: boolean
          email_from_address?: string | null
          email_from_name?: string | null
          email_send_danfe?: boolean
          email_send_xml?: boolean
          email_subject_template?: string | null
          id?: string
          organization_id: string
          resend_api_key_encrypted?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_instance_id?: string | null
          whatsapp_message_template?: string | null
          whatsapp_send_danfe?: boolean
          whatsapp_send_xml?: boolean
        }
        Update: {
          created_at?: string
          email_body_template?: string | null
          email_enabled?: boolean
          email_from_address?: string | null
          email_from_name?: string | null
          email_send_danfe?: boolean
          email_send_xml?: boolean
          email_subject_template?: string | null
          id?: string
          organization_id?: string
          resend_api_key_encrypted?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_instance_id?: string | null
          whatsapp_message_template?: string | null
          whatsapp_send_danfe?: boolean
          whatsapp_send_xml?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_auto_send_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_auto_send_config_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_auto_send_config_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_companies: {
        Row: {
          accountant_cpf_cnpj: string | null
          address_city: string | null
          address_city_code: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          certificate_file_path: string | null
          certificate_password_encrypted: string | null
          cnpj: string
          company_name: string
          created_at: string
          default_cfop_internal: string | null
          default_cfop_interstate: string | null
          default_cst: string | null
          default_nature_operation: string | null
          email: string | null
          focus_nfe_company_id: string | null
          focus_nfe_token_homologacao: string | null
          focus_nfe_token_producao: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          municipal_registration: string | null
          nfe_environment: string | null
          nfe_last_number: number | null
          nfe_serie: number | null
          nfse_environment: string | null
          nfse_last_number: number | null
          nfse_municipal_code: string | null
          nfse_serie: number | null
          organization_id: string
          phone: string | null
          presence_indicator: string | null
          responsible_cpf: string | null
          responsible_name: string | null
          state_registration: string | null
          tax_regime: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          accountant_cpf_cnpj?: string | null
          address_city?: string | null
          address_city_code?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          certificate_file_path?: string | null
          certificate_password_encrypted?: string | null
          cnpj: string
          company_name: string
          created_at?: string
          default_cfop_internal?: string | null
          default_cfop_interstate?: string | null
          default_cst?: string | null
          default_nature_operation?: string | null
          email?: string | null
          focus_nfe_company_id?: string | null
          focus_nfe_token_homologacao?: string | null
          focus_nfe_token_producao?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          municipal_registration?: string | null
          nfe_environment?: string | null
          nfe_last_number?: number | null
          nfe_serie?: number | null
          nfse_environment?: string | null
          nfse_last_number?: number | null
          nfse_municipal_code?: string | null
          nfse_serie?: number | null
          organization_id: string
          phone?: string | null
          presence_indicator?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          state_registration?: string | null
          tax_regime?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          accountant_cpf_cnpj?: string | null
          address_city?: string | null
          address_city_code?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          certificate_file_path?: string | null
          certificate_password_encrypted?: string | null
          cnpj?: string
          company_name?: string
          created_at?: string
          default_cfop_internal?: string | null
          default_cfop_interstate?: string | null
          default_cst?: string | null
          default_nature_operation?: string | null
          email?: string | null
          focus_nfe_company_id?: string | null
          focus_nfe_token_homologacao?: string | null
          focus_nfe_token_producao?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          municipal_registration?: string | null
          nfe_environment?: string | null
          nfe_last_number?: number | null
          nfe_serie?: number | null
          nfse_environment?: string | null
          nfse_last_number?: number | null
          nfse_municipal_code?: string | null
          nfse_serie?: number | null
          organization_id?: string
          phone?: string | null
          presence_indicator?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          state_registration?: string | null
          tax_regime?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoice_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          fiscal_invoice_id: string
          id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          fiscal_invoice_id: string
          id?: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          fiscal_invoice_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoice_events_fiscal_invoice_id_fkey"
            columns: ["fiscal_invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoices: {
        Row: {
          access_key: string | null
          additional_info: string | null
          authorized_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          carrier_address: string | null
          carrier_city: string | null
          carrier_cpf_cnpj: string | null
          carrier_ie: string | null
          carrier_name: string | null
          carrier_state: string | null
          created_at: string
          customer_data: Json | null
          discount_cents: number | null
          emission_date: string | null
          emission_time: string | null
          emission_type: string | null
          error_message: string | null
          exit_date: string | null
          exit_time: string | null
          fiscal_company_id: string
          fisco_info: string | null
          focus_nfe_id: string | null
          focus_nfe_ref: string
          focus_nfe_response: Json | null
          freight_responsibility: string | null
          freight_value_cents: number | null
          id: string
          insurance_value_cents: number | null
          invoice_number: string | null
          invoice_series: string | null
          invoice_type: string
          is_draft: boolean | null
          items: Json | null
          nature_operation: string | null
          organization_id: string
          other_expenses_cents: number | null
          pdf_url: string | null
          presence_indicator: string | null
          products_total_cents: number | null
          protocol_number: string | null
          purpose: string | null
          recipient_cep: string | null
          recipient_city: string | null
          recipient_city_code: string | null
          recipient_complement: string | null
          recipient_cpf_cnpj: string | null
          recipient_email: string | null
          recipient_ie: string | null
          recipient_inscricao_estadual: string | null
          recipient_inscricao_estadual_isento: boolean
          recipient_inscricao_municipal: string | null
          recipient_inscricao_municipal_isento: boolean
          recipient_is_final_consumer: boolean | null
          recipient_name: string | null
          recipient_neighborhood: string | null
          recipient_number: string | null
          recipient_phone: string | null
          recipient_state: string | null
          recipient_street: string | null
          recipient_type: string | null
          sale_id: string | null
          seller_user_id: string | null
          status: string
          tax_regime: string | null
          total_cents: number
          transport_type: string | null
          vehicle_plate: string | null
          vehicle_rntc: string | null
          vehicle_state: string | null
          verification_code: string | null
          volume_brand: string | null
          volume_gross_weight: number | null
          volume_net_weight: number | null
          volume_numbering: string | null
          volume_quantity: number | null
          volume_species: string | null
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          additional_info?: string | null
          authorized_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carrier_address?: string | null
          carrier_city?: string | null
          carrier_cpf_cnpj?: string | null
          carrier_ie?: string | null
          carrier_name?: string | null
          carrier_state?: string | null
          created_at?: string
          customer_data?: Json | null
          discount_cents?: number | null
          emission_date?: string | null
          emission_time?: string | null
          emission_type?: string | null
          error_message?: string | null
          exit_date?: string | null
          exit_time?: string | null
          fiscal_company_id: string
          fisco_info?: string | null
          focus_nfe_id?: string | null
          focus_nfe_ref: string
          focus_nfe_response?: Json | null
          freight_responsibility?: string | null
          freight_value_cents?: number | null
          id?: string
          insurance_value_cents?: number | null
          invoice_number?: string | null
          invoice_series?: string | null
          invoice_type: string
          is_draft?: boolean | null
          items?: Json | null
          nature_operation?: string | null
          organization_id: string
          other_expenses_cents?: number | null
          pdf_url?: string | null
          presence_indicator?: string | null
          products_total_cents?: number | null
          protocol_number?: string | null
          purpose?: string | null
          recipient_cep?: string | null
          recipient_city?: string | null
          recipient_city_code?: string | null
          recipient_complement?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_email?: string | null
          recipient_ie?: string | null
          recipient_inscricao_estadual?: string | null
          recipient_inscricao_estadual_isento?: boolean
          recipient_inscricao_municipal?: string | null
          recipient_inscricao_municipal_isento?: boolean
          recipient_is_final_consumer?: boolean | null
          recipient_name?: string | null
          recipient_neighborhood?: string | null
          recipient_number?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_street?: string | null
          recipient_type?: string | null
          sale_id?: string | null
          seller_user_id?: string | null
          status?: string
          tax_regime?: string | null
          total_cents: number
          transport_type?: string | null
          vehicle_plate?: string | null
          vehicle_rntc?: string | null
          vehicle_state?: string | null
          verification_code?: string | null
          volume_brand?: string | null
          volume_gross_weight?: number | null
          volume_net_weight?: number | null
          volume_numbering?: string | null
          volume_quantity?: number | null
          volume_species?: string | null
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          additional_info?: string | null
          authorized_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          carrier_address?: string | null
          carrier_city?: string | null
          carrier_cpf_cnpj?: string | null
          carrier_ie?: string | null
          carrier_name?: string | null
          carrier_state?: string | null
          created_at?: string
          customer_data?: Json | null
          discount_cents?: number | null
          emission_date?: string | null
          emission_time?: string | null
          emission_type?: string | null
          error_message?: string | null
          exit_date?: string | null
          exit_time?: string | null
          fiscal_company_id?: string
          fisco_info?: string | null
          focus_nfe_id?: string | null
          focus_nfe_ref?: string
          focus_nfe_response?: Json | null
          freight_responsibility?: string | null
          freight_value_cents?: number | null
          id?: string
          insurance_value_cents?: number | null
          invoice_number?: string | null
          invoice_series?: string | null
          invoice_type?: string
          is_draft?: boolean | null
          items?: Json | null
          nature_operation?: string | null
          organization_id?: string
          other_expenses_cents?: number | null
          pdf_url?: string | null
          presence_indicator?: string | null
          products_total_cents?: number | null
          protocol_number?: string | null
          purpose?: string | null
          recipient_cep?: string | null
          recipient_city?: string | null
          recipient_city_code?: string | null
          recipient_complement?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_email?: string | null
          recipient_ie?: string | null
          recipient_inscricao_estadual?: string | null
          recipient_inscricao_estadual_isento?: boolean
          recipient_inscricao_municipal?: string | null
          recipient_inscricao_municipal_isento?: boolean
          recipient_is_final_consumer?: boolean | null
          recipient_name?: string | null
          recipient_neighborhood?: string | null
          recipient_number?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_street?: string | null
          recipient_type?: string | null
          sale_id?: string | null
          seller_user_id?: string | null
          status?: string
          tax_regime?: string | null
          total_cents?: number
          transport_type?: string | null
          vehicle_plate?: string | null
          vehicle_rntc?: string | null
          vehicle_state?: string | null
          verification_code?: string | null
          volume_brand?: string | null
          volume_gross_weight?: number | null
          volume_net_weight?: number | null
          volume_numbering?: string | null
          volume_quantity?: number | null
          volume_species?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoices_fiscal_company_id_fkey"
            columns: ["fiscal_company_id"]
            isOneToOne: false
            referencedRelation: "fiscal_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_seller_user_id_fkey"
            columns: ["seller_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gateway_fallback_config: {
        Row: {
          created_at: string | null
          fallback_enabled: boolean | null
          fallback_gateways: string[] | null
          fallback_on_error_codes: string[] | null
          id: string
          max_fallback_attempts: number | null
          no_fallback_error_codes: string[] | null
          payment_method: string
          primary_gateway: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fallback_enabled?: boolean | null
          fallback_gateways?: string[] | null
          fallback_on_error_codes?: string[] | null
          id?: string
          max_fallback_attempts?: number | null
          no_fallback_error_codes?: string[] | null
          payment_method: string
          primary_gateway: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fallback_enabled?: boolean | null
          fallback_gateways?: string[] | null
          fallback_on_error_codes?: string[] | null
          id?: string
          max_fallback_attempts?: number | null
          no_fallback_error_codes?: string[] | null
          payment_method?: string
          primary_gateway?: string
          updated_at?: string | null
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
      helper_conversations: {
        Row: {
          created_at: string
          human_notified_at: string | null
          human_requested_at: string | null
          id: string
          organization_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          human_notified_at?: string | null
          human_requested_at?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          human_notified_at?: string | null
          human_requested_at?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "helper_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      helper_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "helper_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "helper_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helper_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      helper_tips: {
        Row: {
          category: string | null
          content: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          module: string
          position: number
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          module: string
          position?: number
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          module?: string
          position?: number
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      implementer_checkout_links: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          implementation_fee_cents: number | null
          implementer_id: string
          is_active: boolean | null
          plan_id: string
          slug: string
          uses_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          implementation_fee_cents?: number | null
          implementer_id: string
          is_active?: boolean | null
          plan_id: string
          slug: string
          uses_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          implementation_fee_cents?: number | null
          implementer_id?: string
          is_active?: boolean | null
          plan_id?: string
          slug?: string
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "implementer_checkout_links_implementer_id_fkey"
            columns: ["implementer_id"]
            isOneToOne: false
            referencedRelation: "implementers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_checkout_links_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_checkout_links_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans_public"
            referencedColumns: ["id"]
          },
        ]
      }
      implementer_commissions: {
        Row: {
          commission_type: string
          created_at: string | null
          gross_amount_cents: number
          id: string
          implementer_id: string
          implementer_sale_id: string
          net_amount_cents: number
          paid_at: string | null
          period_month: number | null
          platform_fee_cents: number
          status: string | null
        }
        Insert: {
          commission_type: string
          created_at?: string | null
          gross_amount_cents: number
          id?: string
          implementer_id: string
          implementer_sale_id: string
          net_amount_cents: number
          paid_at?: string | null
          period_month?: number | null
          platform_fee_cents: number
          status?: string | null
        }
        Update: {
          commission_type?: string
          created_at?: string | null
          gross_amount_cents?: number
          id?: string
          implementer_id?: string
          implementer_sale_id?: string
          net_amount_cents?: number
          paid_at?: string | null
          period_month?: number | null
          platform_fee_cents?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "implementer_commissions_implementer_id_fkey"
            columns: ["implementer_id"]
            isOneToOne: false
            referencedRelation: "implementers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_commissions_implementer_sale_id_fkey"
            columns: ["implementer_sale_id"]
            isOneToOne: false
            referencedRelation: "implementer_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      implementer_pending_checkouts: {
        Row: {
          checkout_link_id: string
          created_at: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp: string | null
          expires_at: string | null
          id: string
          paid_at: string | null
          payment_method: string
          status: string
          total_amount_cents: number
        }
        Insert: {
          checkout_link_id: string
          created_at?: string
          customer_document: string
          customer_email: string
          customer_name: string
          customer_whatsapp?: string | null
          expires_at?: string | null
          id: string
          paid_at?: string | null
          payment_method: string
          status?: string
          total_amount_cents: number
        }
        Update: {
          checkout_link_id?: string
          created_at?: string
          customer_document?: string
          customer_email?: string
          customer_name?: string
          customer_whatsapp?: string | null
          expires_at?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string
          status?: string
          total_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "implementer_pending_checkouts_checkout_link_id_fkey"
            columns: ["checkout_link_id"]
            isOneToOne: false
            referencedRelation: "implementer_checkout_links"
            referencedColumns: ["id"]
          },
        ]
      }
      implementer_sales: {
        Row: {
          cancelled_at: string | null
          client_organization_id: string
          client_subscription_id: string | null
          created_at: string | null
          first_payment_cents: number
          id: string
          implementation_fee_cents: number | null
          implementer_id: string
          plan_id: string
          status: string | null
          white_label_config_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          client_organization_id: string
          client_subscription_id?: string | null
          created_at?: string | null
          first_payment_cents: number
          id?: string
          implementation_fee_cents?: number | null
          implementer_id: string
          plan_id: string
          status?: string | null
          white_label_config_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          client_organization_id?: string
          client_subscription_id?: string | null
          created_at?: string | null
          first_payment_cents?: number
          id?: string
          implementation_fee_cents?: number | null
          implementer_id?: string
          plan_id?: string
          status?: string | null
          white_label_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "implementer_sales_client_organization_id_fkey"
            columns: ["client_organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_sales_client_subscription_id_fkey"
            columns: ["client_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_sales_implementer_id_fkey"
            columns: ["implementer_id"]
            isOneToOne: false
            referencedRelation: "implementers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_sales_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_sales_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementer_sales_white_label_config_id_fkey"
            columns: ["white_label_config_id"]
            isOneToOne: false
            referencedRelation: "white_label_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      implementers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_white_label: boolean | null
          organization_id: string
          referral_code: string
          total_clients: number | null
          total_earnings_cents: number | null
          updated_at: string | null
          user_id: string
          white_label_config_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_white_label?: boolean | null
          organization_id: string
          referral_code: string
          total_clients?: number | null
          total_earnings_cents?: number | null
          updated_at?: string | null
          user_id: string
          white_label_config_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_white_label?: boolean | null
          organization_id?: string
          referral_code?: string
          total_clients?: number | null
          total_earnings_cents?: number | null
          updated_at?: string | null
          user_id?: string
          white_label_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "implementers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementers_white_label_config_id_fkey"
            columns: ["white_label_config_id"]
            isOneToOne: false
            referencedRelation: "white_label_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          end_to_end_id: string | null
          id: string
          matched_at: string | null
          matched_by: string | null
          matched_sale_id: string | null
          organization_id: string
          payer_bank: string | null
          payer_document: string | null
          payer_name: string | null
          raw_payload: Json | null
          source: string
          source_transaction_id: string | null
          status: string
          transaction_date: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          end_to_end_id?: string | null
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_sale_id?: string | null
          organization_id: string
          payer_bank?: string | null
          payer_document?: string | null
          payer_name?: string | null
          raw_payload?: Json | null
          source: string
          source_transaction_id?: string | null
          status?: string
          transaction_date?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          end_to_end_id?: string | null
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          matched_sale_id?: string | null
          organization_id?: string
          payer_bank?: string | null
          payer_document?: string | null
          payer_name?: string | null
          raw_payload?: Json | null
          source?: string
          source_transaction_id?: string | null
          status?: string
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incoming_transactions_matched_sale_id_fkey"
            columns: ["matched_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      industries: {
        Row: {
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          created_at: string | null
          document: string | null
          email: string | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          pix_key: string | null
          updated_at: string | null
          virtual_account_id: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          pix_key?: string | null
          updated_at?: string | null
          virtual_account_id?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          pix_key?: string | null
          updated_at?: string | null
          virtual_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "industries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "industries_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          bot_id: string | null
          created_at: string
          days_of_week: number[]
          end_time: string
          id: string
          instance_id: string
          is_active: boolean
          keyword_router_id: string | null
          organization_id: string
          priority: number
          start_time: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          id?: string
          instance_id: string
          is_active?: boolean
          keyword_router_id?: string | null
          organization_id: string
          priority?: number
          start_time?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          id?: string
          instance_id?: string
          is_active?: boolean
          keyword_router_id?: string | null
          organization_id?: string
          priority?: number
          start_time?: string
          team_id?: string | null
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
            foreignKeyName: "instance_bot_schedules_keyword_router_id_fkey"
            columns: ["keyword_router_id"]
            isOneToOne: false
            referencedRelation: "keyword_bot_routers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_bot_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_bot_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "bot_teams"
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
          default_seller_id: string | null
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
          trigger_rules: Json | null
          trigger_rules_logic: string | null
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
          default_seller_id?: string | null
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
          trigger_rules?: Json | null
          trigger_rules_logic?: string | null
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
          default_seller_id?: string | null
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
          trigger_rules?: Json | null
          trigger_rules_logic?: string | null
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
            foreignKeyName: "integrations_default_seller_id_fkey"
            columns: ["default_seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
      keyword_bot_routers: {
        Row: {
          created_at: string
          description: string | null
          fallback_bot_id: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fallback_bot_id: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fallback_bot_id?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_bot_routers_fallback_bot_id_fkey"
            columns: ["fallback_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_bot_routers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_bot_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          organization_id: string
          priority: number
          router_id: string
          target_bot_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords: string[]
          organization_id: string
          priority?: number
          router_id: string
          target_bot_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          organization_id?: string
          priority?: number
          router_id?: string
          target_bot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_bot_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_bot_rules_router_id_fkey"
            columns: ["router_id"]
            isOneToOne: false
            referencedRelation: "keyword_bot_routers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_bot_rules_target_bot_id_fkey"
            columns: ["target_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_offers: {
        Row: {
          badge_text: string | null
          created_at: string
          discount_percentage: number | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_highlighted: boolean | null
          label: string
          landing_page_id: string
          original_price_cents: number | null
          price_cents: number
          quantity: number
        }
        Insert: {
          badge_text?: string | null
          created_at?: string
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          label: string
          landing_page_id: string
          original_price_cents?: number | null
          price_cents: number
          quantity?: number
        }
        Update: {
          badge_text?: string | null
          created_at?: string
          discount_percentage?: number | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_highlighted?: boolean | null
          label?: string
          landing_page_id?: string
          original_price_cents?: number | null
          price_cents?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "landing_offers_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_templates: {
        Row: {
          benefits: Json | null
          branding: Json | null
          category: string | null
          clone_count: number | null
          created_at: string | null
          created_by: string | null
          custom_css: string | null
          description: string | null
          faq: Json | null
          full_html: string | null
          guarantee_text: string | null
          headline: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          settings: Json | null
          source_type: string | null
          source_url: string | null
          subheadline: string | null
          testimonials: Json | null
          thumbnail_url: string | null
          updated_at: string | null
          urgency_text: string | null
          video_url: string | null
        }
        Insert: {
          benefits?: Json | null
          branding?: Json | null
          category?: string | null
          clone_count?: number | null
          created_at?: string | null
          created_by?: string | null
          custom_css?: string | null
          description?: string | null
          faq?: Json | null
          full_html?: string | null
          guarantee_text?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          source_type?: string | null
          source_url?: string | null
          subheadline?: string | null
          testimonials?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          urgency_text?: string | null
          video_url?: string | null
        }
        Update: {
          benefits?: Json | null
          branding?: Json | null
          category?: string | null
          clone_count?: number | null
          created_at?: string | null
          created_by?: string | null
          custom_css?: string | null
          description?: string | null
          faq?: Json | null
          full_html?: string | null
          guarantee_text?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          source_type?: string | null
          source_url?: string | null
          subheadline?: string | null
          testimonials?: Json | null
          thumbnail_url?: string | null
          updated_at?: string | null
          urgency_text?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          attribution_model: string | null
          benefits: Json | null
          branding: Json | null
          checkout_config: Json | null
          checkout_selectors: string[] | null
          created_at: string
          custom_css: string | null
          facebook_pixel_id: string | null
          faq: Json | null
          full_html: string | null
          google_analytics_id: string | null
          guarantee_text: string | null
          headline: string | null
          id: string
          import_mode: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          order_bump_product_id: string | null
          organization_id: string
          primary_color: string | null
          product_id: string | null
          settings: Json | null
          slug: string
          source_url: string | null
          subheadline: string | null
          template_id: string | null
          testimonials: Json | null
          updated_at: string
          urgency_text: string | null
          video_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          attribution_model?: string | null
          benefits?: Json | null
          branding?: Json | null
          checkout_config?: Json | null
          checkout_selectors?: string[] | null
          created_at?: string
          custom_css?: string | null
          facebook_pixel_id?: string | null
          faq?: Json | null
          full_html?: string | null
          google_analytics_id?: string | null
          guarantee_text?: string | null
          headline?: string | null
          id?: string
          import_mode?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          order_bump_product_id?: string | null
          organization_id: string
          primary_color?: string | null
          product_id?: string | null
          settings?: Json | null
          slug: string
          source_url?: string | null
          subheadline?: string | null
          template_id?: string | null
          testimonials?: Json | null
          updated_at?: string
          urgency_text?: string | null
          video_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          attribution_model?: string | null
          benefits?: Json | null
          branding?: Json | null
          checkout_config?: Json | null
          checkout_selectors?: string[] | null
          created_at?: string
          custom_css?: string | null
          facebook_pixel_id?: string | null
          faq?: Json | null
          full_html?: string | null
          google_analytics_id?: string | null
          guarantee_text?: string | null
          headline?: string | null
          id?: string
          import_mode?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          order_bump_product_id?: string | null
          organization_id?: string
          primary_color?: string | null
          product_id?: string | null
          settings?: Json | null
          slug?: string
          source_url?: string | null
          subheadline?: string | null
          template_id?: string | null
          testimonials?: Json | null
          updated_at?: string
          urgency_text?: string | null
          video_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_order_bump_product_id_fkey"
            columns: ["order_bump_product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "storefront_templates"
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
          average_cost_cents: number | null
          barcode_ean: string | null
          base_commission_percentage: number | null
          base_points: number | null
          base_price_cents: number | null
          base_sales_hack: string | null
          base_usage_period_days: number | null
          base_use_default_commission: boolean | null
          bot_can_send_image: boolean | null
          bot_can_send_site_link: boolean | null
          bot_can_send_video: boolean | null
          brand_id: string | null
          category: string
          cost_cents: number | null
          created_at: string
          crosssell_product_1_id: string | null
          crosssell_product_2_id: string | null
          depth_cm: number | null
          description: string | null
          ecommerce_benefits: Json | null
          ecommerce_description: string | null
          ecommerce_enabled: boolean | null
          ecommerce_images: Json | null
          ecommerce_short_description: string | null
          ecommerce_specifications: Json | null
          ecommerce_title: string | null
          ecommerce_video_url: string | null
          fiscal_additional_info: string | null
          fiscal_benefit_code: string | null
          fiscal_cest: string | null
          fiscal_cfop: string | null
          fiscal_cofins_fixed: number | null
          fiscal_company_id: string | null
          fiscal_cst: string | null
          fiscal_icms_base: number | null
          fiscal_icms_fisco_info: string | null
          fiscal_icms_info: string | null
          fiscal_icms_own_value: number | null
          fiscal_icms_st_base: number | null
          fiscal_icms_st_value: number | null
          fiscal_ipi_exception_code: string | null
          fiscal_iss_aliquota: number | null
          fiscal_item_type: string | null
          fiscal_lc116_code: string | null
          fiscal_ncm: string | null
          fiscal_origin: number | null
          fiscal_pis_fixed: number | null
          fiscal_product_type: string | null
          fiscal_tax_percentage: number | null
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
          last_purchase_cost_cents: number | null
          last_purchase_date: string | null
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
          review_count: number | null
          sales_script: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
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
          average_cost_cents?: number | null
          barcode_ean?: string | null
          base_commission_percentage?: number | null
          base_points?: number | null
          base_price_cents?: number | null
          base_sales_hack?: string | null
          base_usage_period_days?: number | null
          base_use_default_commission?: boolean | null
          bot_can_send_image?: boolean | null
          bot_can_send_site_link?: boolean | null
          bot_can_send_video?: boolean | null
          brand_id?: string | null
          category?: string
          cost_cents?: number | null
          created_at?: string
          crosssell_product_1_id?: string | null
          crosssell_product_2_id?: string | null
          depth_cm?: number | null
          description?: string | null
          ecommerce_benefits?: Json | null
          ecommerce_description?: string | null
          ecommerce_enabled?: boolean | null
          ecommerce_images?: Json | null
          ecommerce_short_description?: string | null
          ecommerce_specifications?: Json | null
          ecommerce_title?: string | null
          ecommerce_video_url?: string | null
          fiscal_additional_info?: string | null
          fiscal_benefit_code?: string | null
          fiscal_cest?: string | null
          fiscal_cfop?: string | null
          fiscal_cofins_fixed?: number | null
          fiscal_company_id?: string | null
          fiscal_cst?: string | null
          fiscal_icms_base?: number | null
          fiscal_icms_fisco_info?: string | null
          fiscal_icms_info?: string | null
          fiscal_icms_own_value?: number | null
          fiscal_icms_st_base?: number | null
          fiscal_icms_st_value?: number | null
          fiscal_ipi_exception_code?: string | null
          fiscal_iss_aliquota?: number | null
          fiscal_item_type?: string | null
          fiscal_lc116_code?: string | null
          fiscal_ncm?: string | null
          fiscal_origin?: number | null
          fiscal_pis_fixed?: number | null
          fiscal_product_type?: string | null
          fiscal_tax_percentage?: number | null
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
          last_purchase_cost_cents?: number | null
          last_purchase_date?: string | null
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
          review_count?: number | null
          sales_script?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
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
          average_cost_cents?: number | null
          barcode_ean?: string | null
          base_commission_percentage?: number | null
          base_points?: number | null
          base_price_cents?: number | null
          base_sales_hack?: string | null
          base_usage_period_days?: number | null
          base_use_default_commission?: boolean | null
          bot_can_send_image?: boolean | null
          bot_can_send_site_link?: boolean | null
          bot_can_send_video?: boolean | null
          brand_id?: string | null
          category?: string
          cost_cents?: number | null
          created_at?: string
          crosssell_product_1_id?: string | null
          crosssell_product_2_id?: string | null
          depth_cm?: number | null
          description?: string | null
          ecommerce_benefits?: Json | null
          ecommerce_description?: string | null
          ecommerce_enabled?: boolean | null
          ecommerce_images?: Json | null
          ecommerce_short_description?: string | null
          ecommerce_specifications?: Json | null
          ecommerce_title?: string | null
          ecommerce_video_url?: string | null
          fiscal_additional_info?: string | null
          fiscal_benefit_code?: string | null
          fiscal_cest?: string | null
          fiscal_cfop?: string | null
          fiscal_cofins_fixed?: number | null
          fiscal_company_id?: string | null
          fiscal_cst?: string | null
          fiscal_icms_base?: number | null
          fiscal_icms_fisco_info?: string | null
          fiscal_icms_info?: string | null
          fiscal_icms_own_value?: number | null
          fiscal_icms_st_base?: number | null
          fiscal_icms_st_value?: number | null
          fiscal_ipi_exception_code?: string | null
          fiscal_iss_aliquota?: number | null
          fiscal_item_type?: string | null
          fiscal_lc116_code?: string | null
          fiscal_ncm?: string | null
          fiscal_origin?: number | null
          fiscal_pis_fixed?: number | null
          fiscal_product_type?: string | null
          fiscal_tax_percentage?: number | null
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
          last_purchase_cost_cents?: number | null
          last_purchase_date?: string | null
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
          review_count?: number | null
          sales_script?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
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
            foreignKeyName: "lead_products_fiscal_company_id_fkey"
            columns: ["fiscal_company_id"]
            isOneToOne: false
            referencedRelation: "fiscal_companies"
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
          capi_event_id: string | null
          capi_event_name: string | null
          capi_event_sent: boolean | null
          changed_by: string | null
          created_at: string
          funnel_stage_id: string | null
          id: string
          lead_id: string
          organization_id: string
          previous_stage: Database["public"]["Enums"]["funnel_stage"] | null
          reason: string | null
          source: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
        }
        Insert: {
          capi_event_id?: string | null
          capi_event_name?: string | null
          capi_event_sent?: boolean | null
          changed_by?: string | null
          created_at?: string
          funnel_stage_id?: string | null
          id?: string
          lead_id: string
          organization_id: string
          previous_stage?: Database["public"]["Enums"]["funnel_stage"] | null
          reason?: string | null
          source?: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
        }
        Update: {
          capi_event_id?: string | null
          capi_event_name?: string | null
          capi_event_sent?: boolean | null
          changed_by?: string | null
          created_at?: string
          funnel_stage_id?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          previous_stage?: Database["public"]["Enums"]["funnel_stage"] | null
          reason?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_funnel_stage_id_fkey"
            columns: ["funnel_stage_id"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
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
          fbclid: string | null
          first_touch_at: string | null
          first_touch_referrer: string | null
          first_touch_url: string | null
          followers: number | null
          funnel_stage_id: string | null
          gclid: string | null
          gender: string | null
          google_maps_link: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_estadual_isento: boolean | null
          inscricao_municipal: string | null
          inscricao_municipal_isento: boolean | null
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
          src: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
          stars: number
          state: string | null
          street: string | null
          street_number: string | null
          tiktok: string | null
          ttclid: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
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
          fbclid?: string | null
          first_touch_at?: string | null
          first_touch_referrer?: string | null
          first_touch_url?: string | null
          followers?: number | null
          funnel_stage_id?: string | null
          gclid?: string | null
          gender?: string | null
          google_maps_link?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_isento?: boolean | null
          inscricao_municipal?: string | null
          inscricao_municipal_isento?: boolean | null
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
          src?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          stars?: number
          state?: string | null
          street?: string | null
          street_number?: string | null
          tiktok?: string | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
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
          fbclid?: string | null
          first_touch_at?: string | null
          first_touch_referrer?: string | null
          first_touch_url?: string | null
          followers?: number | null
          funnel_stage_id?: string | null
          gclid?: string | null
          gender?: string | null
          google_maps_link?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_estadual_isento?: boolean | null
          inscricao_municipal?: string | null
          inscricao_municipal_isento?: boolean | null
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
          src?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          stars?: number
          state?: string | null
          street?: string | null
          street_number?: string | null
          tiktok?: string | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
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
            foreignKeyName: "leads_funnel_stage_id_fkey"
            columns: ["funnel_stage_id"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
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
      melhor_envio_config: {
        Row: {
          ambiente: string
          created_at: string
          default_agency_id: number | null
          default_height_cm: number | null
          default_length_cm: number | null
          default_weight_grams: number | null
          default_width_cm: number | null
          id: string
          is_active: boolean
          organization_id: string
          sender_cep: string | null
          sender_city: string | null
          sender_cnpj: string | null
          sender_complement: string | null
          sender_cpf_cnpj: string | null
          sender_email: string | null
          sender_ie: string | null
          sender_name: string | null
          sender_neighborhood: string | null
          sender_number: string | null
          sender_phone: string | null
          sender_state: string | null
          sender_street: string | null
          token_encrypted: string | null
          updated_at: string
        }
        Insert: {
          ambiente?: string
          created_at?: string
          default_agency_id?: number | null
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_weight_grams?: number | null
          default_width_cm?: number | null
          id?: string
          is_active?: boolean
          organization_id: string
          sender_cep?: string | null
          sender_city?: string | null
          sender_cnpj?: string | null
          sender_complement?: string | null
          sender_cpf_cnpj?: string | null
          sender_email?: string | null
          sender_ie?: string | null
          sender_name?: string | null
          sender_neighborhood?: string | null
          sender_number?: string | null
          sender_phone?: string | null
          sender_state?: string | null
          sender_street?: string | null
          token_encrypted?: string | null
          updated_at?: string
        }
        Update: {
          ambiente?: string
          created_at?: string
          default_agency_id?: number | null
          default_height_cm?: number | null
          default_length_cm?: number | null
          default_weight_grams?: number | null
          default_width_cm?: number | null
          id?: string
          is_active?: boolean
          organization_id?: string
          sender_cep?: string | null
          sender_city?: string | null
          sender_cnpj?: string | null
          sender_complement?: string | null
          sender_cpf_cnpj?: string | null
          sender_email?: string | null
          sender_ie?: string | null
          sender_name?: string | null
          sender_neighborhood?: string | null
          sender_number?: string | null
          sender_phone?: string | null
          sender_state?: string | null
          sender_street?: string | null
          token_encrypted?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "melhor_envio_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      melhor_envio_enabled_services: {
        Row: {
          company_name: string | null
          created_at: string
          extra_handling_days: number
          id: string
          is_enabled: boolean
          organization_id: string
          picking_cost_cents: number
          position: number
          service_id: number
          service_name: string
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          extra_handling_days?: number
          id?: string
          is_enabled?: boolean
          organization_id: string
          picking_cost_cents?: number
          position?: number
          service_id: number
          service_name: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          extra_handling_days?: number
          id?: string
          is_enabled?: boolean
          organization_id?: string
          picking_cost_cents?: number
          position?: number
          service_id?: number
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "melhor_envio_enabled_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      melhor_envio_labels: {
        Row: {
          api_response: Json | null
          company_name: string | null
          created_at: string
          created_by: string | null
          declared_value_cents: number | null
          error_message: string | null
          height_cm: number | null
          id: string
          label_pdf_url: string | null
          length_cm: number | null
          melhor_envio_order_id: string
          organization_id: string
          posted_at: string | null
          recipient_cep: string
          recipient_city: string | null
          recipient_complement: string | null
          recipient_cpf_cnpj: string | null
          recipient_name: string
          recipient_neighborhood: string | null
          recipient_number: string | null
          recipient_phone: string | null
          recipient_state: string | null
          recipient_street: string | null
          sale_id: string | null
          service_id: number
          service_name: string | null
          status: string
          tracking_code: string
          updated_at: string
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          api_response?: Json | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          declared_value_cents?: number | null
          error_message?: string | null
          height_cm?: number | null
          id?: string
          label_pdf_url?: string | null
          length_cm?: number | null
          melhor_envio_order_id: string
          organization_id: string
          posted_at?: string | null
          recipient_cep: string
          recipient_city?: string | null
          recipient_complement?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_name: string
          recipient_neighborhood?: string | null
          recipient_number?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_street?: string | null
          sale_id?: string | null
          service_id: number
          service_name?: string | null
          status?: string
          tracking_code: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          api_response?: Json | null
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          declared_value_cents?: number | null
          error_message?: string | null
          height_cm?: number | null
          id?: string
          label_pdf_url?: string | null
          length_cm?: number | null
          melhor_envio_order_id?: string
          organization_id?: string
          posted_at?: string | null
          recipient_cep?: string
          recipient_city?: string | null
          recipient_complement?: string | null
          recipient_cpf_cnpj?: string | null
          recipient_name?: string
          recipient_neighborhood?: string | null
          recipient_number?: string | null
          recipient_phone?: string | null
          recipient_state?: string | null
          recipient_street?: string | null
          sale_id?: string | null
          service_id?: number
          service_name?: string | null
          status?: string
          tracking_code?: string
          updated_at?: string
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "melhor_envio_labels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "melhor_envio_labels_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
      ofx_imports: {
        Row: {
          bank_account_id: string
          created_at: string
          duplicate_transactions: number | null
          end_date: string | null
          error_message: string | null
          file_name: string | null
          id: string
          import_date: string
          imported_by: string | null
          new_transactions: number | null
          organization_id: string
          start_date: string | null
          status: string | null
          total_transactions: number | null
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          duplicate_transactions?: number | null
          end_date?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_date?: string
          imported_by?: string | null
          new_transactions?: number | null
          organization_id: string
          start_date?: string | null
          status?: string | null
          total_transactions?: number | null
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          duplicate_transactions?: number | null
          end_date?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_date?: string
          imported_by?: string | null
          new_transactions?: number | null
          organization_id?: string
          start_date?: string | null
          status?: string | null
          total_transactions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ofx_imports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ofx_imports_organization_id_fkey"
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
      onboarding_email_queue: {
        Row: {
          created_at: string | null
          email: string
          error_message: string | null
          id: string
          name: string | null
          organization_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string | null
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          error_message?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          error_message?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_email_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_email_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string | null
          day_offset: number
          hours_offset: number
          id: string
          is_active: boolean | null
          position: number | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string | null
          day_offset?: number
          hours_offset?: number
          id?: string
          is_active?: boolean | null
          position?: number | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string | null
          day_offset?: number
          hours_offset?: number
          id?: string
          is_active?: boolean | null
          position?: number | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      organization_affiliates: {
        Row: {
          affiliate_code: string
          created_at: string
          default_commission_type: string
          default_commission_value: number
          email: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affiliate_code: string
          created_at?: string
          default_commission_type?: string
          default_commission_value?: number
          email: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affiliate_code?: string
          created_at?: string
          default_commission_type?: string
          default_commission_value?: number
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_affiliates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
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
          capi_custom_event: string | null
          capi_event_name: string | null
          color: string
          created_at: string
          default_followup_reason_id: string | null
          enum_value: Database["public"]["Enums"]["funnel_stage"] | null
          id: string
          is_default: boolean
          is_receptivo_destination: boolean | null
          name: string
          organization_id: string
          position: number
          requires_contact: boolean
          stage_type: string
          text_color: string
          updated_at: string
        }
        Insert: {
          capi_custom_event?: string | null
          capi_event_name?: string | null
          color?: string
          created_at?: string
          default_followup_reason_id?: string | null
          enum_value?: Database["public"]["Enums"]["funnel_stage"] | null
          id?: string
          is_default?: boolean
          is_receptivo_destination?: boolean | null
          name: string
          organization_id: string
          position: number
          requires_contact?: boolean
          stage_type?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          capi_custom_event?: string | null
          capi_event_name?: string | null
          color?: string
          created_at?: string
          default_followup_reason_id?: string | null
          enum_value?: Database["public"]["Enums"]["funnel_stage"] | null
          id?: string
          is_default?: boolean
          is_receptivo_destination?: boolean | null
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
            foreignKeyName: "organization_funnel_stages_default_followup_reason_id_fkey"
            columns: ["default_followup_reason_id"]
            isOneToOne: false
            referencedRelation: "non_purchase_reasons"
            referencedColumns: ["id"]
          },
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
          deactivated_at: string | null
          deactivated_by: string | null
          earns_team_commission: boolean
          extension: string | null
          id: string
          is_active: boolean
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
          deactivated_at?: string | null
          deactivated_by?: string | null
          earns_team_commission?: boolean
          extension?: string | null
          id?: string
          is_active?: boolean
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
          deactivated_at?: string | null
          deactivated_by?: string | null
          earns_team_commission?: boolean
          extension?: string | null
          id?: string
          is_active?: boolean
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
      organization_split_rules: {
        Row: {
          allow_negative_balance: boolean
          chargeback_debit_strategy: string
          created_at: string
          default_affiliate_percent: number
          hold_days_affiliate: number
          hold_days_factory: number
          hold_days_industry: number
          hold_days_platform: number
          hold_days_tenant: number
          organization_id: string
          platform_fee_fixed_cents: number
          platform_fee_percent: number
          updated_at: string
        }
        Insert: {
          allow_negative_balance?: boolean
          chargeback_debit_strategy?: string
          created_at?: string
          default_affiliate_percent?: number
          hold_days_affiliate?: number
          hold_days_factory?: number
          hold_days_industry?: number
          hold_days_platform?: number
          hold_days_tenant?: number
          organization_id: string
          platform_fee_fixed_cents?: number
          platform_fee_percent?: number
          updated_at?: string
        }
        Update: {
          allow_negative_balance?: boolean
          chargeback_debit_strategy?: string
          created_at?: string
          default_affiliate_percent?: number
          hold_days_affiliate?: number
          hold_days_factory?: number
          hold_days_industry?: number
          hold_days_platform?: number
          hold_days_tenant?: number
          organization_id?: string
          platform_fee_fixed_cents?: number
          platform_fee_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_split_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
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
          ai_energy_balance: number | null
          ai_model_document: string | null
          ai_model_image: string | null
          auto_close_assigned_minutes: number | null
          auto_close_bot_minutes: number | null
          auto_close_business_end: string | null
          auto_close_business_start: string | null
          auto_close_enabled: boolean | null
          auto_close_message_template: string | null
          auto_close_only_business_hours: boolean | null
          auto_close_send_message: boolean | null
          created_at: string
          default_stage_fallback: string | null
          default_stage_new_lead: string | null
          default_stage_receptivo: string | null
          default_stage_whatsapp: string | null
          financial_approval_enabled: boolean | null
          financial_approval_min_cents: number | null
          id: string
          name: string
          owner_email: string | null
          owner_name: string | null
          phone: string | null
          receptive_module_enabled: boolean
          satisfaction_survey_enabled: boolean | null
          satisfaction_survey_message: string | null
          satisfaction_survey_on_auto_close: boolean | null
          satisfaction_survey_on_manual_close: boolean | null
          satisfaction_thank_you_message: string | null
          slug: string
          stock_allow_negative: boolean | null
          stock_use_average_cost: boolean | null
          stock_use_locations: boolean | null
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
          whatsapp_transcribe_client_audio: boolean | null
          whatsapp_transcribe_team_audio: boolean | null
        }
        Insert: {
          ai_energy_balance?: number | null
          ai_model_document?: string | null
          ai_model_image?: string | null
          auto_close_assigned_minutes?: number | null
          auto_close_bot_minutes?: number | null
          auto_close_business_end?: string | null
          auto_close_business_start?: string | null
          auto_close_enabled?: boolean | null
          auto_close_message_template?: string | null
          auto_close_only_business_hours?: boolean | null
          auto_close_send_message?: boolean | null
          created_at?: string
          default_stage_fallback?: string | null
          default_stage_new_lead?: string | null
          default_stage_receptivo?: string | null
          default_stage_whatsapp?: string | null
          financial_approval_enabled?: boolean | null
          financial_approval_min_cents?: number | null
          id?: string
          name: string
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          receptive_module_enabled?: boolean
          satisfaction_survey_enabled?: boolean | null
          satisfaction_survey_message?: string | null
          satisfaction_survey_on_auto_close?: boolean | null
          satisfaction_survey_on_manual_close?: boolean | null
          satisfaction_thank_you_message?: string | null
          slug: string
          stock_allow_negative?: boolean | null
          stock_use_average_cost?: boolean | null
          stock_use_locations?: boolean | null
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
          whatsapp_transcribe_client_audio?: boolean | null
          whatsapp_transcribe_team_audio?: boolean | null
        }
        Update: {
          ai_energy_balance?: number | null
          ai_model_document?: string | null
          ai_model_image?: string | null
          auto_close_assigned_minutes?: number | null
          auto_close_bot_minutes?: number | null
          auto_close_business_end?: string | null
          auto_close_business_start?: string | null
          auto_close_enabled?: boolean | null
          auto_close_message_template?: string | null
          auto_close_only_business_hours?: boolean | null
          auto_close_send_message?: boolean | null
          created_at?: string
          default_stage_fallback?: string | null
          default_stage_new_lead?: string | null
          default_stage_receptivo?: string | null
          default_stage_whatsapp?: string | null
          financial_approval_enabled?: boolean | null
          financial_approval_min_cents?: number | null
          id?: string
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          receptive_module_enabled?: boolean
          satisfaction_survey_enabled?: boolean | null
          satisfaction_survey_message?: string | null
          satisfaction_survey_on_auto_close?: boolean | null
          satisfaction_survey_on_manual_close?: boolean | null
          satisfaction_thank_you_message?: string | null
          slug?: string
          stock_allow_negative?: boolean | null
          stock_use_average_cost?: boolean | null
          stock_use_locations?: boolean | null
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
          whatsapp_transcribe_client_audio?: boolean | null
          whatsapp_transcribe_team_audio?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_default_stage_fallback_fkey"
            columns: ["default_stage_fallback"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_default_stage_new_lead_fkey"
            columns: ["default_stage_new_lead"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_default_stage_receptivo_fkey"
            columns: ["default_stage_receptivo"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_default_stage_whatsapp_fkey"
            columns: ["default_stage_whatsapp"]
            isOneToOne: false
            referencedRelation: "organization_funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          accepted_by_user_id: string | null
          commission_type: string
          commission_value: number
          created_at: string
          document: string | null
          email: string
          id: string
          name: string
          organization_id: string
          partner_association_id: string | null
          partner_type: string
          public_link_id: string
          rejection_reason: string | null
          responsible_for_chargebacks: boolean
          responsible_for_refunds: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          virtual_account_id: string | null
          whatsapp: string | null
        }
        Insert: {
          accepted_by_user_id?: string | null
          commission_type: string
          commission_value: number
          created_at?: string
          document?: string | null
          email: string
          id?: string
          name: string
          organization_id: string
          partner_association_id?: string | null
          partner_type: string
          public_link_id: string
          rejection_reason?: string | null
          responsible_for_chargebacks?: boolean
          responsible_for_refunds?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          virtual_account_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          accepted_by_user_id?: string | null
          commission_type?: string
          commission_value?: number
          created_at?: string
          document?: string | null
          email?: string
          id?: string
          name?: string
          organization_id?: string
          partner_association_id?: string | null
          partner_type?: string
          public_link_id?: string
          rejection_reason?: string | null
          responsible_for_chargebacks?: boolean
          responsible_for_refunds?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          virtual_account_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_partner_association_id_fkey"
            columns: ["partner_association_id"]
            isOneToOne: false
            referencedRelation: "partner_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_public_link_id_fkey"
            columns: ["public_link_id"]
            isOneToOne: false
            referencedRelation: "partner_public_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_associations: {
        Row: {
          affiliate_code: string | null
          commission_type: string
          commission_value: number
          created_at: string | null
          id: string
          is_active: boolean | null
          linked_checkout_id: string | null
          linked_landing_id: string | null
          linked_product_id: string | null
          linked_quiz_id: string | null
          linked_storefront_id: string | null
          organization_id: string
          partner_type: string
          responsible_for_chargebacks: boolean | null
          responsible_for_refunds: boolean | null
          updated_at: string | null
          virtual_account_id: string
        }
        Insert: {
          affiliate_code?: string | null
          commission_type?: string
          commission_value?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          linked_checkout_id?: string | null
          linked_landing_id?: string | null
          linked_product_id?: string | null
          linked_quiz_id?: string | null
          linked_storefront_id?: string | null
          organization_id: string
          partner_type: string
          responsible_for_chargebacks?: boolean | null
          responsible_for_refunds?: boolean | null
          updated_at?: string | null
          virtual_account_id: string
        }
        Update: {
          affiliate_code?: string | null
          commission_type?: string
          commission_value?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          linked_checkout_id?: string | null
          linked_landing_id?: string | null
          linked_product_id?: string | null
          linked_quiz_id?: string | null
          linked_storefront_id?: string | null
          organization_id?: string
          partner_type?: string
          responsible_for_chargebacks?: boolean | null
          responsible_for_refunds?: boolean | null
          updated_at?: string | null
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_associations_linked_checkout_id_fkey"
            columns: ["linked_checkout_id"]
            isOneToOne: false
            referencedRelation: "standalone_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_associations_linked_landing_id_fkey"
            columns: ["linked_landing_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_associations_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_associations_linked_quiz_id_fkey"
            columns: ["linked_quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_associations_linked_storefront_id_fkey"
            columns: ["linked_storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_associations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_associations_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          commission_type: string
          commission_value: number
          created_at: string | null
          document: string | null
          email: string
          expires_at: string | null
          id: string
          invite_code: string
          invited_by: string | null
          linked_checkout_id: string | null
          linked_landing_id: string | null
          linked_product_id: string | null
          name: string
          notification_sent_at: string | null
          notification_type: string | null
          organization_id: string
          partner_type: string
          responsible_for_chargebacks: boolean | null
          responsible_for_refunds: boolean | null
          status: string
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          commission_type?: string
          commission_value?: number
          created_at?: string | null
          document?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_code?: string
          invited_by?: string | null
          linked_checkout_id?: string | null
          linked_landing_id?: string | null
          linked_product_id?: string | null
          name: string
          notification_sent_at?: string | null
          notification_type?: string | null
          organization_id: string
          partner_type: string
          responsible_for_chargebacks?: boolean | null
          responsible_for_refunds?: boolean | null
          status?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          commission_type?: string
          commission_value?: number
          created_at?: string | null
          document?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_code?: string
          invited_by?: string | null
          linked_checkout_id?: string | null
          linked_landing_id?: string | null
          linked_product_id?: string | null
          name?: string
          notification_sent_at?: string | null
          notification_type?: string | null
          organization_id?: string
          partner_type?: string
          responsible_for_chargebacks?: boolean | null
          responsible_for_refunds?: boolean | null
          status?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_invitations_linked_checkout_id_fkey"
            columns: ["linked_checkout_id"]
            isOneToOne: false
            referencedRelation: "standalone_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invitations_linked_landing_id_fkey"
            columns: ["linked_landing_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invitations_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_public_links: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          linked_checkout_id: string | null
          linked_landing_id: string | null
          linked_product_id: string | null
          max_registrations: number | null
          name: string
          organization_id: string
          partner_type: string
          registrations_count: number
          responsible_for_chargebacks: boolean
          responsible_for_refunds: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          linked_checkout_id?: string | null
          linked_landing_id?: string | null
          linked_product_id?: string | null
          max_registrations?: number | null
          name: string
          organization_id: string
          partner_type?: string
          registrations_count?: number
          responsible_for_chargebacks?: boolean
          responsible_for_refunds?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          linked_checkout_id?: string | null
          linked_landing_id?: string | null
          linked_product_id?: string | null
          max_registrations?: number | null
          name?: string
          organization_id?: string
          partner_type?: string
          registrations_count?: number
          responsible_for_chargebacks?: boolean
          responsible_for_refunds?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_public_links_linked_checkout_id_fkey"
            columns: ["linked_checkout_id"]
            isOneToOne: false
            referencedRelation: "standalone_checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_public_links_linked_landing_id_fkey"
            columns: ["linked_landing_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_public_links_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_public_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      payment_admin_actions: {
        Row: {
          action_type: string
          amount_cents: number | null
          created_at: string | null
          gateway: string | null
          id: string
          metadata: Json | null
          new_status: string | null
          notes: string | null
          organization_id: string | null
          payment_attempt_id: string | null
          performed_by: string | null
          previous_status: string | null
          sale_id: string | null
        }
        Insert: {
          action_type: string
          amount_cents?: number | null
          created_at?: string | null
          gateway?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_attempt_id?: string | null
          performed_by?: string | null
          previous_status?: string | null
          sale_id?: string | null
        }
        Update: {
          action_type?: string
          amount_cents?: number | null
          created_at?: string | null
          gateway?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_attempt_id?: string | null
          performed_by?: string | null
          previous_status?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_admin_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_admin_actions_payment_attempt_id_fkey"
            columns: ["payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_admin_actions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount_cents: number
          attempt_number: number | null
          cart_id: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          fallback_from_gateway: string | null
          gateway: string
          gateway_response: Json | null
          gateway_transaction_id: string | null
          id: string
          installments: number | null
          ip_address: string | null
          is_fallback: boolean | null
          organization_id: string | null
          payment_method: string
          response_time_ms: number | null
          sale_id: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          amount_cents: number
          attempt_number?: number | null
          cart_id?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          fallback_from_gateway?: string | null
          gateway: string
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          installments?: number | null
          ip_address?: string | null
          is_fallback?: boolean | null
          organization_id?: string | null
          payment_method: string
          response_time_ms?: number | null
          sale_id?: string | null
          status: string
          user_agent?: string | null
        }
        Update: {
          amount_cents?: number
          attempt_number?: number | null
          cart_id?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          fallback_from_gateway?: string | null
          gateway?: string
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          id?: string
          installments?: number | null
          ip_address?: string | null
          is_fallback?: boolean | null
          organization_id?: string | null
          payment_method?: string
          response_time_ms?: number | null
          sale_id?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
          cnpj: string | null
          created_at: string
          default_bank_account_id: string | null
          id: string
          is_active: boolean
          name: string
          normalized_name: string
          organization_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          default_bank_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          normalized_name: string
          organization_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          default_bank_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          normalized_name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_cost_centers_default_bank_account_id_fkey"
            columns: ["default_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_cost_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          created_at: string
          gateway_type: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_sandbox: boolean | null
          name: string
          organization_id: string
          settings: Json | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          gateway_type: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_sandbox?: boolean | null
          name: string
          organization_id: string
          settings?: Json | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          gateway_type?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_sandbox?: boolean | null
          name?: string
          organization_id?: string
          settings?: Json | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_link_attempts: {
        Row: {
          amount_cents: number
          created_at: string
          customer_document: string | null
          error_code: string | null
          error_message: string | null
          gateway_response: Json | null
          id: string
          ip_address: string | null
          organization_id: string
          payment_link_id: string | null
          payment_method: string
          status: string
          transaction_id: string | null
          user_agent: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          customer_document?: string | null
          error_code?: string | null
          error_message?: string | null
          gateway_response?: Json | null
          id?: string
          ip_address?: string | null
          organization_id: string
          payment_link_id?: string | null
          payment_method: string
          status: string
          transaction_id?: string | null
          user_agent?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          customer_document?: string | null
          error_code?: string | null
          error_message?: string | null
          gateway_response?: Json | null
          id?: string
          ip_address?: string | null
          organization_id?: string
          payment_link_id?: string | null
          payment_method?: string
          status?: string
          transaction_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_link_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_attempts_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_attempts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_link_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_link_transactions: {
        Row: {
          amount_cents: number
          base_amount_cents: number | null
          boleto_barcode: string | null
          boleto_expires_at: string | null
          boleto_url: string | null
          cancelled_at: string | null
          card_brand: string | null
          card_last_digits: string | null
          created_at: string
          created_by: string | null
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          error_message: string | null
          fee_cents: number | null
          gateway_charge_id: string | null
          gateway_order_id: string | null
          gateway_response: Json | null
          gateway_transaction_id: string | null
          gateway_type: string | null
          id: string
          installment_fee_cents: number | null
          installments: number | null
          interest_amount_cents: number | null
          ip_address: string | null
          lead_id: string | null
          metadata: Json | null
          net_amount_cents: number | null
          organization_id: string
          origin_type: string
          paid_at: string | null
          payment_link_id: string | null
          payment_method: string
          pix_expires_at: string | null
          pix_qr_code: string | null
          pix_qr_code_url: string | null
          refunded_at: string | null
          release_date: string | null
          released_at: string | null
          sale_id: string | null
          status: string
          updated_at: string
          user_agent: string | null
          virtual_account_id: string | null
        }
        Insert: {
          amount_cents: number
          base_amount_cents?: number | null
          boleto_barcode?: string | null
          boleto_expires_at?: string | null
          boleto_url?: string | null
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          created_at?: string
          created_by?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error_message?: string | null
          fee_cents?: number | null
          gateway_charge_id?: string | null
          gateway_order_id?: string | null
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          gateway_type?: string | null
          id?: string
          installment_fee_cents?: number | null
          installments?: number | null
          interest_amount_cents?: number | null
          ip_address?: string | null
          lead_id?: string | null
          metadata?: Json | null
          net_amount_cents?: number | null
          organization_id: string
          origin_type?: string
          paid_at?: string | null
          payment_link_id?: string | null
          payment_method: string
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          refunded_at?: string | null
          release_date?: string | null
          released_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          virtual_account_id?: string | null
        }
        Update: {
          amount_cents?: number
          base_amount_cents?: number | null
          boleto_barcode?: string | null
          boleto_expires_at?: string | null
          boleto_url?: string | null
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          created_at?: string
          created_by?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error_message?: string | null
          fee_cents?: number | null
          gateway_charge_id?: string | null
          gateway_order_id?: string | null
          gateway_response?: Json | null
          gateway_transaction_id?: string | null
          gateway_type?: string | null
          id?: string
          installment_fee_cents?: number | null
          installments?: number | null
          interest_amount_cents?: number | null
          ip_address?: string | null
          lead_id?: string | null
          metadata?: Json | null
          net_amount_cents?: number | null
          organization_id?: string
          origin_type?: string
          paid_at?: string | null
          payment_link_id?: string | null
          payment_method?: string
          pix_expires_at?: string | null
          pix_qr_code?: string | null
          pix_qr_code_url?: string | null
          refunded_at?: string | null
          release_date?: string | null
          released_at?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          virtual_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_link_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_transactions_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_transactions_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          allow_custom_amount: boolean | null
          amount_cents: number | null
          boleto_enabled: boolean | null
          card_enabled: boolean | null
          created_at: string
          created_by: string | null
          customer_cep: string | null
          customer_city: string | null
          customer_complement: string | null
          customer_document: string | null
          customer_email: string | null
          customer_name: string | null
          customer_neighborhood: string | null
          customer_phone: string | null
          customer_state: string | null
          customer_street: string | null
          customer_street_number: string | null
          description: string | null
          expires_at: string | null
          external_reference: string | null
          id: string
          is_active: boolean | null
          lead_id: string | null
          max_amount_cents: number | null
          max_installments: number | null
          max_uses: number | null
          min_amount_cents: number | null
          notes: string | null
          organization_id: string
          pix_enabled: boolean | null
          slug: string
          title: string
          updated_at: string
          use_count: number | null
        }
        Insert: {
          allow_custom_amount?: boolean | null
          amount_cents?: number | null
          boleto_enabled?: boolean | null
          card_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          customer_cep?: string | null
          customer_city?: string | null
          customer_complement?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_neighborhood?: string | null
          customer_phone?: string | null
          customer_state?: string | null
          customer_street?: string | null
          customer_street_number?: string | null
          description?: string | null
          expires_at?: string | null
          external_reference?: string | null
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          max_amount_cents?: number | null
          max_installments?: number | null
          max_uses?: number | null
          min_amount_cents?: number | null
          notes?: string | null
          organization_id: string
          pix_enabled?: boolean | null
          slug: string
          title: string
          updated_at?: string
          use_count?: number | null
        }
        Update: {
          allow_custom_amount?: boolean | null
          amount_cents?: number | null
          boleto_enabled?: boolean | null
          card_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          customer_cep?: string | null
          customer_city?: string | null
          customer_complement?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_neighborhood?: string | null
          customer_phone?: string | null
          customer_state?: string | null
          customer_street?: string | null
          customer_street_number?: string | null
          description?: string | null
          expires_at?: string | null
          external_reference?: string | null
          id?: string
          is_active?: boolean | null
          lead_id?: string | null
          max_amount_cents?: number | null
          max_installments?: number | null
          max_uses?: number | null
          min_amount_cents?: number | null
          notes?: string | null
          organization_id?: string
          pix_enabled?: boolean | null
          slug?: string
          title?: string
          updated_at?: string
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_organization_id_fkey"
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
      payment_reminder_log: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          reminder_type: string
          sent_at: string
          sent_to: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          reminder_type: string
          sent_at?: string
          sent_to: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          reminder_type?: string
          sent_at?: string
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminder_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sources: {
        Row: {
          created_at: string
          credentials_encrypted: Json | null
          display_name: string
          id: string
          is_active: boolean | null
          organization_id: string
          pix_key: string | null
          source: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          credentials_encrypted?: Json | null
          display_name: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          pix_key?: string | null
          source: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          credentials_encrypted?: Json | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          pix_key?: string | null
          source?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_closing_sales: {
        Row: {
          closing_id: string
          closing_type: string
          created_at: string
          delivered_at: string | null
          id: string
          lead_name: string | null
          organization_id: string
          payment_method: string | null
          sale_id: string
          sale_number: string | null
          total_cents: number | null
        }
        Insert: {
          closing_id: string
          closing_type?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          lead_name?: string | null
          organization_id: string
          payment_method?: string | null
          sale_id: string
          sale_number?: string | null
          total_cents?: number | null
        }
        Update: {
          closing_id?: string
          closing_type?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          lead_name?: string | null
          organization_id?: string
          payment_method?: string | null
          sale_id?: string
          sale_number?: string | null
          total_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_closing_sales_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "pickup_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_closing_sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_closing_sales_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_closings: {
        Row: {
          closing_date: string
          closing_number: number
          closing_type: string
          confirmed_at_admin: string | null
          confirmed_at_auxiliar: string | null
          confirmed_by_admin: string | null
          confirmed_by_auxiliar: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          status: string
          total_amount_cents: number
          total_card_cents: number
          total_cash_cents: number
          total_other_cents: number
          total_pix_cents: number
          total_sales: number
        }
        Insert: {
          closing_date?: string
          closing_number?: number
          closing_type?: string
          confirmed_at_admin?: string | null
          confirmed_at_auxiliar?: string | null
          confirmed_by_admin?: string | null
          confirmed_by_auxiliar?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          status?: string
          total_amount_cents?: number
          total_card_cents?: number
          total_cash_cents?: number
          total_other_cents?: number
          total_pix_cents?: number
          total_sales?: number
        }
        Update: {
          closing_date?: string
          closing_number?: number
          closing_type?: string
          confirmed_at_admin?: string | null
          confirmed_at_auxiliar?: string | null
          confirmed_by_admin?: string | null
          confirmed_by_auxiliar?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          status?: string
          total_amount_cents?: number
          total_card_cents?: number
          total_cash_cents?: number
          total_other_cents?: number
          total_pix_cents?: number
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "pickup_closings_organization_id_fkey"
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
      platform_gateway_config: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          created_at: string | null
          display_name: string
          gateway_type: string
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          is_sandbox: boolean | null
          priority: number | null
          settings: Json | null
          updated_at: string | null
          webhook_secret_encrypted: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          display_name: string
          gateway_type: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          is_sandbox?: boolean | null
          priority?: number | null
          settings?: Json | null
          updated_at?: string | null
          webhook_secret_encrypted?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          display_name?: string
          gateway_type?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          is_sandbox?: boolean | null
          priority?: number | null
          settings?: Json | null
          updated_at?: string | null
          webhook_secret_encrypted?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pos_terminal_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          pos_terminal_id: string
          unassigned_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          pos_terminal_id: string
          unassigned_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          pos_terminal_id?: string
          unassigned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_terminal_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pos_terminal_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_terminal_assignments_pos_terminal_id_fkey"
            columns: ["pos_terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_terminal_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pos_terminals: {
        Row: {
          assignment_type: string | null
          cost_center_id: string | null
          created_at: string
          extra_config: Json | null
          gateway_type: Database["public"]["Enums"]["pos_gateway_type"]
          id: string
          is_active: boolean
          logical_number: string | null
          name: string
          organization_id: string
          payment_method_id: string | null
          serial_number: string | null
          terminal_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          assignment_type?: string | null
          cost_center_id?: string | null
          created_at?: string
          extra_config?: Json | null
          gateway_type: Database["public"]["Enums"]["pos_gateway_type"]
          id?: string
          is_active?: boolean
          logical_number?: string | null
          name: string
          organization_id: string
          payment_method_id?: string | null
          serial_number?: string | null
          terminal_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          assignment_type?: string | null
          cost_center_id?: string | null
          created_at?: string
          extra_config?: Json | null
          gateway_type?: Database["public"]["Enums"]["pos_gateway_type"]
          id?: string
          is_active?: boolean
          logical_number?: string | null
          name?: string
          organization_id?: string
          payment_method_id?: string | null
          serial_number?: string | null
          terminal_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_terminals_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "payment_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_terminals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_terminals_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          amount_cents: number
          authorization_code: string | null
          card_brand: string | null
          card_last_digits: string | null
          created_at: string
          fee_cents: number | null
          gateway_timestamp: string | null
          gateway_transaction_id: string | null
          gateway_type: Database["public"]["Enums"]["pos_gateway_type"]
          id: string
          installments: number | null
          match_status: Database["public"]["Enums"]["pos_match_status"]
          matched_at: string | null
          matched_by: string | null
          matched_user_id: string | null
          net_amount_cents: number | null
          nsu: string | null
          organization_id: string
          pos_terminal_id: string | null
          raw_payload: Json | null
          sale_id: string | null
          sale_installment_id: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          authorization_code?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          created_at?: string
          fee_cents?: number | null
          gateway_timestamp?: string | null
          gateway_transaction_id?: string | null
          gateway_type: Database["public"]["Enums"]["pos_gateway_type"]
          id?: string
          installments?: number | null
          match_status?: Database["public"]["Enums"]["pos_match_status"]
          matched_at?: string | null
          matched_by?: string | null
          matched_user_id?: string | null
          net_amount_cents?: number | null
          nsu?: string | null
          organization_id: string
          pos_terminal_id?: string | null
          raw_payload?: Json | null
          sale_id?: string | null
          sale_installment_id?: string | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          authorization_code?: string | null
          card_brand?: string | null
          card_last_digits?: string | null
          created_at?: string
          fee_cents?: number | null
          gateway_timestamp?: string | null
          gateway_transaction_id?: string | null
          gateway_type?: Database["public"]["Enums"]["pos_gateway_type"]
          id?: string
          installments?: number | null
          match_status?: Database["public"]["Enums"]["pos_match_status"]
          matched_at?: string | null
          matched_by?: string | null
          matched_user_id?: string | null
          net_amount_cents?: number | null
          nsu?: string | null
          organization_id?: string
          pos_terminal_id?: string | null
          raw_payload?: Json | null
          sale_id?: string | null
          sale_installment_id?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pos_transactions_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pos_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_pos_terminal_id_fkey"
            columns: ["pos_terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_sale_installment_id_fkey"
            columns: ["sale_installment_id"]
            isOneToOne: false
            referencedRelation: "sale_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_questions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_required: boolean
          organization_id: string
          position: number
          question: string
          question_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          organization_id: string
          position?: number
          question: string
          question_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          organization_id?: string
          position?: number
          question?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_responses: {
        Row: {
          answer_boolean: boolean | null
          answer_number: number | null
          answer_text: string | null
          created_at: string
          id: string
          organization_id: string
          question_id: string
          survey_id: string
        }
        Insert: {
          answer_boolean?: boolean | null
          answer_number?: number | null
          answer_text?: string | null
          created_at?: string
          id?: string
          organization_id: string
          question_id: string
          survey_id: string
        }
        Update: {
          answer_boolean?: boolean | null
          answer_number?: number | null
          answer_text?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          question_id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "post_sale_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "post_sale_surveys"
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
      product_combo_items: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          position: number
          product_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          position?: number
          product_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "product_combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_combo_prices: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          minimum_custom_commission: number | null
          minimum_price_cents: number | null
          minimum_use_default_commission: boolean | null
          multiplier: number
          organization_id: string
          points: number | null
          position: number
          promotional_2_custom_commission: number | null
          promotional_2_use_default_commission: boolean | null
          promotional_custom_commission: number | null
          promotional_price_2_cents: number | null
          promotional_price_cents: number | null
          promotional_use_default_commission: boolean | null
          regular_custom_commission: number | null
          regular_price_cents: number
          regular_use_default_commission: boolean | null
          sales_hack: string | null
          updated_at: string
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          minimum_custom_commission?: number | null
          minimum_price_cents?: number | null
          minimum_use_default_commission?: boolean | null
          multiplier?: number
          organization_id: string
          points?: number | null
          position?: number
          promotional_2_custom_commission?: number | null
          promotional_2_use_default_commission?: boolean | null
          promotional_custom_commission?: number | null
          promotional_price_2_cents?: number | null
          promotional_price_cents?: number | null
          promotional_use_default_commission?: boolean | null
          regular_custom_commission?: number | null
          regular_price_cents?: number
          regular_use_default_commission?: boolean | null
          sales_hack?: string | null
          updated_at?: string
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          minimum_custom_commission?: number | null
          minimum_price_cents?: number | null
          minimum_use_default_commission?: boolean | null
          multiplier?: number
          organization_id?: string
          points?: number | null
          position?: number
          promotional_2_custom_commission?: number | null
          promotional_2_use_default_commission?: boolean | null
          promotional_custom_commission?: number | null
          promotional_price_2_cents?: number | null
          promotional_price_cents?: number | null
          promotional_use_default_commission?: boolean | null
          regular_custom_commission?: number | null
          regular_price_cents?: number
          regular_use_default_commission?: boolean | null
          sales_hack?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_combo_prices_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "product_combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_combo_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_combos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          organization_id: string
          sku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          organization_id: string
          sku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          organization_id?: string
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_combos_organization_id_fkey"
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
      product_factory_costs: {
        Row: {
          additional_cost_cents: number | null
          created_at: string
          factory_fee_fixed_cents: number
          factory_fee_percent: number
          factory_id: string
          id: string
          is_active: boolean | null
          organization_id: string
          product_id: string
          shipping_cost_cents: number | null
          unit_cost_cents: number | null
          updated_at: string
        }
        Insert: {
          additional_cost_cents?: number | null
          created_at?: string
          factory_fee_fixed_cents?: number
          factory_fee_percent?: number
          factory_id: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          product_id: string
          shipping_cost_cents?: number | null
          unit_cost_cents?: number | null
          updated_at?: string
        }
        Update: {
          additional_cost_cents?: number | null
          created_at?: string
          factory_fee_fixed_cents?: number
          factory_fee_percent?: number
          factory_id?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          product_id?: string
          shipping_cost_cents?: number | null
          unit_cost_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_factory_costs_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_factory_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_factory_costs_product_id_fkey"
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
      product_industry_costs: {
        Row: {
          additional_cost_cents: number | null
          additional_cost_description: string | null
          created_at: string | null
          id: string
          industry_id: string
          is_active: boolean | null
          organization_id: string
          product_id: string
          shipping_cost_cents: number | null
          shipping_cost_description: string | null
          unit_cost_cents: number
          unit_cost_description: string | null
          updated_at: string | null
        }
        Insert: {
          additional_cost_cents?: number | null
          additional_cost_description?: string | null
          created_at?: string | null
          id?: string
          industry_id: string
          is_active?: boolean | null
          organization_id: string
          product_id: string
          shipping_cost_cents?: number | null
          shipping_cost_description?: string | null
          unit_cost_cents?: number
          unit_cost_description?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_cost_cents?: number | null
          additional_cost_description?: string | null
          created_at?: string | null
          id?: string
          industry_id?: string
          is_active?: boolean | null
          organization_id?: string
          product_id?: string
          shipping_cost_cents?: number | null
          shipping_cost_description?: string | null
          unit_cost_cents?: number
          unit_cost_description?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_industry_costs_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_industry_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_industry_costs_product_id_fkey"
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
          is_partner: boolean | null
          last_name: string
          monthly_goal_cents: number | null
          nickname: string | null
          organization_id: string | null
          partner_virtual_account_id: string | null
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
          is_partner?: boolean | null
          last_name: string
          monthly_goal_cents?: number | null
          nickname?: string | null
          organization_id?: string | null
          partner_virtual_account_id?: string | null
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
          is_partner?: boolean | null
          last_name?: string
          monthly_goal_cents?: number | null
          nickname?: string | null
          organization_id?: string | null
          partner_virtual_account_id?: string | null
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
          {
            foreignKeyName: "profiles_partner_virtual_account_id_fkey"
            columns: ["partner_virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_items: {
        Row: {
          cfop: string | null
          cofins_cents: number | null
          created_at: string
          discount_cents: number | null
          ean: string | null
          freight_cents: number | null
          icms_base_cents: number | null
          icms_st_cents: number | null
          icms_value_cents: number | null
          id: string
          invoice_id: string
          ipi_cents: number | null
          item_number: number
          link_status: string | null
          linked_at: string | null
          linked_by: string | null
          ncm: string | null
          organization_id: string
          pis_cents: number | null
          product_id: string | null
          quantity: number
          stock_entered: boolean | null
          stock_location_id: string | null
          stock_movement_id: string | null
          supplier_product_code: string | null
          supplier_product_name: string
          total_price_cents: number
          unit: string | null
          unit_price_cents: number
        }
        Insert: {
          cfop?: string | null
          cofins_cents?: number | null
          created_at?: string
          discount_cents?: number | null
          ean?: string | null
          freight_cents?: number | null
          icms_base_cents?: number | null
          icms_st_cents?: number | null
          icms_value_cents?: number | null
          id?: string
          invoice_id: string
          ipi_cents?: number | null
          item_number: number
          link_status?: string | null
          linked_at?: string | null
          linked_by?: string | null
          ncm?: string | null
          organization_id: string
          pis_cents?: number | null
          product_id?: string | null
          quantity: number
          stock_entered?: boolean | null
          stock_location_id?: string | null
          stock_movement_id?: string | null
          supplier_product_code?: string | null
          supplier_product_name: string
          total_price_cents: number
          unit?: string | null
          unit_price_cents: number
        }
        Update: {
          cfop?: string | null
          cofins_cents?: number | null
          created_at?: string
          discount_cents?: number | null
          ean?: string | null
          freight_cents?: number | null
          icms_base_cents?: number | null
          icms_st_cents?: number | null
          icms_value_cents?: number | null
          id?: string
          invoice_id?: string
          ipi_cents?: number | null
          item_number?: number
          link_status?: string | null
          linked_at?: string | null
          linked_by?: string | null
          ncm?: string | null
          organization_id?: string
          pis_cents?: number | null
          product_id?: string | null
          quantity?: number
          stock_entered?: boolean | null
          stock_location_id?: string | null
          stock_movement_id?: string | null
          supplier_product_code?: string | null
          supplier_product_name?: string
          total_price_cents?: number
          unit?: string | null
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          access_key: string | null
          created_at: string
          created_by: string | null
          entry_date: string | null
          id: string
          installments_generated: boolean | null
          issue_date: string
          notes: string | null
          number: string
          organization_id: string
          payment_condition: string | null
          processed_at: string | null
          processed_by: string | null
          series: string | null
          status: string
          supplier_cnpj: string
          supplier_id: string | null
          supplier_ie: string | null
          supplier_name: string
          total_discount_cents: number
          total_freight_cents: number
          total_invoice_cents: number
          total_products_cents: number
          total_taxes_cents: number
          updated_at: string
          xml_content: string | null
          xml_storage_path: string | null
        }
        Insert: {
          access_key?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string | null
          id?: string
          installments_generated?: boolean | null
          issue_date: string
          notes?: string | null
          number: string
          organization_id: string
          payment_condition?: string | null
          processed_at?: string | null
          processed_by?: string | null
          series?: string | null
          status?: string
          supplier_cnpj: string
          supplier_id?: string | null
          supplier_ie?: string | null
          supplier_name: string
          total_discount_cents?: number
          total_freight_cents?: number
          total_invoice_cents?: number
          total_products_cents?: number
          total_taxes_cents?: number
          updated_at?: string
          xml_content?: string | null
          xml_storage_path?: string | null
        }
        Update: {
          access_key?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string | null
          id?: string
          installments_generated?: boolean | null
          issue_date?: string
          notes?: string | null
          number?: string
          organization_id?: string
          payment_condition?: string | null
          processed_at?: string | null
          processed_by?: string | null
          series?: string | null
          status?: string
          supplier_cnpj?: string
          supplier_id?: string | null
          supplier_ie?: string | null
          supplier_name?: string
          total_discount_cents?: number
          total_freight_cents?: number
          total_invoice_cents?: number
          total_products_cents?: number
          total_taxes_cents?: number
          updated_at?: string
          xml_content?: string | null
          xml_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answered_at: string
          id: string
          imc_category: string | null
          imc_height: number | null
          imc_result: number | null
          imc_weight: number | null
          numeric_value: number | null
          organization_id: string
          selected_option_ids: string[] | null
          session_id: string
          step_id: string
          text_value: string | null
        }
        Insert: {
          answered_at?: string
          id?: string
          imc_category?: string | null
          imc_height?: number | null
          imc_result?: number | null
          imc_weight?: number | null
          numeric_value?: number | null
          organization_id: string
          selected_option_ids?: string[] | null
          session_id: string
          step_id: string
          text_value?: string | null
        }
        Update: {
          answered_at?: string
          id?: string
          imc_category?: string | null
          imc_height?: number | null
          imc_result?: number | null
          imc_weight?: number | null
          numeric_value?: number | null
          organization_id?: string
          selected_option_ids?: string[] | null
          session_id?: string
          step_id?: string
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "quiz_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          quiz_id: string
          session_id: string | null
          step_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          quiz_id: string
          session_id?: string | null
          step_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          quiz_id?: string
          session_id?: string | null
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_events_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          captured_cpf: string | null
          captured_email: string | null
          captured_name: string | null
          captured_whatsapp: string | null
          completed_at: string | null
          current_step_id: string | null
          fbclid: string | null
          final_result_tag: string | null
          gclid: string | null
          id: string
          ip_address: string | null
          is_completed: boolean | null
          lead_id: string | null
          organization_id: string
          quiz_id: string
          referrer: string | null
          started_at: string
          total_score: number | null
          ttclid: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_fingerprint: string | null
        }
        Insert: {
          captured_cpf?: string | null
          captured_email?: string | null
          captured_name?: string | null
          captured_whatsapp?: string | null
          completed_at?: string | null
          current_step_id?: string | null
          fbclid?: string | null
          final_result_tag?: string | null
          gclid?: string | null
          id?: string
          ip_address?: string | null
          is_completed?: boolean | null
          lead_id?: string | null
          organization_id: string
          quiz_id: string
          referrer?: string | null
          started_at?: string
          total_score?: number | null
          ttclid?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_fingerprint?: string | null
        }
        Update: {
          captured_cpf?: string | null
          captured_email?: string | null
          captured_name?: string | null
          captured_whatsapp?: string | null
          completed_at?: string | null
          current_step_id?: string | null
          fbclid?: string | null
          final_result_tag?: string | null
          gclid?: string | null
          id?: string
          ip_address?: string | null
          is_completed?: boolean | null
          lead_id?: string | null
          organization_id?: string
          quiz_id?: string
          referrer?: string | null
          started_at?: string
          total_score?: number | null
          ttclid?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_fingerprint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_step_options: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          image_url: string | null
          label: string
          next_step_id: string | null
          organization_id: string
          position: number
          result_tag: string | null
          score: number | null
          step_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          label: string
          next_step_id?: string | null
          organization_id: string
          position?: number
          result_tag?: string | null
          score?: number | null
          step_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          label?: string
          next_step_id?: string | null
          organization_id?: string
          position?: number
          result_tag?: string | null
          score?: number | null
          step_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_step_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_step_options_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "quiz_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_steps: {
        Row: {
          capture_cpf: boolean | null
          capture_email: boolean | null
          capture_name: boolean | null
          capture_whatsapp: boolean | null
          created_at: string
          id: string
          image_url: string | null
          is_required: boolean | null
          next_step_id: string | null
          organization_id: string
          position: number
          quiz_id: string
          result_cta_text: string | null
          result_cta_type: string | null
          result_cta_url: string | null
          result_description: string | null
          result_image_url: string | null
          result_product_id: string | null
          result_storefront_id: string | null
          result_title: string | null
          result_whatsapp_message: string | null
          result_whatsapp_number: string | null
          step_type: string
          subtitle: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          capture_cpf?: boolean | null
          capture_email?: boolean | null
          capture_name?: boolean | null
          capture_whatsapp?: boolean | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_required?: boolean | null
          next_step_id?: string | null
          organization_id: string
          position?: number
          quiz_id: string
          result_cta_text?: string | null
          result_cta_type?: string | null
          result_cta_url?: string | null
          result_description?: string | null
          result_image_url?: string | null
          result_product_id?: string | null
          result_storefront_id?: string | null
          result_title?: string | null
          result_whatsapp_message?: string | null
          result_whatsapp_number?: string | null
          step_type: string
          subtitle?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          capture_cpf?: boolean | null
          capture_email?: boolean | null
          capture_name?: boolean | null
          capture_whatsapp?: boolean | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_required?: boolean | null
          next_step_id?: string | null
          organization_id?: string
          position?: number
          quiz_id?: string
          result_cta_text?: string | null
          result_cta_type?: string | null
          result_cta_url?: string | null
          result_description?: string | null
          result_image_url?: string | null
          result_product_id?: string | null
          result_storefront_id?: string | null
          result_title?: string | null
          result_whatsapp_message?: string | null
          result_whatsapp_number?: string | null
          step_type?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_steps_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          auto_start_followup: boolean | null
          background_color: string | null
          created_at: string
          default_funnel_stage_id: string | null
          default_product_id: string | null
          default_seller_id: string | null
          description: string | null
          facebook_pixel_id: string | null
          followup_reason_id: string | null
          google_analytics_id: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          organization_id: string
          primary_color: string | null
          requires_lead_capture: boolean | null
          show_progress_bar: boolean | null
          slug: string
          tiktok_pixel_id: string | null
          updated_at: string
        }
        Insert: {
          auto_start_followup?: boolean | null
          background_color?: string | null
          created_at?: string
          default_funnel_stage_id?: string | null
          default_product_id?: string | null
          default_seller_id?: string | null
          description?: string | null
          facebook_pixel_id?: string | null
          followup_reason_id?: string | null
          google_analytics_id?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          organization_id: string
          primary_color?: string | null
          requires_lead_capture?: boolean | null
          show_progress_bar?: boolean | null
          slug: string
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_start_followup?: boolean | null
          background_color?: string | null
          created_at?: string
          default_funnel_stage_id?: string | null
          default_product_id?: string | null
          default_seller_id?: string | null
          description?: string | null
          facebook_pixel_id?: string | null
          followup_reason_id?: string | null
          google_analytics_id?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          organization_id?: string
          primary_color?: string | null
          requires_lead_capture?: boolean | null
          show_progress_bar?: boolean | null
          slug?: string
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_organization_id_fkey"
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
          pos_transaction_id: string | null
          reconciliation_status: string | null
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
          pos_transaction_id?: string | null
          reconciliation_status?: string | null
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
          pos_transaction_id?: string | null
          reconciliation_status?: string | null
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
            foreignKeyName: "sale_installments_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
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
      sale_splits: {
        Row: {
          created_at: string
          factory_id: string | null
          fee_cents: number | null
          gross_amount_cents: number
          id: string
          industry_id: string | null
          liable_for_chargeback: boolean
          liable_for_refund: boolean
          net_amount_cents: number
          percentage: number | null
          priority: number
          sale_id: string
          split_type: string
          transaction_id: string | null
          virtual_account_id: string
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          fee_cents?: number | null
          gross_amount_cents: number
          id?: string
          industry_id?: string | null
          liable_for_chargeback?: boolean
          liable_for_refund?: boolean
          net_amount_cents: number
          percentage?: number | null
          priority?: number
          sale_id: string
          split_type: string
          transaction_id?: string | null
          virtual_account_id: string
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          fee_cents?: number | null
          gross_amount_cents?: number
          id?: string
          industry_id?: string | null
          liable_for_chargeback?: boolean
          liable_for_refund?: boolean
          net_amount_cents?: number
          percentage?: number | null
          priority?: number
          sale_id?: string
          split_type?: string
          transaction_id?: string | null
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_splits_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_splits_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "virtual_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_splits_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
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
          checkout_url: string | null
          closed_at: string | null
          closed_by: string | null
          conference_completed_at: string | null
          conference_completed_by: string | null
          conversion_sent_at: string | null
          conversion_sent_to_google: boolean | null
          conversion_sent_to_meta: boolean | null
          created_at: string
          created_by: string
          delivered_at: string | null
          delivery_confirmed_at: string | null
          delivery_confirmed_by: string | null
          delivery_notes: string | null
          delivery_payment_type:
            | Database["public"]["Enums"]["delivery_payment_type"]
            | null
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
          fbclid: string | null
          finalized_at: string | null
          finalized_by: string | null
          gateway_fee_cents: number | null
          gateway_net_cents: number | null
          gateway_transaction_id: string | null
          gclid: string | null
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
          pos_transaction_id: string | null
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
          shipping_cost_real_cents: number | null
          src: string | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal_cents: number
          total_cents: number
          tracking_code: string | null
          ttclid: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          was_edited: boolean | null
        }
        Insert: {
          assigned_delivery_user_id?: string | null
          carrier_tracking_status?:
            | Database["public"]["Enums"]["carrier_tracking_status"]
            | null
          checkout_url?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conference_completed_at?: string | null
          conference_completed_by?: string | null
          conversion_sent_at?: string | null
          conversion_sent_to_google?: boolean | null
          conversion_sent_to_meta?: boolean | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_notes?: string | null
          delivery_payment_type?:
            | Database["public"]["Enums"]["delivery_payment_type"]
            | null
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
          fbclid?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          gateway_fee_cents?: number | null
          gateway_net_cents?: number | null
          gateway_transaction_id?: string | null
          gclid?: string | null
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
          pos_transaction_id?: string | null
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
          shipping_cost_real_cents?: number | null
          src?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          was_edited?: boolean | null
        }
        Update: {
          assigned_delivery_user_id?: string | null
          carrier_tracking_status?:
            | Database["public"]["Enums"]["carrier_tracking_status"]
            | null
          checkout_url?: string | null
          closed_at?: string | null
          closed_by?: string | null
          conference_completed_at?: string | null
          conference_completed_by?: string | null
          conversion_sent_at?: string | null
          conversion_sent_to_google?: boolean | null
          conversion_sent_to_meta?: boolean | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivery_confirmed_at?: string | null
          delivery_confirmed_by?: string | null
          delivery_notes?: string | null
          delivery_payment_type?:
            | Database["public"]["Enums"]["delivery_payment_type"]
            | null
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
          fbclid?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          gateway_fee_cents?: number | null
          gateway_net_cents?: number | null
          gateway_transaction_id?: string | null
          gclid?: string | null
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
          pos_transaction_id?: string | null
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
          shipping_cost_real_cents?: number | null
          src?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          was_edited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_delivery_confirmed_by_fkey"
            columns: ["delivery_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
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
            foreignKeyName: "sales_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
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
      saved_payment_methods: {
        Row: {
          card_brand: string | null
          card_expiry_month: number | null
          card_expiry_year: number | null
          card_first6: string | null
          card_holder_name: string | null
          card_last4: string | null
          created_at: string | null
          fingerprint_hash: string | null
          gateway: string
          gateway_card_id: string | null
          gateway_customer_id: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_used_at: string | null
          lead_id: string
          organization_id: string
          payment_type: string
          times_used: number | null
        }
        Insert: {
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_first6?: string | null
          card_holder_name?: string | null
          card_last4?: string | null
          created_at?: string | null
          fingerprint_hash?: string | null
          gateway: string
          gateway_card_id?: string | null
          gateway_customer_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          lead_id: string
          organization_id: string
          payment_type: string
          times_used?: number | null
        }
        Update: {
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_first6?: string | null
          card_holder_name?: string | null
          card_last4?: string | null
          created_at?: string | null
          fingerprint_hash?: string | null
          gateway?: string
          gateway_card_id?: string | null
          gateway_customer_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          lead_id?: string
          organization_id?: string
          payment_type?: string
          times_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_payment_methods_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_payment_methods_organization_id_fkey"
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
          correios_service_code: string | null
          cost_cents: number
          created_at: string
          estimated_days: number
          id: string
          is_active: boolean
          melhor_envio_service_id: number | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          correios_service_code?: string | null
          cost_cents?: number
          created_at?: string
          estimated_days?: number
          id?: string
          is_active?: boolean
          melhor_envio_service_id?: number | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          correios_service_code?: string | null
          cost_cents?: number
          created_at?: string
          estimated_days?: number
          id?: string
          is_active?: boolean
          melhor_envio_service_id?: number | null
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
      standalone_checkouts: {
        Row: {
          attribution_model: string | null
          checkout_type: string
          coproducer_commission_type: string | null
          coproducer_commission_value: number | null
          coproducer_id: string | null
          created_at: string
          custom_price_cents: number | null
          custom_product_name: string | null
          elements: Json
          facebook_pixel_id: string | null
          factory_commission_type: string | null
          factory_commission_value: number | null
          factory_id: string | null
          google_analytics_id: string | null
          id: string
          industry_commission_type: string | null
          industry_commission_value: number | null
          industry_id: string | null
          is_active: boolean | null
          meta_description: string | null
          meta_title: string | null
          name: string
          order_bump_description: string | null
          order_bump_discount_percent: number | null
          order_bump_enabled: boolean | null
          order_bump_headline: string | null
          order_bump_product_id: string | null
          organization_id: string
          payment_methods: string[]
          pix_discount_percent: number | null
          product_id: string
          quantity: number | null
          shipping_mode: string
          slug: string
          theme: Json
          tiktok_pixel_id: string | null
          updated_at: string
        }
        Insert: {
          attribution_model?: string | null
          checkout_type?: string
          coproducer_commission_type?: string | null
          coproducer_commission_value?: number | null
          coproducer_id?: string | null
          created_at?: string
          custom_price_cents?: number | null
          custom_product_name?: string | null
          elements?: Json
          facebook_pixel_id?: string | null
          factory_commission_type?: string | null
          factory_commission_value?: number | null
          factory_id?: string | null
          google_analytics_id?: string | null
          id?: string
          industry_commission_type?: string | null
          industry_commission_value?: number | null
          industry_id?: string | null
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          order_bump_description?: string | null
          order_bump_discount_percent?: number | null
          order_bump_enabled?: boolean | null
          order_bump_headline?: string | null
          order_bump_product_id?: string | null
          organization_id: string
          payment_methods?: string[]
          pix_discount_percent?: number | null
          product_id: string
          quantity?: number | null
          shipping_mode?: string
          slug: string
          theme?: Json
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Update: {
          attribution_model?: string | null
          checkout_type?: string
          coproducer_commission_type?: string | null
          coproducer_commission_value?: number | null
          coproducer_id?: string | null
          created_at?: string
          custom_price_cents?: number | null
          custom_product_name?: string | null
          elements?: Json
          facebook_pixel_id?: string | null
          factory_commission_type?: string | null
          factory_commission_value?: number | null
          factory_id?: string | null
          google_analytics_id?: string | null
          id?: string
          industry_commission_type?: string | null
          industry_commission_value?: number | null
          industry_id?: string | null
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          order_bump_description?: string | null
          order_bump_discount_percent?: number | null
          order_bump_enabled?: boolean | null
          order_bump_headline?: string | null
          order_bump_product_id?: string | null
          organization_id?: string
          payment_methods?: string[]
          pix_discount_percent?: number | null
          product_id?: string
          quantity?: number | null
          shipping_mode?: string
          slug?: string
          theme?: Json
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standalone_checkouts_coproducer_id_fkey"
            columns: ["coproducer_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_checkouts_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_checkouts_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_checkouts_order_bump_product_id_fkey"
            columns: ["order_bump_product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_checkouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_checkouts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
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
      stock_by_location: {
        Row: {
          average_cost_cents: number | null
          created_at: string
          id: string
          location_id: string
          organization_id: string
          product_id: string
          quantity: number
          reserved: number
          updated_at: string
        }
        Insert: {
          average_cost_cents?: number | null
          created_at?: string
          id?: string
          location_id: string
          organization_id: string
          product_id: string
          quantity?: number
          reserved?: number
          updated_at?: string
        }
        Update: {
          average_cost_cents?: number | null
          created_at?: string
          id?: string
          location_id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_by_location_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_by_location_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_by_location_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          cost_cents: number | null
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          location_id: string | null
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
          cost_cents?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          location_id?: string | null
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
          cost_cents?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          location_id?: string | null
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
            foreignKeyName: "stock_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
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
      storefront_banners: {
        Row: {
          button_style: string | null
          button_text: string | null
          created_at: string
          display_order: number | null
          ends_at: string | null
          id: string
          image_mobile_url: string | null
          image_tablet_url: string | null
          image_url: string
          is_active: boolean | null
          link_target: string | null
          link_url: string | null
          overlay_color: string | null
          position: string | null
          starts_at: string | null
          storefront_id: string
          subtitle: string | null
          text_color: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          button_style?: string | null
          button_text?: string | null
          created_at?: string
          display_order?: number | null
          ends_at?: string | null
          id?: string
          image_mobile_url?: string | null
          image_tablet_url?: string | null
          image_url: string
          is_active?: boolean | null
          link_target?: string | null
          link_url?: string | null
          overlay_color?: string | null
          position?: string | null
          starts_at?: string | null
          storefront_id: string
          subtitle?: string | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          button_style?: string | null
          button_text?: string | null
          created_at?: string
          display_order?: number | null
          ends_at?: string | null
          id?: string
          image_mobile_url?: string | null
          image_tablet_url?: string | null
          image_url?: string
          is_active?: boolean | null
          link_target?: string | null
          link_url?: string | null
          overlay_color?: string | null
          position?: string | null
          starts_at?: string | null
          storefront_id?: string
          subtitle?: string | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_banners_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          storefront_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          storefront_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          storefront_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "storefront_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_categories_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean | null
          ssl_status: string | null
          storefront_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean | null
          ssl_status?: string | null
          storefront_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean | null
          ssl_status?: string | null
          storefront_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storefront_domains_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_pages: {
        Row: {
          content: string | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          meta_description: string | null
          meta_title: string | null
          page_type: string
          slug: string
          storefront_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          page_type: string
          slug: string
          storefront_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          meta_description?: string | null
          meta_title?: string | null
          page_type?: string
          slug?: string
          storefront_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_pages_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_product_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          storefront_product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          storefront_product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          storefront_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "storefront_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_product_categories_storefront_product_id_fkey"
            columns: ["storefront_product_id"]
            isOneToOne: false
            referencedRelation: "storefront_products"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_products: {
        Row: {
          category_label: string | null
          combo_id: string | null
          created_at: string
          custom_description: string | null
          custom_images: Json | null
          custom_kit_prices: Json | null
          custom_name: string | null
          custom_price_12_cents: number | null
          custom_price_3_cents: number | null
          custom_price_6_cents: number | null
          custom_price_cents: number | null
          display_order: number | null
          highlight_badge: string | null
          id: string
          is_featured: boolean | null
          is_visible: boolean | null
          product_id: string | null
          show_crosssell: boolean | null
          show_kit_upsell: boolean | null
          storefront_id: string
        }
        Insert: {
          category_label?: string | null
          combo_id?: string | null
          created_at?: string
          custom_description?: string | null
          custom_images?: Json | null
          custom_kit_prices?: Json | null
          custom_name?: string | null
          custom_price_12_cents?: number | null
          custom_price_3_cents?: number | null
          custom_price_6_cents?: number | null
          custom_price_cents?: number | null
          display_order?: number | null
          highlight_badge?: string | null
          id?: string
          is_featured?: boolean | null
          is_visible?: boolean | null
          product_id?: string | null
          show_crosssell?: boolean | null
          show_kit_upsell?: boolean | null
          storefront_id: string
        }
        Update: {
          category_label?: string | null
          combo_id?: string | null
          created_at?: string
          custom_description?: string | null
          custom_images?: Json | null
          custom_kit_prices?: Json | null
          custom_name?: string | null
          custom_price_12_cents?: number | null
          custom_price_3_cents?: number | null
          custom_price_6_cents?: number | null
          custom_price_cents?: number | null
          display_order?: number | null
          highlight_badge?: string | null
          id?: string
          is_featured?: boolean | null
          is_visible?: boolean | null
          product_id?: string | null
          show_crosssell?: boolean | null
          show_kit_upsell?: boolean | null
          storefront_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_products_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "product_combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_products_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_templates: {
        Row: {
          config: Json | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          preview_image_url: string | null
          slug: string
          template_type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          preview_image_url?: string | null
          slug: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          preview_image_url?: string | null
          slug?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      storefront_testimonials: {
        Row: {
          created_at: string
          customer_name: string
          display_order: number | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          organization_id: string
          photo_url: string | null
          storefront_id: string
          testimonial_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          organization_id: string
          photo_url?: string | null
          storefront_id: string
          testimonial_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          organization_id?: string
          photo_url?: string | null
          storefront_id?: string
          testimonial_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_testimonials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_testimonials_storefront_id_fkey"
            columns: ["storefront_id"]
            isOneToOne: false
            referencedRelation: "tenant_storefronts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          allows_white_label: boolean | null
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
          pagarme_plan_id: string | null
          payment_provider: string | null
          price_cents: number
          stripe_extra_energy_price_id: string | null
          stripe_extra_users_price_id: string | null
          stripe_extra_whatsapp_instances_price_id: string | null
          stripe_price_id: string | null
        }
        Insert: {
          allows_white_label?: boolean | null
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
          pagarme_plan_id?: string | null
          payment_provider?: string | null
          price_cents: number
          stripe_extra_energy_price_id?: string | null
          stripe_extra_users_price_id?: string | null
          stripe_extra_whatsapp_instances_price_id?: string | null
          stripe_price_id?: string | null
        }
        Update: {
          allows_white_label?: boolean | null
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
          pagarme_plan_id?: string | null
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
      supplier_product_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          product_id: string
          supplier_cnpj: string
          supplier_product_code: string
          supplier_product_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          product_id: string
          supplier_cnpj: string
          supplier_product_code: string
          supplier_product_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          supplier_cnpj?: string
          supplier_product_code?: string
          supplier_product_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "lead_products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          complement: string | null
          contact_name: string | null
          cost_center_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          ie: string | null
          im: string | null
          is_active: boolean | null
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          organization_id: string
          phone: string | null
          pix_key: string | null
          pix_key_type: string | null
          state: string | null
          street: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          contact_name?: string | null
          cost_center_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          is_active?: boolean | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          state?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          contact_name?: string | null
          cost_center_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          is_active?: boolean | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          organization_id?: string
          phone?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          state?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "payment_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_communication_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          message_content: string
          metadata: Json | null
          organization_id: string | null
          organization_name: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          sale_id: string | null
          source: string
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_content: string
          metadata?: Json | null
          organization_id?: string | null
          organization_name?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sale_id?: string | null
          source: string
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_content?: string
          metadata?: Json | null
          organization_id?: string | null
          organization_name?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          sale_id?: string | null
          source?: string
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_communication_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      tenant_payment_fees: {
        Row: {
          allow_save_card: boolean | null
          boleto_enabled: boolean | null
          boleto_expiration_days: number | null
          boleto_fee_fixed_cents: number | null
          boleto_fee_percentage: number | null
          boleto_release_days: number | null
          card_enabled: boolean | null
          card_fee_fixed_cents: number | null
          card_fee_percentage: number | null
          card_release_days: number | null
          created_at: string | null
          daily_transaction_limit_cents: number | null
          id: string
          installment_fee_passed_to_buyer: boolean | null
          installment_fees: Json | null
          max_installments: number | null
          max_transaction_cents: number | null
          notes: string | null
          organization_id: string
          payment_link_enabled: boolean | null
          pix_enabled: boolean | null
          pix_fee_fixed_cents: number | null
          pix_fee_percentage: number | null
          pix_release_days: number | null
          telesales_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          allow_save_card?: boolean | null
          boleto_enabled?: boolean | null
          boleto_expiration_days?: number | null
          boleto_fee_fixed_cents?: number | null
          boleto_fee_percentage?: number | null
          boleto_release_days?: number | null
          card_enabled?: boolean | null
          card_fee_fixed_cents?: number | null
          card_fee_percentage?: number | null
          card_release_days?: number | null
          created_at?: string | null
          daily_transaction_limit_cents?: number | null
          id?: string
          installment_fee_passed_to_buyer?: boolean | null
          installment_fees?: Json | null
          max_installments?: number | null
          max_transaction_cents?: number | null
          notes?: string | null
          organization_id: string
          payment_link_enabled?: boolean | null
          pix_enabled?: boolean | null
          pix_fee_fixed_cents?: number | null
          pix_fee_percentage?: number | null
          pix_release_days?: number | null
          telesales_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allow_save_card?: boolean | null
          boleto_enabled?: boolean | null
          boleto_expiration_days?: number | null
          boleto_fee_fixed_cents?: number | null
          boleto_fee_percentage?: number | null
          boleto_release_days?: number | null
          card_enabled?: boolean | null
          card_fee_fixed_cents?: number | null
          card_fee_percentage?: number | null
          card_release_days?: number | null
          created_at?: string | null
          daily_transaction_limit_cents?: number | null
          id?: string
          installment_fee_passed_to_buyer?: boolean | null
          installment_fees?: Json | null
          max_installments?: number | null
          max_transaction_cents?: number | null
          notes?: string | null
          organization_id?: string
          payment_link_enabled?: boolean | null
          pix_enabled?: boolean | null
          pix_fee_fixed_cents?: number | null
          pix_fee_percentage?: number | null
          pix_release_days?: number | null
          telesales_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_fees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_storefronts: {
        Row: {
          cart_config: Json | null
          checkout_config: Json | null
          created_at: string
          custom_css: string | null
          facebook_pixel_id: string | null
          favicon_url: string | null
          footer_config: Json | null
          google_analytics_id: string | null
          header_config: Json | null
          id: string
          is_active: boolean | null
          logo_mobile_url: string | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          organization_id: string
          payment_methods_display: string[] | null
          primary_color: string | null
          secondary_color: string | null
          settings: Json | null
          slug: string
          social_links: Json | null
          template_id: string | null
          testimonials_enabled: boolean | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          cart_config?: Json | null
          checkout_config?: Json | null
          created_at?: string
          custom_css?: string | null
          facebook_pixel_id?: string | null
          favicon_url?: string | null
          footer_config?: Json | null
          google_analytics_id?: string | null
          header_config?: Json | null
          id?: string
          is_active?: boolean | null
          logo_mobile_url?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          organization_id: string
          payment_methods_display?: string[] | null
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug: string
          social_links?: Json | null
          template_id?: string | null
          testimonials_enabled?: boolean | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          cart_config?: Json | null
          checkout_config?: Json | null
          created_at?: string
          custom_css?: string | null
          facebook_pixel_id?: string | null
          favicon_url?: string | null
          footer_config?: Json | null
          google_analytics_id?: string | null
          header_config?: Json | null
          id?: string
          is_active?: boolean | null
          logo_mobile_url?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          organization_id?: string
          payment_methods_display?: string[] | null
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug?: string
          social_links?: Json | null
          template_id?: string | null
          testimonials_enabled?: boolean | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_storefronts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_storefronts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "storefront_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_config: {
        Row: {
          created_at: string
          google_ads_customer_id: string | null
          google_conversion_action_id: string | null
          google_developer_token: string | null
          google_enabled: boolean | null
          id: string
          meta_access_token: string | null
          meta_enabled: boolean | null
          meta_pixel_id: string | null
          meta_test_event_code: string | null
          organization_id: string
          tiktok_access_token: string | null
          tiktok_enabled: boolean | null
          tiktok_pixel_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          google_ads_customer_id?: string | null
          google_conversion_action_id?: string | null
          google_developer_token?: string | null
          google_enabled?: boolean | null
          id?: string
          meta_access_token?: string | null
          meta_enabled?: boolean | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          organization_id: string
          tiktok_access_token?: string | null
          tiktok_enabled?: boolean | null
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          google_ads_customer_id?: string | null
          google_conversion_action_id?: string | null
          google_developer_token?: string | null
          google_enabled?: boolean | null
          id?: string
          meta_access_token?: string | null
          meta_enabled?: boolean | null
          meta_pixel_id?: string | null
          meta_test_event_code?: string | null
          organization_id?: string
          tiktok_access_token?: string | null
          tiktok_enabled?: boolean | null
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      traczap_config: {
        Row: {
          auto_track_new_leads: boolean | null
          auto_track_purchases: boolean | null
          auto_track_stage_changes: boolean | null
          created_at: string | null
          default_utm_campaign: string | null
          default_utm_medium: string | null
          default_utm_source: string | null
          id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          auto_track_new_leads?: boolean | null
          auto_track_purchases?: boolean | null
          auto_track_stage_changes?: boolean | null
          created_at?: string | null
          default_utm_campaign?: string | null
          default_utm_medium?: string | null
          default_utm_source?: string | null
          id?: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          auto_track_new_leads?: boolean | null
          auto_track_purchases?: boolean | null
          auto_track_stage_changes?: boolean | null
          created_at?: string | null
          default_utm_campaign?: string | null
          default_utm_medium?: string | null
          default_utm_source?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traczap_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      traczap_link_clicks: {
        Row: {
          clicked_at: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          link_id: string
          organization_id: string
          referrer: string | null
          sale_id: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          link_id: string
          organization_id: string
          referrer?: string | null
          sale_id?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          link_id?: string
          organization_id?: string
          referrer?: string | null
          sale_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traczap_link_clicks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traczap_link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "traczap_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traczap_link_clicks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traczap_link_clicks_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      traczap_links: {
        Row: {
          clicks_count: number | null
          created_at: string | null
          created_by: string | null
          default_message: string | null
          id: string
          is_active: boolean | null
          leads_count: number | null
          name: string
          organization_id: string
          sales_count: number | null
          slug: string
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string
          utm_term: string | null
          whatsapp_number: string
        }
        Insert: {
          clicks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          default_message?: string | null
          id?: string
          is_active?: boolean | null
          leads_count?: number | null
          name: string
          organization_id: string
          sales_count?: number | null
          slug: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string
          utm_term?: string | null
          whatsapp_number: string
        }
        Update: {
          clicks_count?: number | null
          created_at?: string | null
          created_by?: string | null
          default_message?: string | null
          id?: string
          is_active?: boolean | null
          leads_count?: number | null
          name?: string
          organization_id?: string
          sales_count?: number | null
          slug?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string
          utm_term?: string | null
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "traczap_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          bank_account_manage: boolean | null
          cash_verification_confirm: boolean
          cash_verification_view: boolean
          created_at: string
          dashboard_funnel_view: boolean
          dashboard_kanban_view: boolean
          default_landing_page: string | null
          deliveries_view_all: boolean
          deliveries_view_own: boolean
          demands_view: boolean
          expedition_report_view: boolean | null
          expedition_view: boolean
          helper_donna_view: boolean
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
          payment_links_create: boolean | null
          payment_links_view_transactions: boolean | null
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
          sales_uncheck_checkpoint: boolean
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
          team_panel_view: boolean
          team_toggle_manager: boolean
          team_view: boolean
          telesales_charge_card: boolean | null
          updated_at: string
          user_id: string
          whatsapp_ai_settings_view: boolean | null
          whatsapp_manage_view: boolean
          whatsapp_send: boolean
          whatsapp_v2_view: boolean | null
          whatsapp_view: boolean
          withdrawal_request: boolean | null
        }
        Insert: {
          ai_bots_view?: boolean
          bank_account_manage?: boolean | null
          cash_verification_confirm?: boolean
          cash_verification_view?: boolean
          created_at?: string
          dashboard_funnel_view?: boolean
          dashboard_kanban_view?: boolean
          default_landing_page?: string | null
          deliveries_view_all?: boolean
          deliveries_view_own?: boolean
          demands_view?: boolean
          expedition_report_view?: boolean | null
          expedition_view?: boolean
          helper_donna_view?: boolean
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
          payment_links_create?: boolean | null
          payment_links_view_transactions?: boolean | null
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
          sales_uncheck_checkpoint?: boolean
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
          team_panel_view?: boolean
          team_toggle_manager?: boolean
          team_view?: boolean
          telesales_charge_card?: boolean | null
          updated_at?: string
          user_id: string
          whatsapp_ai_settings_view?: boolean | null
          whatsapp_manage_view?: boolean
          whatsapp_send?: boolean
          whatsapp_v2_view?: boolean | null
          whatsapp_view?: boolean
          withdrawal_request?: boolean | null
        }
        Update: {
          ai_bots_view?: boolean
          bank_account_manage?: boolean | null
          cash_verification_confirm?: boolean
          cash_verification_view?: boolean
          created_at?: string
          dashboard_funnel_view?: boolean
          dashboard_kanban_view?: boolean
          default_landing_page?: string | null
          deliveries_view_all?: boolean
          deliveries_view_own?: boolean
          demands_view?: boolean
          expedition_report_view?: boolean | null
          expedition_view?: boolean
          helper_donna_view?: boolean
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
          payment_links_create?: boolean | null
          payment_links_view_transactions?: boolean | null
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
          sales_uncheck_checkpoint?: boolean
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
          team_panel_view?: boolean
          team_toggle_manager?: boolean
          team_view?: boolean
          telesales_charge_card?: boolean | null
          updated_at?: string
          user_id?: string
          whatsapp_ai_settings_view?: boolean | null
          whatsapp_manage_view?: boolean
          whatsapp_send?: boolean
          whatsapp_v2_view?: boolean | null
          whatsapp_view?: boolean
          withdrawal_request?: boolean | null
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
      virtual_account_bank_data: {
        Row: {
          account_number: string
          account_type: string
          agency: string
          bank_code: string
          bank_name: string
          created_at: string
          holder_document: string
          holder_name: string
          id: string
          is_primary: boolean | null
          pix_key: string | null
          pix_key_type: string | null
          virtual_account_id: string
        }
        Insert: {
          account_number: string
          account_type: string
          agency: string
          bank_code: string
          bank_name: string
          created_at?: string
          holder_document: string
          holder_name: string
          id?: string
          is_primary?: boolean | null
          pix_key?: string | null
          pix_key_type?: string | null
          virtual_account_id: string
        }
        Update: {
          account_number?: string
          account_type?: string
          agency?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          holder_document?: string
          holder_name?: string
          id?: string
          is_primary?: boolean | null
          pix_key?: string | null
          pix_key_type?: string | null
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_account_bank_data_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_accounts: {
        Row: {
          account_type: string
          balance_cents: number | null
          created_at: string
          holder_document: string | null
          holder_email: string
          holder_name: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          pending_balance_cents: number | null
          total_received_cents: number | null
          total_withdrawn_cents: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_type: string
          balance_cents?: number | null
          created_at?: string
          holder_document?: string | null
          holder_email: string
          holder_name: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          pending_balance_cents?: number | null
          total_received_cents?: number | null
          total_withdrawn_cents?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_type?: string
          balance_cents?: number | null
          created_at?: string
          holder_document?: string | null
          holder_email?: string
          holder_name?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          pending_balance_cents?: number | null
          total_received_cents?: number | null
          total_withdrawn_cents?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "virtual_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          fee_cents: number | null
          id: string
          net_amount_cents: number
          reference_id: string | null
          release_at: string | null
          released_at: string | null
          sale_id: string | null
          status: string | null
          transaction_type: string
          virtual_account_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          fee_cents?: number | null
          id?: string
          net_amount_cents: number
          reference_id?: string | null
          release_at?: string | null
          released_at?: string | null
          sale_id?: string | null
          status?: string | null
          transaction_type: string
          virtual_account_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          fee_cents?: number | null
          id?: string
          net_amount_cents?: number
          reference_id?: string | null
          release_at?: string | null
          released_at?: string | null
          sale_id?: string | null
          status?: string | null
          transaction_type?: string
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_transactions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_transactions_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      voip_3c_config: {
        Row: {
          blacklist_numbers: string[]
          cnpj_numbers: string[]
          created_at: string
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          blacklist_numbers?: string[]
          cnpj_numbers?: string[]
          created_at?: string
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          blacklist_numbers?: string[]
          cnpj_numbers?: string[]
          created_at?: string
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voip_3c_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      voip_3c_validations: {
        Row: {
          calls_with_record_no_sale: number
          calls_without_record: number
          created_at: string
          file_name: string
          id: string
          organization_id: string
          total_calls: number
          uploaded_by: string
          validation_data: Json
        }
        Insert: {
          calls_with_record_no_sale?: number
          calls_without_record?: number
          created_at?: string
          file_name: string
          id?: string
          organization_id: string
          total_calls?: number
          uploaded_by: string
          validation_data?: Json
        }
        Update: {
          calls_with_record_no_sale?: number
          calls_without_record?: number
          created_at?: string
          file_name?: string
          id?: string
          organization_id?: string
          total_calls?: number
          uploaded_by?: string
          validation_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "voip_3c_validations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          current_bot_id: string | null
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
          skip_nps_at: string | null
          skip_nps_by: string | null
          skip_nps_reason: string | null
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
          current_bot_id?: string | null
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
          skip_nps_at?: string | null
          skip_nps_by?: string | null
          skip_nps_reason?: string | null
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
          current_bot_id?: string | null
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
          skip_nps_at?: string | null
          skip_nps_by?: string | null
          skip_nps_reason?: string | null
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
            foreignKeyName: "whatsapp_conversations_current_bot_id_fkey"
            columns: ["current_bot_id"]
            isOneToOne: false
            referencedRelation: "ai_bots"
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
          {
            foreignKeyName: "whatsapp_conversations_skip_nps_by_fkey"
            columns: ["skip_nps_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
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
          bot_team_id: string | null
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
          keyword_router_id: string | null
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
          bot_team_id?: string | null
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
          keyword_router_id?: string | null
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
          bot_team_id?: string | null
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
          keyword_router_id?: string | null
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
            foreignKeyName: "whatsapp_instances_bot_team_id_fkey"
            columns: ["bot_team_id"]
            isOneToOne: false
            referencedRelation: "bot_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_keyword_router_id_fkey"
            columns: ["keyword_router_id"]
            isOneToOne: false
            referencedRelation: "keyword_bot_routers"
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
      white_label_configs: {
        Row: {
          brand_name: string
          created_at: string | null
          custom_domain: string | null
          email_from_name: string | null
          email_logo_url: string | null
          favicon_url: string | null
          id: string
          implementer_id: string
          is_active: boolean | null
          logo_url: string | null
          primary_color: string | null
          sales_page_slug: string | null
          secondary_color: string | null
          support_email: string | null
          support_whatsapp: string | null
          updated_at: string | null
        }
        Insert: {
          brand_name: string
          created_at?: string | null
          custom_domain?: string | null
          email_from_name?: string | null
          email_logo_url?: string | null
          favicon_url?: string | null
          id?: string
          implementer_id: string
          is_active?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          sales_page_slug?: string | null
          secondary_color?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_name?: string
          created_at?: string | null
          custom_domain?: string | null
          email_from_name?: string | null
          email_logo_url?: string | null
          favicon_url?: string | null
          id?: string
          implementer_id?: string
          is_active?: boolean | null
          logo_url?: string | null
          primary_color?: string | null
          sales_page_slug?: string | null
          secondary_color?: string | null
          support_email?: string | null
          support_whatsapp?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "white_label_configs_implementer_id_fkey"
            columns: ["implementer_id"]
            isOneToOne: true
            referencedRelation: "implementers"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount_cents: number
          bank_data: Json
          completed_at: string | null
          created_at: string
          fee_cents: number | null
          id: string
          net_amount_cents: number
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          transfer_proof_url: string | null
          virtual_account_id: string
        }
        Insert: {
          amount_cents: number
          bank_data: Json
          completed_at?: string | null
          created_at?: string
          fee_cents?: number | null
          id?: string
          net_amount_cents: number
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          transfer_proof_url?: string | null
          virtual_account_id: string
        }
        Update: {
          amount_cents?: number
          bank_data?: Json
          completed_at?: string | null
          created_at?: string
          fee_cents?: number | null
          id?: string
          net_amount_cents?: number
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          transfer_proof_url?: string | null
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
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
      accept_partner_invitation: {
        Args: { p_invite_code: string; p_user_id: string }
        Returns: Json
      }
      add_bonus_energy: {
        Args: { amount: number; org_id: string }
        Returns: undefined
      }
      approve_partner_application: {
        Args: { p_application_id: string; p_reviewer_id: string }
        Returns: Json
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
      calculate_weighted_average_cost: {
        Args: {
          p_current_avg_cost: number
          p_current_quantity: number
          p_new_cost: number
          p_new_quantity: number
          p_product_id: string
        }
        Returns: number
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
          p_details: Json
          p_energy_amount: number
          p_model_used?: string
          p_organization_id: string
          p_real_cost_usd?: number
          p_tokens_used: number
        }
        Returns: Json
      }
      current_tenant_id: { Args: never; Returns: string }
      debit_organization_energy: {
        Args: { amount: number; description?: string; org_id: string }
        Returns: undefined
      }
      deduct_stock_for_delivered_sale: {
        Args: { _sale_id: string }
        Returns: undefined
      }
      enqueue_onboarding_emails: {
        Args: {
          _email: string
          _name?: string
          _organization_id: string
          _user_id: string
        }
        Returns: number
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
      generate_bot_system_prompt:
        | {
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
        | {
            Args: {
              p_age_range: string
              p_company_differential: string
              p_company_name?: string
              p_gender: string
              p_personality_description: string
              p_regional_expressions: string[]
              p_response_length: string
              p_service_type: string
              p_state: string
            }
            Returns: string
          }
      generate_implementer_code: { Args: never; Returns: string }
      generate_payment_link_slug: { Args: never; Returns: string }
      get_active_agent_for_instance: {
        Args: {
          p_current_day?: number
          p_current_time?: string
          p_instance_id: string
        }
        Returns: Json
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
      get_any_agent_for_instance: {
        Args: { p_instance_id: string }
        Returns: Json
      }
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
      get_fiscal_company_credentials: {
        Args: { p_company_id: string }
        Returns: {
          certificate_file_path: string
          certificate_password: string
          cnpj: string
          focus_nfe_token_homologacao: string
          focus_nfe_token_producao: string
          id: string
          nfe_environment: string
          nfse_environment: string
        }[]
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
          lead_email: string
          lead_funnel_stage_id: string
          lead_id: string
          lead_instagram: string
          lead_name: string
          lead_stage: string
          lead_stars: number
          lead_whatsapp: string
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
      get_partner_public_link: { Args: { p_slug: string }; Returns: Json }
      get_partner_role: { Args: { p_partner_type: string }; Returns: string }
      get_payment_reminder_logs: {
        Args: never
        Returns: {
          created_at: string
          id: string
          organization_id: string
          reminder_type: string
          sent_at: string
          sent_to: string
        }[]
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
      get_unmatched_pos_transactions_for_user: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: {
          amount_cents: number
          authorization_code: string
          card_brand: string
          card_last_digits: string
          created_at: string
          gateway_timestamp: string
          gateway_type: Database["public"]["Enums"]["pos_gateway_type"]
          id: string
          nsu: string
          terminal_name: string
          transaction_type: string
        }[]
      }
      get_user_affiliate_info: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: {
          affiliate_code: string
          affiliate_id: string
          is_active: boolean
        }[]
      }
      get_user_org_ids: { Args: never; Returns: string[] }
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
      get_user_virtual_account_ids: { Args: never; Returns: string[] }
      grant_user_instance_access: {
        Args: {
          _can_send?: boolean
          _can_view?: boolean
          _instance_id: string
          _user_id: string
        }
        Returns: undefined
      }
      has_admin_role: { Args: { user_id: string }; Returns: boolean }
      has_onboarding_completed: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      implementer_has_active_subscription: {
        Args: { p_implementer_id: string }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { coupon_id: string }
        Returns: undefined
      }
      increment_implementer_totals: {
        Args: {
          p_clients_count?: number
          p_earnings_cents: number
          p_implementer_id: string
        }
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
      is_current_user_org_owner: { Args: never; Returns: boolean }
      is_full_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_helper_master_admin: { Args: never; Returns: boolean }
      is_implementer: { Args: { p_user_id: string }; Returns: boolean }
      is_master_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin_or_manager: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin_or_owner: { Args: { org_id: string }; Returns: boolean }
      is_partner: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_real_team_member: {
        Args: { p_org_id: string; p_user_id: string }
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
      join_affiliate_network: {
        Args: { p_email: string; p_invite_code: string; p_name: string }
        Returns: Json
      }
      link_conversation_to_contact: {
        Args: { _contact_id: string; _conversation_id: string }
        Returns: undefined
      }
      link_pos_transaction_to_sale: {
        Args: { p_sale_id: string; p_transaction_id: string; p_user_id: string }
        Returns: boolean
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
      match_transaction_to_sale: {
        Args: { p_sale_id: string; p_transaction_id: string; p_user_id: string }
        Returns: Json
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
      process_implementer_commission: {
        Args: {
          p_is_first_payment: boolean
          p_payment_amount_cents: number
          p_subscription_id: string
        }
        Returns: undefined
      }
      process_purchase_invoice_stock: {
        Args: { p_invoice_id: string; p_user_id: string }
        Returns: Json
      }
      reopen_whatsapp_conversation: {
        Args: { p_conversation_id: string; p_instance_id: string }
        Returns: Json
      }
      reorder_funnel_stages: { Args: { p_stages: Json }; Returns: boolean }
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
      user_has_team_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      user_is_affiliate_for_cart: {
        Args: { _cart_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_affiliate_for_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_affiliate_for_sale: {
        Args: { _sale_id: string; _user_id: string }
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
      delivery_payment_type: "cash" | "prepaid" | "pos_card"
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
        | "partner_affiliate"
        | "partner_coproducer"
        | "partner_industry"
        | "partner_factory"
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
      pos_gateway_type:
        | "getnet"
        | "pagarme"
        | "banrisul"
        | "vero"
        | "banricompras"
        | "stone"
      pos_match_status: "pending" | "matched" | "orphan" | "manual"
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
        | "closed"
        | "finalized"
        | "ecommerce_pending"
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
      delivery_payment_type: ["cash", "prepaid", "pos_card"],
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
        "partner_affiliate",
        "partner_coproducer",
        "partner_industry",
        "partner_factory",
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
      pos_gateway_type: [
        "getnet",
        "pagarme",
        "banrisul",
        "vero",
        "banricompras",
        "stone",
      ],
      pos_match_status: ["pending", "matched", "orphan", "manual"],
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
        "closed",
        "finalized",
        "ecommerce_pending",
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

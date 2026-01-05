CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: card_brand; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.card_brand AS ENUM (
    'visa',
    'master',
    'elo',
    'amex',
    'banricompras'
);


--
-- Name: card_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.card_transaction_type AS ENUM (
    'debit',
    'credit_cash',
    'credit_installment',
    'credit_predate',
    'pix'
);


--
-- Name: carrier_tracking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.carrier_tracking_status AS ENUM (
    'waiting_post',
    'posted',
    'in_destination_city',
    'attempt_1_failed',
    'attempt_2_failed',
    'attempt_3_failed',
    'waiting_pickup',
    'returning_to_sender',
    'delivered'
);


--
-- Name: delivery_shift; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_shift AS ENUM (
    'morning',
    'afternoon',
    'full_day'
);


--
-- Name: delivery_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_status AS ENUM (
    'pending',
    'delivered_normal',
    'delivered_missing_prescription',
    'delivered_no_money',
    'delivered_no_card_limit',
    'delivered_customer_absent',
    'delivered_customer_denied',
    'delivered_customer_gave_up',
    'delivered_wrong_product',
    'delivered_missing_product',
    'delivered_insufficient_address',
    'delivered_wrong_time',
    'delivered_other'
);


--
-- Name: delivery_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_type AS ENUM (
    'pickup',
    'motoboy',
    'carrier'
);


--
-- Name: funnel_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.funnel_stage AS ENUM (
    'prospect',
    'contacted',
    'convincing',
    'scheduled',
    'positive',
    'waiting_payment',
    'success',
    'trash',
    'cloud'
);


--
-- Name: installment_flow; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.installment_flow AS ENUM (
    'anticipation',
    'receive_per_installment'
);


--
-- Name: org_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_role AS ENUM (
    'owner',
    'admin',
    'member',
    'manager',
    'seller',
    'shipping',
    'finance',
    'entregador',
    'delivery'
);


--
-- Name: payment_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_category AS ENUM (
    'cash',
    'pix',
    'card_machine',
    'payment_link',
    'ecommerce',
    'boleto_prepaid',
    'boleto_postpaid',
    'boleto_installment',
    'gift'
);


--
-- Name: post_sale_contact_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.post_sale_contact_status AS ENUM (
    'pending',
    'attempted_1',
    'attempted_2',
    'attempted_3',
    'sent_whatsapp',
    'callback_later',
    'completed_call',
    'completed_whatsapp',
    'refused',
    'not_needed'
);


--
-- Name: sac_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sac_category AS ENUM (
    'complaint',
    'question',
    'request',
    'financial'
);


--
-- Name: sac_ticket_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sac_ticket_priority AS ENUM (
    'low',
    'normal',
    'high'
);


--
-- Name: sac_ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sac_ticket_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);


--
-- Name: sale_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sale_status AS ENUM (
    'draft',
    'pending_expedition',
    'dispatched',
    'delivered',
    'payment_pending',
    'payment_confirmed',
    'cancelled',
    'returned'
);


--
-- Name: standard_question_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.standard_question_category AS ENUM (
    'dores_articulares',
    'emagrecimento',
    'diabetes',
    'saude_geral'
);


--
-- Name: standard_question_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.standard_question_type AS ENUM (
    'single_choice',
    'multiple_choice',
    'number',
    'imc_calculator'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'canceled',
    'past_due',
    'trialing',
    'unpaid'
);


--
-- Name: backfill_contacts_from_existing_conversations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backfill_contacts_from_existing_conversations(_organization_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  updated_count integer := 0;
  conv record;
  phone_to_use text;
  contact_id_result uuid;
  name_to_use text;
BEGIN
  -- Iterar em conversas sem contact_id
  FOR conv IN
    SELECT 
      c.id,
      c.phone_number,
      c.sendable_phone,
      c.contact_name,
      l.whatsapp AS lead_whatsapp,
      l.name AS lead_name
    FROM whatsapp_conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.organization_id = _organization_id
      AND c.contact_id IS NULL
  LOOP
    -- Determinar melhor telefone para usar
    phone_to_use := COALESCE(
      conv.sendable_phone,
      conv.phone_number,
      conv.lead_whatsapp
    );
    
    -- Determinar nome
    name_to_use := COALESCE(conv.contact_name, conv.lead_name);
    
    -- Se temos telefone, criar/resolver contato
    IF phone_to_use IS NOT NULL AND phone_to_use != '' THEN
      BEGIN
        contact_id_result := get_or_create_contact_by_phone(
          _organization_id,
          phone_to_use,
          name_to_use
        );
        
        -- Atualizar conversa
        UPDATE whatsapp_conversations
        SET 
          contact_id = contact_id_result,
          customer_phone_e164 = normalize_phone_e164(phone_to_use),
          updated_at = now()
        WHERE id = conv.id;
        
        -- Atualizar mensagens
        UPDATE whatsapp_messages
        SET contact_id = contact_id_result
        WHERE conversation_id = conv.id;
        
        updated_count := updated_count + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Log erro mas continua
        RAISE NOTICE 'Erro ao processar conversa %: %', conv.id, SQLERRM;
      END;
    END IF;
  END LOOP;
  
  RETURN updated_count;
END;
$$;


--
-- Name: create_default_user_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_user_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  default_perms jsonb;
BEGIN
  default_perms := get_default_permissions_for_role(NEW.role::text);
  
  INSERT INTO public.user_permissions (
    organization_id, user_id,
    leads_view, leads_create, leads_edit, leads_delete,
    sales_view, sales_view_all, sales_create, sales_edit_draft, sales_confirm_payment, 
    sales_validate_expedition, sales_dispatch, sales_mark_delivered, sales_cancel,
    whatsapp_view, whatsapp_send,
    products_view, products_manage, products_view_cost,
    settings_view, settings_manage,
    reports_view,
    deliveries_view_own, deliveries_view_all,
    post_sale_view, post_sale_manage,
    sac_view, sac_manage
  ) VALUES (
    NEW.organization_id, NEW.user_id,
    (default_perms->>'leads_view')::boolean, (default_perms->>'leads_create')::boolean, 
    (default_perms->>'leads_edit')::boolean, (default_perms->>'leads_delete')::boolean,
    (default_perms->>'sales_view')::boolean, (default_perms->>'sales_view_all')::boolean,
    (default_perms->>'sales_create')::boolean, (default_perms->>'sales_edit_draft')::boolean, 
    (default_perms->>'sales_confirm_payment')::boolean, 
    (default_perms->>'sales_validate_expedition')::boolean, (default_perms->>'sales_dispatch')::boolean, 
    (default_perms->>'sales_mark_delivered')::boolean, (default_perms->>'sales_cancel')::boolean,
    (default_perms->>'whatsapp_view')::boolean, (default_perms->>'whatsapp_send')::boolean,
    (default_perms->>'products_view')::boolean, (default_perms->>'products_manage')::boolean,
    (default_perms->>'products_view_cost')::boolean,
    (default_perms->>'settings_view')::boolean, (default_perms->>'settings_manage')::boolean,
    (default_perms->>'reports_view')::boolean,
    (default_perms->>'deliveries_view_own')::boolean, (default_perms->>'deliveries_view_all')::boolean,
    COALESCE((default_perms->>'post_sale_view')::boolean, false),
    COALESCE((default_perms->>'post_sale_manage')::boolean, false),
    COALESCE((default_perms->>'sac_view')::boolean, false),
    COALESCE((default_perms->>'sac_manage')::boolean, false)
  )
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT get_user_organization_id()
$$;


--
-- Name: deduct_stock_for_delivered_sale(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_stock_for_delivered_sale(_sale_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item RECORD;
  current_stock integer;
  new_stock integer;
  org_id uuid;
  user_id uuid;
BEGIN
  -- Get organization
  SELECT organization_id INTO org_id
  FROM sales WHERE id = _sale_id;
  
  user_id := auth.uid();
  
  -- Loop through sale items
  FOR item IN
    SELECT si.product_id, si.quantity
    FROM sale_items si
    WHERE si.sale_id = _sale_id
  LOOP
    -- Get current stock info
    SELECT lp.stock_quantity
    INTO current_stock
    FROM lead_products lp
    WHERE lp.id = item.product_id AND lp.track_stock = true;
    
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    new_stock := GREATEST(0, current_stock - item.quantity);
    
    -- Deduct from real stock AND remove from reserved
    UPDATE lead_products
    SET 
      stock_quantity = new_stock,
      stock_reserved = GREATEST(0, COALESCE(stock_reserved, 0) - item.quantity)
    WHERE id = item.product_id;
    
    -- Log the movement
    INSERT INTO stock_movements (
      organization_id, product_id, movement_type, quantity,
      previous_quantity, new_quantity, reference_id, reference_type,
      notes, created_by
    ) VALUES (
      org_id, item.product_id, 'sale', item.quantity,
      current_stock, new_stock, _sale_id, 'sale_delivered',
      'Baixa por entrega confirmada', user_id
    );
  END LOOP;
END;
$$;


--
-- Name: find_contact_by_phone(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_contact_by_phone(_organization_id uuid, _phone text) RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  normalized_phone text;
  contact_id_result uuid;
BEGIN
  normalized_phone := normalize_phone_e164(_phone);
  
  IF normalized_phone IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT ci.contact_id INTO contact_id_result
  FROM contact_identities ci
  WHERE ci.organization_id = _organization_id
    AND ci.type = 'phone'
    AND ci.value_normalized = normalized_phone
  LIMIT 1;
  
  RETURN contact_id_result;
END;
$$;


--
-- Name: get_default_permissions_for_role(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_default_permissions_for_role(_role text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  CASE _role
    WHEN 'owner' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', true,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', true, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', true,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true,
        'post_sale_view', true, 'post_sale_manage', true,
        'sac_view', true, 'sac_manage', true
      );
    WHEN 'admin' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', true,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', true,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', true,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', true, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', true,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true,
        'post_sale_view', true, 'post_sale_manage', true,
        'sac_view', true, 'sac_manage', true
      );
    WHEN 'manager' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', true, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', false, 'products_view_cost', true,
        'settings_view', true, 'settings_manage', false,
        'reports_view', true,
        'deliveries_view_own', true, 'deliveries_view_all', true,
        'receptive_module_access', true,
        'team_view', true, 'instagram_view', true,
        'post_sale_view', true, 'post_sale_manage', true,
        'sac_view', true, 'sac_manage', true
      );
    WHEN 'seller' THEN
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', false, 'sales_create', true, 'sales_edit_draft', true, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', true,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', true,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', true, 'sac_manage', false
      );
    WHEN 'shipping' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', true, 'sales_dispatch', true, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', true,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false
      );
    WHEN 'finance' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', true, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', true,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', false, 'products_manage', false, 'products_view_cost', true,
        'settings_view', false, 'settings_manage', false,
        'reports_view', true,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', true, 'post_sale_manage', false,
        'sac_view', true, 'sac_manage', false
      );
    WHEN 'entregador' THEN
      RETURN jsonb_build_object(
        'leads_view', false, 'leads_create', false, 'leads_edit', false, 'leads_delete', false,
        'sales_view', false, 'sales_view_all', false, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', true, 'sales_cancel', false,
        'whatsapp_view', false, 'whatsapp_send', false,
        'products_view', false, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', true, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false
      );
    ELSE -- member
      RETURN jsonb_build_object(
        'leads_view', true, 'leads_create', true, 'leads_edit', true, 'leads_delete', false,
        'sales_view', true, 'sales_view_all', false, 'sales_create', false, 'sales_edit_draft', false, 'sales_confirm_payment', false,
        'sales_validate_expedition', false, 'sales_dispatch', false, 'sales_mark_delivered', false, 'sales_cancel', false,
        'whatsapp_view', true, 'whatsapp_send', false,
        'products_view', true, 'products_manage', false, 'products_view_cost', false,
        'settings_view', false, 'settings_manage', false,
        'reports_view', false,
        'deliveries_view_own', false, 'deliveries_view_all', false,
        'receptive_module_access', false,
        'team_view', false, 'instagram_view', false,
        'post_sale_view', false, 'post_sale_manage', false,
        'sac_view', false, 'sac_manage', false
      );
  END CASE;
END;
$$;


--
-- Name: get_or_create_contact_by_phone(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_contact_by_phone(_organization_id uuid, _phone text, _name text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  normalized_phone text;
  existing_contact_id uuid;
  new_contact_id uuid;
BEGIN
  -- Normalizar telefone
  normalized_phone := normalize_phone_e164(_phone);
  
  IF normalized_phone IS NULL THEN
    RAISE EXCEPTION 'Telefone inválido: %', _phone;
  END IF;
  
  -- Procurar identidade existente
  SELECT ci.contact_id INTO existing_contact_id
  FROM contact_identities ci
  WHERE ci.organization_id = _organization_id
    AND ci.type = 'phone'
    AND ci.value_normalized = normalized_phone
  LIMIT 1;
  
  -- Se encontrou, atualizar last_activity e retornar
  IF existing_contact_id IS NOT NULL THEN
    UPDATE contacts 
    SET last_activity_at = now(), updated_at = now()
    WHERE id = existing_contact_id;
    
    -- Atualizar nome se não tinha e agora tem
    IF _name IS NOT NULL THEN
      UPDATE contacts 
      SET full_name = COALESCE(full_name, _name)
      WHERE id = existing_contact_id AND full_name IS NULL;
    END IF;
    
    RETURN existing_contact_id;
  END IF;
  
  -- Criar novo contato
  INSERT INTO contacts (organization_id, full_name, last_activity_at)
  VALUES (_organization_id, _name, now())
  RETURNING id INTO new_contact_id;
  
  -- Criar identidade de telefone
  INSERT INTO contact_identities (organization_id, contact_id, type, value, value_normalized, is_primary)
  VALUES (_organization_id, new_contact_id, 'phone', _phone, normalized_phone, true);
  
  RETURN new_contact_id;
END;
$$;


--
-- Name: get_tenant_channels(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tenant_channels(_tenant_id uuid DEFAULT public.current_tenant_id()) RETURNS TABLE(channel_id uuid, channel_name text, provider text, phone_e164 text, status text, is_connected boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    id AS channel_id,
    name AS channel_name,
    provider,
    phone_e164,
    status,
    is_connected
  FROM public.channels
  WHERE tenant_id = _tenant_id
  ORDER BY created_at ASC
$$;


--
-- Name: get_tenant_role(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tenant_role(_user_id uuid, _tenant_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role::text
  FROM public.organization_members
  WHERE user_id = _user_id
  AND organization_id = _tenant_id
  LIMIT 1
$$;


--
-- Name: get_tenant_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tenant_stats(_tenant_id uuid DEFAULT public.current_tenant_id()) RETURNS TABLE(total_channels bigint, connected_channels bigint, total_conversations bigint, unread_conversations bigint, total_leads bigint, total_members bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    (SELECT COUNT(*) FROM public.whatsapp_instances WHERE organization_id = _tenant_id) AS total_channels,
    (SELECT COUNT(*) FROM public.whatsapp_instances WHERE organization_id = _tenant_id AND is_connected = true) AS connected_channels,
    (SELECT COUNT(*) FROM public.whatsapp_conversations WHERE organization_id = _tenant_id) AS total_conversations,
    (SELECT COUNT(*) FROM public.whatsapp_conversations WHERE organization_id = _tenant_id AND unread_count > 0) AS unread_conversations,
    (SELECT COUNT(*) FROM public.leads WHERE organization_id = _tenant_id) AS total_leads,
    (SELECT COUNT(*) FROM public.organization_members WHERE organization_id = _tenant_id) AS total_members
$$;


--
-- Name: get_user_organization_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_organization_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  org_id uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.organization_members 
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN org_id;
END;
$$;


--
-- Name: get_user_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;


--
-- Name: get_user_tenants(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_tenants(_user_id uuid DEFAULT auth.uid()) RETURNS TABLE(tenant_id uuid, tenant_name text, tenant_slug text, user_role text, joined_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    o.id AS tenant_id,
    o.name AS tenant_name,
    o.slug AS tenant_slug,
    om.role::text AS user_role,
    om.created_at AS joined_at
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = _user_id
  ORDER BY om.created_at ASC
$$;


--
-- Name: grant_user_instance_access(uuid, uuid, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_user_instance_access(_instance_id uuid, _user_id uuid, _can_view boolean DEFAULT true, _can_send boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.whatsapp_instance_users (instance_id, user_id, can_view, can_send)
  VALUES (_instance_id, _user_id, _can_view, _can_send)
  ON CONFLICT (instance_id, user_id) DO UPDATE
    SET can_view = EXCLUDED.can_view,
        can_send = EXCLUDED.can_send;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert profile with placeholder data (will be updated on first login)
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (NEW.id, 'Usuário', 'Novo')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- If master admin email, assign admin role
  IF NEW.email = 'thiago.morphews@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Assign user role for everyone else
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_onboarding_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_onboarding_completed() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_data od
    WHERE od.organization_id = public.get_user_organization_id()
      AND od.completed_at IS NOT NULL
  );
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: increment_coupon_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_coupon_usage(coupon_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE discount_coupons
  SET current_uses = current_uses + 1
  WHERE id = coupon_id;
END;
$$;


--
-- Name: initialize_org_funnel_stages(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_org_funnel_stages(org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO organization_funnel_stages (organization_id, name, position, color, text_color, stage_type, is_default)
  VALUES
    (org_id, 'Não classificado', 0, 'bg-slate-200', 'text-slate-700', 'cloud', true),
    (org_id, 'Prospectando / Aguardando resposta', 1, 'bg-orange-200', 'text-orange-900', 'funnel', true),
    (org_id, 'Cliente nos chamou', 2, 'bg-orange-400', 'text-white', 'funnel', true),
    (org_id, 'Convencendo a marcar call', 3, 'bg-yellow-300', 'text-yellow-900', 'funnel', true),
    (org_id, 'Call agendada', 4, 'bg-sky-300', 'text-sky-900', 'funnel', true),
    (org_id, 'Call feita positiva', 5, 'bg-green-300', 'text-green-900', 'funnel', true),
    (org_id, 'Aguardando pagamento', 6, 'bg-green-500', 'text-white', 'funnel', true),
    (org_id, 'PAGO - SUCESSO!', 7, 'bg-amber-400', 'text-amber-900', 'funnel', true),
    (org_id, 'Sem interesse', 8, 'bg-red-200', 'text-red-800', 'trash', true);
END;
$$;


--
-- Name: initialize_org_role_permissions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_org_role_permissions(org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  roles org_role[] := ARRAY['owner', 'manager', 'admin', 'member', 'seller', 'shipping', 'finance']::org_role[];
  resources text[] := ARRAY['leads', 'products', 'sales', 'team', 'reports', 'settings', 'whatsapp', 'finance'];
  r org_role;
  res text;
BEGIN
  FOREACH r IN ARRAY roles LOOP
    FOREACH res IN ARRAY resources LOOP
      INSERT INTO role_permissions (organization_id, role, resource, can_view, can_create, can_edit, can_delete)
      VALUES (
        org_id,
        r,
        res,
        -- Default permissions based on role
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN true
          WHEN r = 'admin' THEN true
          WHEN r = 'seller' AND res IN ('leads', 'products', 'whatsapp') THEN true
          WHEN r = 'shipping' AND res IN ('leads', 'sales') THEN true
          WHEN r = 'finance' AND res IN ('leads', 'sales', 'finance', 'reports') THEN true
          WHEN r = 'member' AND res IN ('leads', 'products') THEN true
          ELSE false
        END,
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN true
          WHEN r = 'admin' THEN res NOT IN ('settings')
          WHEN r = 'seller' AND res = 'leads' THEN true
          ELSE false
        END,
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN true
          WHEN r = 'admin' THEN res NOT IN ('settings', 'team')
          WHEN r = 'seller' AND res = 'leads' THEN true
          ELSE false
        END,
        CASE 
          WHEN r = 'owner' THEN true
          WHEN r = 'manager' THEN res NOT IN ('settings', 'team')
          WHEN r = 'admin' THEN res NOT IN ('settings', 'team')
          ELSE false
        END
      )
      ON CONFLICT (organization_id, role, resource) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;


--
-- Name: is_current_user_org_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_current_user_org_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  org_id uuid;
begin
  org_id := public.get_user_organization_id();

  if org_id is null then
    return false;
  end if;

  return public.is_org_admin(auth.uid(), org_id);
end;
$$;


--
-- Name: is_master_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_master_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND email = 'thiago.morphews@gmail.com'
  )
$$;


--
-- Name: is_org_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
    AND role IN ('owner', 'admin')
  )
$$;


--
-- Name: is_tenant_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _tenant_id
    AND role IN ('owner', 'admin')
  )
$$;


--
-- Name: is_tenant_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _tenant_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;


--
-- Name: link_conversation_to_contact(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_conversation_to_contact(_conversation_id uuid, _contact_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  conv_org_id uuid;
  contact_org_id uuid;
BEGIN
  -- Buscar organization_id da conversa
  SELECT organization_id INTO conv_org_id
  FROM whatsapp_conversations
  WHERE id = _conversation_id;
  
  IF conv_org_id IS NULL THEN
    RAISE EXCEPTION 'Conversa não encontrada: %', _conversation_id;
  END IF;
  
  -- Buscar organization_id do contato
  SELECT organization_id INTO contact_org_id
  FROM contacts
  WHERE id = _contact_id;
  
  IF contact_org_id IS NULL THEN
    RAISE EXCEPTION 'Contato não encontrado: %', _contact_id;
  END IF;
  
  -- Validar que pertencem ao mesmo tenant
  IF conv_org_id != contact_org_id THEN
    RAISE EXCEPTION 'Conversa e contato pertencem a organizações diferentes';
  END IF;
  
  -- Atualizar conversa
  UPDATE whatsapp_conversations
  SET contact_id = _contact_id, updated_at = now()
  WHERE id = _conversation_id;
  
  -- Atualizar mensagens da conversa
  UPDATE whatsapp_messages
  SET contact_id = _contact_id
  WHERE conversation_id = _conversation_id;
  
  -- Atualizar last_activity do contato
  UPDATE contacts
  SET last_activity_at = now(), updated_at = now()
  WHERE id = _contact_id;
END;
$$;


--
-- Name: normalize_cnpj(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_cnpj(input text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT regexp_replace(input, '[^0-9]', '', 'g');
$$;


--
-- Name: normalize_phone_e164(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_phone_e164(phone text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  clean text;
BEGIN
  -- Remove tudo que não é dígito
  clean := regexp_replace(phone, '[^0-9]', '', 'g');
  
  -- Se vazio, retorna null
  IF clean = '' OR clean IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Adiciona código do Brasil se parecer número brasileiro (até 11 dígitos sem código)
  IF length(clean) <= 11 AND NOT clean LIKE '55%' THEN
    clean := '55' || clean;
  END IF;
  
  RETURN clean;
END;
$$;


--
-- Name: normalize_text_for_comparison(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_text_for_comparison(input text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT upper(regexp_replace(
    translate(input, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
    '[^a-zA-Z0-9]', '', 'g'
  ));
$$;


--
-- Name: on_org_member_added(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_org_member_added() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id AS instance_id
    FROM public.whatsapp_instances
    WHERE organization_id = NEW.organization_id
  LOOP
    PERFORM public.grant_user_instance_access(r.instance_id, NEW.user_id, true, true);
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: on_whatsapp_instance_created(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_whatsapp_instance_created() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT user_id
    FROM public.organization_members
    WHERE organization_id = NEW.organization_id
  LOOP
    PERFORM public.grant_user_instance_access(NEW.id, r.user_id, true, true);
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: reserve_stock_for_sale(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_stock_for_sale(_sale_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item RECORD;
  current_stock integer;
  current_reserved integer;
  org_id uuid;
  user_id uuid;
BEGIN
  -- Get organization and user
  SELECT organization_id, created_by INTO org_id, user_id
  FROM sales WHERE id = _sale_id;
  
  -- Loop through sale items
  FOR item IN
    SELECT si.product_id, si.quantity, si.product_name
    FROM sale_items si
    WHERE si.sale_id = _sale_id
  LOOP
    -- Get current stock info
    SELECT lp.stock_quantity, lp.stock_reserved, lp.track_stock
    INTO current_stock, current_reserved
    FROM lead_products lp
    WHERE lp.id = item.product_id;
    
    -- Skip if track_stock is false
    IF NOT FOUND OR NOT (SELECT track_stock FROM lead_products WHERE id = item.product_id) THEN
      CONTINUE;
    END IF;
    
    -- Update reserved quantity
    UPDATE lead_products
    SET stock_reserved = COALESCE(stock_reserved, 0) + item.quantity
    WHERE id = item.product_id;
    
    -- Log the movement
    INSERT INTO stock_movements (
      organization_id, product_id, movement_type, quantity,
      previous_quantity, new_quantity, reference_id, reference_type,
      notes, created_by
    ) VALUES (
      org_id, item.product_id, 'reserve', item.quantity,
      current_stock, current_stock, _sale_id, 'sale',
      'Reserva para venda', user_id
    );
  END LOOP;
END;
$$;


--
-- Name: restore_stock_for_cancelled_delivered_sale(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_stock_for_cancelled_delivered_sale(_sale_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item RECORD;
  current_stock integer;
  new_stock integer;
  org_id uuid;
  user_id uuid;
BEGIN
  -- Get organization
  SELECT organization_id INTO org_id
  FROM sales WHERE id = _sale_id;
  
  user_id := auth.uid();
  
  -- Loop through sale items
  FOR item IN
    SELECT si.product_id, si.quantity
    FROM sale_items si
    WHERE si.sale_id = _sale_id
  LOOP
    -- Get current stock info
    SELECT lp.stock_quantity
    INTO current_stock
    FROM lead_products lp
    WHERE lp.id = item.product_id AND lp.track_stock = true;
    
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    new_stock := current_stock + item.quantity;
    
    -- Restore to real stock
    UPDATE lead_products
    SET stock_quantity = new_stock
    WHERE id = item.product_id;
    
    -- Log the movement
    INSERT INTO stock_movements (
      organization_id, product_id, movement_type, quantity,
      previous_quantity, new_quantity, reference_id, reference_type,
      notes, created_by
    ) VALUES (
      org_id, item.product_id, 'return', item.quantity,
      current_stock, new_stock, _sale_id, 'sale_cancelled_after_delivery',
      'Estorno por cancelamento após entrega', user_id
    );
  END LOOP;
END;
$$;


--
-- Name: save_onboarding_data(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_onboarding_data(_cnpj text DEFAULT NULL::text, _company_site text DEFAULT NULL::text, _crm_usage_intent text DEFAULT NULL::text, _business_description text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  org_id uuid;
BEGIN
  org_id := public.get_user_organization_id();

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'ORG_NOT_FOUND';
  END IF;

  INSERT INTO public.onboarding_data (
    organization_id,
    user_id,
    cnpj,
    company_site,
    crm_usage_intent,
    business_description,
    completed_at
  )
  VALUES (
    org_id,
    auth.uid(),
    _cnpj,
    _company_site,
    _crm_usage_intent,
    _business_description,
    now()
  )
  ON CONFLICT (organization_id)
  DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    cnpj = EXCLUDED.cnpj,
    company_site = EXCLUDED.company_site,
    crm_usage_intent = EXCLUDED.crm_usage_intent,
    business_description = EXCLUDED.business_description,
    completed_at = EXCLUDED.completed_at,
    updated_at = now();
END;
$$;


--
-- Name: seed_default_return_reasons(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_default_return_reasons() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.delivery_return_reasons (organization_id, name, is_system, position) VALUES
    (NEW.id, 'Sem receita', true, 1),
    (NEW.id, 'Sem notificação', true, 2),
    (NEW.id, 'Sem dinheiro', true, 3),
    (NEW.id, 'Endereço insuficiente', true, 4),
    (NEW.id, 'Fora do horário', true, 5),
    (NEW.id, 'Ausente', true, 6),
    (NEW.id, 'Recusou', true, 7);
  RETURN NEW;
END;
$$;


--
-- Name: seed_standard_questions_for_org(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_standard_questions_for_org(_org_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  q_id uuid;
BEGIN
  -- Verificar se já tem perguntas padrão
  IF EXISTS (SELECT 1 FROM standard_questions WHERE organization_id = _org_id AND is_system = true) THEN
    RETURN;
  END IF;

  -- =============================
  -- CATEGORIA: DORES ARTICULARES
  -- =============================
  
  -- Pergunta 1: Onde você sofre com dores?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'dores_articulares', 'Aonde você sofre com dores?', 'multiple_choice', true, 1)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Joelho', 1),
    (q_id, 'Costas', 2),
    (q_id, 'Coluna', 3),
    (q_id, 'Ombro', 4),
    (q_id, 'Mão', 5),
    (q_id, 'Dedos', 6),
    (q_id, 'Ciático', 7),
    (q_id, 'Pé', 8),
    (q_id, 'Perna', 9),
    (q_id, 'Pescoço', 10),
    (q_id, 'Outro lugar do corpo', 11);
  
  -- Pergunta 2: O que deixa de fazer por culpa das dores?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'dores_articulares', 'O que você deixa de fazer por culpa das dores?', 'multiple_choice', true, 2)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Cozinhar', 1),
    (q_id, 'Lavar louça', 2),
    (q_id, 'Fazer compras (ir ao mercado/supermercado)', 3),
    (q_id, 'Limpar a casa (varrer, passar pano)', 4),
    (q_id, 'Lavar e passar roupa', 5),
    (q_id, 'Tomar banho ou se vestir', 6),
    (q_id, 'Cuidar do jardim/quintal', 7),
    (q_id, 'Subir e descer escadas', 8),
    (q_id, 'Caminhar longas distâncias', 9),
    (q_id, 'Ficar em pé por muito tempo', 10),
    (q_id, 'Ficar sentado(a) por muito tempo', 11),
    (q_id, 'Praticar exercícios físicos ou esportes', 12),
    (q_id, 'Carregar objetos pesados (sacolas de compras, mochilas)', 13),
    (q_id, 'Trabalhar (no escritório ou em casa)', 14),
    (q_id, 'Dirigir', 15),
    (q_id, 'Dormir (dificuldade em encontrar posição confortável)', 16),
    (q_id, 'Sair com amigos/familiares ou socializar', 17),
    (q_id, 'Participar de hobbies ou atividades de lazer', 18),
    (q_id, 'Viajar', 19),
    (q_id, 'Nenhuma das opções acima', 20);
  
  -- Pergunta 3: Quanto tempo sofre com dores?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'dores_articulares', 'Quanto tempo você sofre com dores?', 'single_choice', true, 3)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, '1 semana', 1),
    (q_id, '1 mês', 2),
    (q_id, 'De 1 a 3 meses', 3),
    (q_id, 'De 3 meses a 1 ano', 4),
    (q_id, 'Mais de 1 ano', 5),
    (q_id, 'Mais de 5 anos', 6),
    (q_id, 'Mais de 10 anos', 7);

  -- =============================
  -- CATEGORIA: EMAGRECIMENTO
  -- =============================
  
  -- Pergunta IMC (especial)
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'emagrecimento', 'Cálculo de IMC (Peso, Altura e Idade)', 'imc_calculator', true, 4)
  RETURNING id INTO q_id;
  
  -- Pergunta: Quantos kg quer emagrecer?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'emagrecimento', 'Quantos kg você quer emagrecer?', 'number', true, 5)
  RETURNING id INTO q_id;
  
  -- Pergunta: Maior dificuldade para emagrecer
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'emagrecimento', 'Qual sua maior dificuldade para emagrecer?', 'multiple_choice', true, 6)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Como muito doce', 1),
    (q_id, 'Como muito salgado', 2),
    (q_id, 'Tenho muita ansiedade', 3),
    (q_id, 'Como fora de hora', 4),
    (q_id, 'Como por olho', 5),
    (q_id, 'Repito muitas vezes na hora da refeição', 6),
    (q_id, 'Não sei por que engordo, como pouco', 7),
    (q_id, 'Outro motivo', 8);

  -- =============================
  -- CATEGORIA: DIABETES
  -- =============================
  
  -- Pergunta: Você tem diabetes?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'diabetes', 'Você tem diabetes?', 'multiple_choice', true, 7)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Não tenho diabetes', 1),
    (q_id, 'Não sei se tenho diabetes', 2),
    (q_id, 'Tenho histórico de diabetes na família', 3),
    (q_id, 'Tenho diabetes tipo 1', 4),
    (q_id, 'Tenho diabetes tipo 2', 5);
  
  -- Pergunta: Faz uso de insulina?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'diabetes', 'Faz uso de insulina injetável?', 'single_choice', true, 8)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Faço uso de insulina injetável', 1),
    (q_id, 'Não faço uso de insulina injetável', 2);

  -- =============================
  -- CATEGORIA: SAÚDE GERAL
  -- =============================
  
  -- Pergunta: Osteoporose
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você tem osteoporose?', 'single_choice', true, 9)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Não', 1),
    (q_id, 'Não sei', 2),
    (q_id, 'Tenho', 3);
  
  -- Pergunta: Pernas inchadas
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você sofre de pernas inchadas?', 'single_choice', true, 10)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Sim', 1),
    (q_id, 'Poucas vezes', 2),
    (q_id, 'Não', 3);
  
  -- Pergunta: Formigamento
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você sofre de formigamento?', 'single_choice', true, 11)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Sim', 1),
    (q_id, 'Poucas vezes', 2),
    (q_id, 'Não', 3);
  
  -- Pergunta: Visão embaçada
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você está com sua visão embaçada, ou mudando de óculos de pouco em pouco tempo?', 'single_choice', true, 12)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Sim', 1),
    (q_id, 'Não', 2);
    
END;
$$;


--
-- Name: seed_standard_questions_on_org_create(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_standard_questions_on_org_create() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM seed_standard_questions_for_org(NEW.id);
  RETURN NEW;
END;
$$;


--
-- Name: unreserve_stock_for_sale(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unreserve_stock_for_sale(_sale_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item RECORD;
  current_stock integer;
  current_reserved integer;
  org_id uuid;
  user_id uuid;
BEGIN
  -- Get organization
  SELECT organization_id INTO org_id
  FROM sales WHERE id = _sale_id;
  
  user_id := auth.uid();
  
  -- Loop through sale items
  FOR item IN
    SELECT si.product_id, si.quantity
    FROM sale_items si
    WHERE si.sale_id = _sale_id
  LOOP
    -- Get current stock info
    SELECT lp.stock_quantity, lp.stock_reserved
    INTO current_stock, current_reserved
    FROM lead_products lp
    WHERE lp.id = item.product_id AND lp.track_stock = true;
    
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    -- Update reserved quantity (don't go negative)
    UPDATE lead_products
    SET stock_reserved = GREATEST(0, COALESCE(stock_reserved, 0) - item.quantity)
    WHERE id = item.product_id;
    
    -- Log the movement
    INSERT INTO stock_movements (
      organization_id, product_id, movement_type, quantity,
      previous_quantity, new_quantity, reference_id, reference_type,
      notes, created_by
    ) VALUES (
      org_id, item.product_id, 'unreserve', item.quantity,
      current_stock, current_stock, _sale_id, 'sale_cancelled',
      'Cancelamento de venda - estoque liberado', user_id
    );
  END LOOP;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: user_belongs_to_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_belongs_to_org(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;


--
-- Name: user_can_insert_to_org(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_insert_to_org(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;


--
-- Name: user_can_see_lead(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_can_see_lead(_user_id uuid, _lead_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result boolean;
BEGIN
  SELECT (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.leads l ON l.organization_id = om.organization_id
      WHERE om.user_id = _user_id
      AND l.id = _lead_id
      AND om.can_see_all_leads = true
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_responsibles lr
      WHERE lr.user_id = _user_id
      AND lr.lead_id = _lead_id
    )
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;


--
-- Name: user_has_permission(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_permission(_user_id uuid, _resource text, _action text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_role org_role;
  user_org_id uuid;
  has_perm boolean;
BEGIN
  -- Get user's organization and role
  SELECT om.organization_id, om.role INTO user_org_id, user_role
  FROM organization_members om
  WHERE om.user_id = _user_id
  LIMIT 1;
  
  IF user_org_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Owner always has all permissions
  IF user_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Check specific permission
  SELECT 
    CASE _action
      WHEN 'view' THEN can_view
      WHEN 'create' THEN can_create
      WHEN 'edit' THEN can_edit
      WHEN 'delete' THEN can_delete
      ELSE false
    END INTO has_perm
  FROM role_permissions
  WHERE organization_id = user_org_id
    AND role = user_role
    AND resource = _resource;
  
  RETURN COALESCE(has_perm, false);
END;
$$;


SET default_table_access_method = heap;

--
-- Name: whatsapp_instance_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_instance_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid NOT NULL,
    user_id uuid NOT NULL,
    can_view boolean DEFAULT true NOT NULL,
    can_send boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    phone_number text,
    z_api_instance_id text,
    z_api_token text,
    z_api_client_token text,
    status text DEFAULT 'pending'::text NOT NULL,
    qr_code_base64 text,
    is_connected boolean DEFAULT false NOT NULL,
    monthly_price_cents integer DEFAULT 19700 NOT NULL,
    payment_source text DEFAULT 'stripe'::text NOT NULL,
    stripe_subscription_item_id text,
    applied_coupon_id uuid,
    discount_applied_cents integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text DEFAULT 'zapi'::text NOT NULL,
    wasender_session_id text,
    wasender_api_key text,
    CONSTRAINT whatsapp_instances_payment_source_check CHECK ((payment_source = ANY (ARRAY['stripe'::text, 'admin_grant'::text]))),
    CONSTRAINT whatsapp_instances_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'disconnected'::text, 'canceled'::text])))
);


--
-- Name: channel_users; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.channel_users WITH (security_invoker='true') AS
 SELECT wiu.id,
    wiu.instance_id AS channel_id,
    wiu.user_id,
    wiu.can_view,
    wiu.can_send,
    wiu.created_at,
    wi.organization_id AS tenant_id
   FROM (public.whatsapp_instance_users wiu
     JOIN public.whatsapp_instances wi ON ((wi.id = wiu.instance_id)));


--
-- Name: channels; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.channels WITH (security_invoker='true') AS
 SELECT id,
    organization_id AS tenant_id,
    provider,
    phone_number AS phone_e164,
    COALESCE(wasender_session_id, z_api_instance_id) AS external_account_id,
    wasender_api_key,
    z_api_token,
    z_api_client_token,
    status,
    name,
    is_connected,
    monthly_price_cents,
    payment_source,
    qr_code_base64,
    created_at,
    updated_at
   FROM public.whatsapp_instances wi;


--
-- Name: contact_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    type text NOT NULL,
    value text NOT NULL,
    value_normalized text NOT NULL,
    is_primary boolean DEFAULT false,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contact_identities_type_check CHECK ((type = ANY (ARRAY['phone'::text, 'email'::text, 'instagram'::text, 'linkedin'::text, 'other'::text])))
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    full_name text,
    email text,
    avatar_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone
);


--
-- Name: continuous_medications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.continuous_medications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delivery_region_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_region_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    shift public.delivery_shift DEFAULT 'full_day'::public.delivery_shift NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_region_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: delivery_region_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_region_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delivery_regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    assigned_user_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: delivery_return_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_return_reasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: discount_authorizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_authorizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    sale_id uuid,
    sale_item_id uuid,
    product_id uuid NOT NULL,
    seller_user_id uuid NOT NULL,
    authorizer_user_id uuid NOT NULL,
    minimum_price_cents integer NOT NULL,
    authorized_price_cents integer NOT NULL,
    discount_amount_cents integer NOT NULL,
    authorization_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: discount_coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount_coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    discount_value_cents integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_uses integer,
    current_uses integer DEFAULT 0 NOT NULL,
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    error_type text NOT NULL,
    error_message text NOT NULL,
    error_details jsonb,
    source text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: google_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.google_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: installment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installment_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    installment_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    changed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: interested_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interested_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    whatsapp text NOT NULL,
    email text,
    plan_id uuid,
    plan_name text,
    status text DEFAULT 'interested'::text NOT NULL,
    converted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    label text DEFAULT 'Principal'::text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    cep text,
    street text,
    street_number text,
    complement text,
    neighborhood text,
    city text,
    state text,
    google_maps_link text,
    delivery_notes text,
    delivery_region_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    user_id uuid NOT NULL,
    google_event_id text,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    location text,
    meeting_link text,
    synced_to_google boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid
);


--
-- Name: lead_followups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    reason text,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_id uuid,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_kit_rejections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_kit_rejections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    product_id uuid NOT NULL,
    kit_id uuid NOT NULL,
    rejected_by uuid NOT NULL,
    rejection_reason text NOT NULL,
    kit_quantity integer NOT NULL,
    kit_price_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_product_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_product_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    product_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    answer_1 text,
    answer_2 text,
    answer_3 text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: lead_product_question_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_product_question_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    product_id uuid NOT NULL,
    question_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    answer_text text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    organization_id uuid,
    description character varying(200),
    sales_script text,
    key_question_1 text,
    key_question_2 text,
    key_question_3 text,
    price_1_unit integer DEFAULT 0,
    price_3_units integer DEFAULT 0,
    price_6_units integer DEFAULT 0,
    price_12_units integer DEFAULT 0,
    minimum_price integer DEFAULT 0,
    usage_period_days integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    cost_cents integer DEFAULT 0,
    stock_quantity integer DEFAULT 0,
    minimum_stock integer DEFAULT 0,
    track_stock boolean DEFAULT false,
    stock_reserved integer DEFAULT 0,
    is_featured boolean DEFAULT false NOT NULL,
    category text DEFAULT 'produto_pronto'::text NOT NULL,
    crosssell_product_1_id uuid,
    crosssell_product_2_id uuid,
    image_url text,
    label_image_url text,
    restrict_to_users boolean DEFAULT false NOT NULL,
    CONSTRAINT lead_products_category_check CHECK ((category = ANY (ARRAY['produto_pronto'::text, 'print_on_demand'::text, 'manipulado'::text, 'ebook'::text, 'info_video_aula'::text, 'dropshipping'::text, 'servico'::text, 'outro'::text])))
);


--
-- Name: lead_responsibles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_responsibles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_source_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_source_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    source_id uuid NOT NULL,
    recorded_by uuid,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: lead_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    organization_id uuid
);


--
-- Name: lead_stage_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_stage_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    stage public.funnel_stage NOT NULL,
    previous_stage public.funnel_stage,
    reason text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lead_standard_question_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_standard_question_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    question_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    selected_option_ids uuid[] DEFAULT '{}'::uuid[],
    numeric_value numeric(10,2),
    imc_weight numeric(5,2),
    imc_height numeric(3,2),
    imc_age integer,
    imc_result numeric(5,2),
    imc_category text,
    answered_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    specialty text,
    instagram text DEFAULT ''::text,
    followers integer DEFAULT 0,
    whatsapp text NOT NULL,
    email text,
    stage public.funnel_stage DEFAULT 'prospect'::public.funnel_stage NOT NULL,
    stars integer DEFAULT 0 NOT NULL,
    assigned_to text NOT NULL,
    whatsapp_group text,
    desired_products text,
    negotiated_value numeric(10,2),
    paid_value numeric(10,2),
    observations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    meeting_date date,
    meeting_time time without time zone,
    meeting_link text,
    recorded_call_link text,
    linkedin text,
    cpf_cnpj text,
    site text,
    lead_source text,
    products text[],
    organization_id uuid,
    cep text,
    street text,
    street_number text,
    complement text,
    neighborhood text,
    city text,
    state text,
    secondary_phone text,
    delivery_region_id uuid,
    tiktok text,
    delivery_notes text,
    google_maps_link text,
    CONSTRAINT leads_stars_check CHECK (((stars >= 1) AND (stars <= 5)))
);


--
-- Name: non_purchase_reasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.non_purchase_reasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    target_stage_id uuid,
    followup_hours integer DEFAULT 0,
    webhook_url text,
    followup_webhook_url text,
    lead_visibility text DEFAULT 'assigned_only'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT non_purchase_reasons_lead_visibility_check CHECK ((lead_visibility = ANY (ARRAY['assigned_only'::text, 'all_sellers'::text])))
);


--
-- Name: onboarding_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    cnpj text,
    company_site text,
    crm_usage_intent text,
    business_description text,
    completed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_funnel_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_funnel_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    "position" integer NOT NULL,
    color text DEFAULT 'bg-gray-200'::text NOT NULL,
    text_color text DEFAULT 'text-gray-800'::text NOT NULL,
    stage_type text DEFAULT 'funnel'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.org_role DEFAULT 'member'::public.org_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    can_see_all_leads boolean DEFAULT true NOT NULL,
    commission_percentage numeric(5,2) DEFAULT 0,
    extension text,
    is_sales_manager boolean DEFAULT false NOT NULL,
    earns_team_commission boolean DEFAULT false NOT NULL,
    team_commission_percentage numeric DEFAULT 0,
    team_id uuid,
    CONSTRAINT organization_members_commission_percentage_check CHECK (((commission_percentage >= (0)::numeric) AND (commission_percentage <= (100)::numeric)))
);


--
-- Name: organization_whatsapp_credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_whatsapp_credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    free_instances_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organization_whatsapp_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_whatsapp_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    price_cents integer DEFAULT 19700 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT organization_whatsapp_providers_provider_check CHECK ((provider = ANY (ARRAY['zapi'::text, 'wasenderapi'::text])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    owner_email text,
    owner_name text,
    whatsapp_dms_enabled boolean DEFAULT false NOT NULL,
    receptive_module_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: payment_acquirers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_acquirers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_bank_destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_bank_destinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_cnpj_destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_cnpj_destinations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cnpj text NOT NULL,
    normalized_cnpj text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_cost_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_cost_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    normalized_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_method_transaction_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_method_transaction_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    payment_method_id uuid NOT NULL,
    transaction_type public.card_transaction_type NOT NULL,
    fee_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    fee_fixed_cents integer DEFAULT 0 NOT NULL,
    settlement_days integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    payment_timing text DEFAULT 'cash'::text NOT NULL,
    max_installments integer DEFAULT 1,
    min_installment_value_cents integer DEFAULT 0,
    destination_bank text,
    destination_cnpj text,
    fee_percentage numeric(5,2) DEFAULT 0,
    settlement_days integer DEFAULT 0,
    requires_proof boolean DEFAULT false,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category public.payment_category,
    installment_flow public.installment_flow,
    bank_destination_id uuid,
    cnpj_destination_id uuid,
    cost_center_id uuid,
    acquirer_id uuid,
    fee_fixed_cents integer DEFAULT 0,
    requires_transaction_data boolean DEFAULT false,
    anticipation_fee_percentage numeric DEFAULT 0,
    CONSTRAINT payment_methods_payment_timing_check CHECK ((payment_timing = ANY (ARRAY['cash'::text, 'term'::text, 'installments'::text])))
);


--
-- Name: post_sale_surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_sale_surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    received_order boolean,
    knows_how_to_use boolean,
    seller_rating integer,
    uses_continuous_medication boolean,
    continuous_medication_details text,
    delivery_type text,
    delivery_rating integer,
    notes text,
    attempted_at timestamp with time zone,
    completed_at timestamp with time zone,
    completed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT post_sale_surveys_delivery_rating_check CHECK (((delivery_rating IS NULL) OR ((delivery_rating >= 0) AND (delivery_rating <= 10)))),
    CONSTRAINT post_sale_surveys_seller_rating_check CHECK (((seller_rating IS NULL) OR ((seller_rating >= 0) AND (seller_rating <= 10)))),
    CONSTRAINT post_sale_surveys_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'attempted'::text])))
);


--
-- Name: product_faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_price_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_price_kits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    regular_price_cents integer DEFAULT 0 NOT NULL,
    regular_use_default_commission boolean DEFAULT true NOT NULL,
    regular_custom_commission numeric(5,2),
    promotional_price_cents integer,
    promotional_use_default_commission boolean DEFAULT true NOT NULL,
    promotional_custom_commission numeric(5,2),
    minimum_price_cents integer,
    minimum_use_default_commission boolean DEFAULT true NOT NULL,
    minimum_custom_commission numeric(5,2),
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    promotional_price_2_cents integer,
    promotional_2_use_default_commission boolean DEFAULT true NOT NULL,
    promotional_2_custom_commission numeric,
    points_regular integer DEFAULT 0,
    points_promotional integer DEFAULT 0,
    points_promotional_2 integer DEFAULT 0,
    points_minimum integer DEFAULT 0,
    usage_period_days integer
);


--
-- Name: product_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    question_text text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_standard_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_standard_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    question_id uuid NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_user_visibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_user_visibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    instagram text,
    whatsapp text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid,
    email text,
    avatar_cartoon_url text,
    avatar_fighter_url text,
    avatar_horse_url text,
    favorite_drink text,
    favorite_chocolate text,
    dream_prize text,
    nickname text,
    daily_goal_cents integer DEFAULT 0,
    weekly_goal_cents integer DEFAULT 0,
    monthly_goal_cents integer DEFAULT 0
);


--
-- Name: receptive_attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receptive_attendances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    lead_id uuid,
    phone_searched text NOT NULL,
    lead_existed boolean DEFAULT false NOT NULL,
    conversation_mode text NOT NULL,
    product_id uuid,
    product_answers jsonb,
    sale_id uuid,
    non_purchase_reason_id uuid,
    completed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_potential_cents integer
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    role public.org_role NOT NULL,
    resource text NOT NULL,
    can_view boolean DEFAULT false NOT NULL,
    can_create boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: romaneio_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.romaneio_number_seq
    START WITH 10000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sac_ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sac_ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    content text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sac_ticket_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sac_ticket_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sac_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sac_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    sale_id uuid,
    created_by uuid NOT NULL,
    status public.sac_ticket_status DEFAULT 'open'::public.sac_ticket_status NOT NULL,
    priority public.sac_ticket_priority DEFAULT 'normal'::public.sac_ticket_priority NOT NULL,
    category public.sac_category NOT NULL,
    subcategory text NOT NULL,
    description text NOT NULL,
    resolution_notes text,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    closed_at timestamp with time zone,
    closed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sale_carrier_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_carrier_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    status public.carrier_tracking_status NOT NULL,
    changed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sale_changes_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_changes_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    change_type text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    item_id uuid,
    product_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sale_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_checkpoints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    checkpoint_type text NOT NULL,
    completed_at timestamp with time zone,
    completed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sale_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    installment_number integer DEFAULT 1 NOT NULL,
    total_installments integer DEFAULT 1 NOT NULL,
    amount_cents integer NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    payment_proof_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_date timestamp with time zone,
    card_brand public.card_brand,
    transaction_type public.card_transaction_type,
    nsu_cv text,
    acquirer_id uuid,
    fee_percentage numeric(5,2) DEFAULT 0,
    fee_cents integer DEFAULT 0,
    net_amount_cents integer,
    CONSTRAINT sale_installments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'overdue'::text, 'cancelled'::text])))
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price_cents integer NOT NULL,
    discount_cents integer DEFAULT 0 NOT NULL,
    total_cents integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    requisition_number text,
    commission_percentage numeric DEFAULT 0,
    commission_cents integer DEFAULT 0,
    CONSTRAINT sale_items_discount_cents_check CHECK ((discount_cents >= 0)),
    CONSTRAINT sale_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT sale_items_total_cents_check CHECK ((total_cents >= 0)),
    CONSTRAINT sale_items_unit_price_cents_check CHECK ((unit_price_cents >= 0))
);


--
-- Name: sale_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    previous_status public.sale_status,
    new_status public.sale_status NOT NULL,
    changed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    created_by uuid NOT NULL,
    expedition_validated_at timestamp with time zone,
    expedition_validated_by uuid,
    assigned_delivery_user_id uuid,
    dispatched_at timestamp with time zone,
    delivery_status public.delivery_status DEFAULT 'pending'::public.delivery_status,
    delivery_notes text,
    delivered_at timestamp with time zone,
    subtotal_cents integer DEFAULT 0 NOT NULL,
    discount_type text,
    discount_value integer DEFAULT 0,
    discount_cents integer DEFAULT 0 NOT NULL,
    total_cents integer DEFAULT 0 NOT NULL,
    payment_confirmed_at timestamp with time zone,
    payment_confirmed_by uuid,
    payment_method text,
    payment_notes text,
    payment_proof_url text,
    invoice_pdf_url text,
    invoice_xml_url text,
    status public.sale_status DEFAULT 'draft'::public.sale_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivery_type public.delivery_type DEFAULT 'pickup'::public.delivery_type NOT NULL,
    delivery_region_id uuid,
    scheduled_delivery_date date,
    scheduled_delivery_shift public.delivery_shift,
    shipping_carrier_id uuid,
    shipping_cost_cents integer DEFAULT 0,
    seller_user_id uuid,
    payment_method_id uuid,
    payment_installments integer DEFAULT 1,
    romaneio_number integer DEFAULT nextval('public.romaneio_number_seq'::regclass) NOT NULL,
    return_reason_id uuid,
    return_notes text,
    returned_at timestamp with time zone,
    returned_by uuid,
    delivery_position integer DEFAULT 0,
    tracking_code text,
    payment_status text DEFAULT 'not_paid'::text,
    return_photo_url text,
    return_latitude numeric,
    return_longitude numeric,
    missing_payment_proof boolean DEFAULT false,
    shipping_address_id uuid,
    seller_commission_percentage numeric DEFAULT 0,
    seller_commission_cents integer DEFAULT 0,
    post_sale_contact_status public.post_sale_contact_status,
    was_edited boolean DEFAULT false,
    carrier_tracking_status public.carrier_tracking_status,
    CONSTRAINT sales_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])))
);


--
-- Name: sales_manager_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_manager_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    manager_user_id uuid NOT NULL,
    team_member_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shipping_carriers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_carriers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    cost_cents integer DEFAULT 0 NOT NULL,
    estimated_days integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: standard_question_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_question_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    option_text text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: standard_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standard_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    category public.standard_question_category NOT NULL,
    question_text text NOT NULL,
    question_type public.standard_question_type DEFAULT 'single_choice'::public.standard_question_type NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    product_id uuid NOT NULL,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    previous_quantity integer NOT NULL,
    new_quantity integer NOT NULL,
    reference_id uuid,
    reference_type text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['entry'::text, 'exit'::text, 'adjustment'::text, 'sale'::text, 'return'::text, 'reserve'::text, 'unreserve'::text])))
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price_cents integer NOT NULL,
    max_leads integer,
    max_users integer NOT NULL,
    extra_user_price_cents integer DEFAULT 3700 NOT NULL,
    stripe_price_id text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    stripe_subscription_id text,
    stripe_customer_id text,
    status public.subscription_status DEFAULT 'trialing'::public.subscription_status NOT NULL,
    extra_users integer DEFAULT 0 NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#6366f1'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: temp_password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_password_resets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL
);


--
-- Name: whatsapp_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    phone_number text NOT NULL,
    contact_name text,
    contact_profile_pic text,
    lead_id uuid,
    unread_count integer DEFAULT 0 NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sendable_phone text,
    contact_id uuid,
    customer_phone_e164 text,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_user_id uuid,
    current_instance_id uuid,
    chat_id text,
    is_group boolean DEFAULT false NOT NULL,
    group_subject text,
    display_name text,
    CONSTRAINT whatsapp_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'pending'::text, 'closed'::text])))
);

ALTER TABLE ONLY public.whatsapp_conversations REPLICA IDENTITY FULL;


--
-- Name: threads; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.threads WITH (security_invoker='true') AS
 SELECT id,
    organization_id AS tenant_id,
    instance_id AS channel_id,
    phone_number,
    sendable_phone,
    customer_phone_e164,
    contact_name,
    contact_profile_pic,
    contact_id,
    lead_id,
    status,
    assigned_user_id,
    unread_count,
    last_message_at,
    created_at,
    updated_at
   FROM public.whatsapp_conversations wc;


--
-- Name: user_onboarding_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_onboarding_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    welcome_sent boolean DEFAULT false,
    first_lead_created boolean DEFAULT false,
    first_lead_tips_sent boolean DEFAULT false,
    leads_count_milestone_3 boolean DEFAULT false,
    funnel_tips_sent boolean DEFAULT false,
    first_stage_update boolean DEFAULT false,
    stage_tips_sent boolean DEFAULT false,
    leads_created_count integer DEFAULT 0,
    stage_updates_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    leads_view boolean DEFAULT true NOT NULL,
    leads_create boolean DEFAULT true NOT NULL,
    leads_edit boolean DEFAULT true NOT NULL,
    leads_delete boolean DEFAULT false NOT NULL,
    sales_view boolean DEFAULT true NOT NULL,
    sales_create boolean DEFAULT true NOT NULL,
    sales_edit_draft boolean DEFAULT true NOT NULL,
    sales_confirm_payment boolean DEFAULT false NOT NULL,
    sales_validate_expedition boolean DEFAULT false NOT NULL,
    sales_dispatch boolean DEFAULT false NOT NULL,
    sales_mark_delivered boolean DEFAULT false NOT NULL,
    sales_cancel boolean DEFAULT false NOT NULL,
    whatsapp_view boolean DEFAULT true NOT NULL,
    whatsapp_send boolean DEFAULT true NOT NULL,
    products_view boolean DEFAULT true NOT NULL,
    products_manage boolean DEFAULT false NOT NULL,
    settings_view boolean DEFAULT false NOT NULL,
    settings_manage boolean DEFAULT false NOT NULL,
    reports_view boolean DEFAULT false NOT NULL,
    deliveries_view_own boolean DEFAULT false NOT NULL,
    deliveries_view_all boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    receptive_module_access boolean DEFAULT false NOT NULL,
    team_view boolean DEFAULT false NOT NULL,
    instagram_view boolean DEFAULT false NOT NULL,
    products_view_cost boolean DEFAULT false NOT NULL,
    sales_view_all boolean DEFAULT false NOT NULL,
    post_sale_view boolean DEFAULT false NOT NULL,
    post_sale_manage boolean DEFAULT false NOT NULL,
    sac_view boolean DEFAULT false NOT NULL,
    sac_manage boolean DEFAULT false NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_bot_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_bot_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    bot_name text,
    bot_gender text,
    is_human_like boolean DEFAULT true NOT NULL,
    company_name text,
    company_website text,
    main_objective text,
    products_prices text,
    forbidden_words text[],
    supervisor_mode boolean DEFAULT true NOT NULL,
    tokens_used_month integer DEFAULT 0 NOT NULL,
    tokens_limit_month integer DEFAULT 300000 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT whatsapp_bot_configs_bot_gender_check CHECK ((bot_gender = ANY (ARRAY['male'::text, 'female'::text, 'neutral'::text])))
);


--
-- Name: whatsapp_conversations_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.whatsapp_conversations_view WITH (security_invoker='true') AS
 SELECT c.id,
    c.instance_id,
    c.organization_id,
    c.phone_number,
    c.contact_name,
    c.contact_profile_pic,
    c.lead_id,
    c.unread_count,
    c.last_message_at,
    c.created_at,
    c.updated_at,
    c.sendable_phone,
    c.contact_id,
    c.customer_phone_e164,
    c.status,
    c.assigned_user_id,
    c.current_instance_id,
    c.chat_id,
    c.is_group,
    c.group_subject,
    c.display_name,
    l.name AS lead_name,
    l.email AS lead_email,
    l.whatsapp AS lead_whatsapp,
    l.stage AS lead_stage,
    l.instagram AS lead_instagram,
    l.secondary_phone AS lead_secondary_phone,
    COALESCE(c.display_name,
        CASE
            WHEN c.is_group THEN COALESCE(c.group_subject, 'Grupo'::text)
            ELSE NULL::text
        END, l.name, c.phone_number) AS title
   FROM (public.whatsapp_conversations c
     LEFT JOIN public.leads l ON ((l.id = c.lead_id)));


--
-- Name: whatsapp_media_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_media_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text NOT NULL,
    bucket_id text DEFAULT 'whatsapp-media'::text NOT NULL,
    object_path text NOT NULL,
    content_type text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    instance_id uuid NOT NULL,
    z_api_message_id text,
    direction text NOT NULL,
    content text,
    message_type text DEFAULT 'text'::text NOT NULL,
    media_url text,
    media_caption text,
    is_from_bot boolean DEFAULT false NOT NULL,
    status text DEFAULT 'sent'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_id uuid,
    provider text DEFAULT 'wasenderapi'::text,
    provider_message_id text,
    CONSTRAINT whatsapp_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
    CONSTRAINT whatsapp_messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'audio'::text, 'image'::text, 'video'::text, 'document'::text, 'sticker'::text, 'location'::text]))),
    CONSTRAINT whatsapp_messages_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text])))
);

ALTER TABLE ONLY public.whatsapp_messages REPLICA IDENTITY FULL;


--
-- Name: whatsapp_v2_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_v2_chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    instance_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    whatsapp_id text NOT NULL,
    name text,
    image_url text,
    is_group boolean DEFAULT false,
    last_message text,
    last_message_time timestamp with time zone,
    unread_count integer DEFAULT 0,
    is_archived boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    lead_id uuid,
    contact_id uuid
);


--
-- Name: whatsapp_v2_instance_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_v2_instance_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    instance_id uuid NOT NULL,
    user_id uuid NOT NULL,
    can_view boolean DEFAULT true,
    can_send boolean DEFAULT true,
    can_manage boolean DEFAULT false
);


--
-- Name: whatsapp_v2_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_v2_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    api_url text NOT NULL,
    api_key text NOT NULL,
    phone_number text,
    status text DEFAULT 'disconnected'::text,
    is_active boolean DEFAULT true,
    last_connected_at timestamp with time zone,
    qr_code text,
    session_data jsonb,
    CONSTRAINT whatsapp_v2_instances_status_check CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'qrcode'::text, 'connecting'::text])))
);


--
-- Name: whatsapp_v2_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_v2_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    chat_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    content text,
    media_url text,
    media_type text DEFAULT 'text'::text,
    media_mime_type text,
    media_filename text,
    is_from_me boolean DEFAULT false,
    status text DEFAULT 'sent'::text,
    wa_message_id text,
    sender_name text,
    sender_phone text,
    quoted_message_id uuid,
    quoted_content text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT whatsapp_v2_messages_media_type_check CHECK ((media_type = ANY (ARRAY['text'::text, 'image'::text, 'audio'::text, 'video'::text, 'document'::text, 'sticker'::text, 'location'::text, 'contact'::text]))),
    CONSTRAINT whatsapp_v2_messages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text])))
);


--
-- Name: contact_identities contact_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_pkey PRIMARY KEY (id);


--
-- Name: contact_identities contact_identities_unique_value; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_unique_value UNIQUE (organization_id, type, value_normalized);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: continuous_medications continuous_medications_organization_id_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuous_medications
    ADD CONSTRAINT continuous_medications_organization_id_normalized_name_key UNIQUE (organization_id, normalized_name);


--
-- Name: continuous_medications continuous_medications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuous_medications
    ADD CONSTRAINT continuous_medications_pkey PRIMARY KEY (id);


--
-- Name: delivery_region_schedules delivery_region_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_region_schedules
    ADD CONSTRAINT delivery_region_schedules_pkey PRIMARY KEY (id);


--
-- Name: delivery_region_schedules delivery_region_schedules_region_id_day_of_week_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_region_schedules
    ADD CONSTRAINT delivery_region_schedules_region_id_day_of_week_shift_key UNIQUE (region_id, day_of_week, shift);


--
-- Name: delivery_region_users delivery_region_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_region_users
    ADD CONSTRAINT delivery_region_users_pkey PRIMARY KEY (id);


--
-- Name: delivery_region_users delivery_region_users_region_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_region_users
    ADD CONSTRAINT delivery_region_users_region_id_user_id_key UNIQUE (region_id, user_id);


--
-- Name: delivery_regions delivery_regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_regions
    ADD CONSTRAINT delivery_regions_pkey PRIMARY KEY (id);


--
-- Name: delivery_return_reasons delivery_return_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_return_reasons
    ADD CONSTRAINT delivery_return_reasons_pkey PRIMARY KEY (id);


--
-- Name: discount_authorizations discount_authorizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_authorizations
    ADD CONSTRAINT discount_authorizations_pkey PRIMARY KEY (id);


--
-- Name: discount_coupons discount_coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_coupons
    ADD CONSTRAINT discount_coupons_code_key UNIQUE (code);


--
-- Name: discount_coupons discount_coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_coupons
    ADD CONSTRAINT discount_coupons_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: google_tokens google_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_tokens
    ADD CONSTRAINT google_tokens_pkey PRIMARY KEY (id);


--
-- Name: google_tokens google_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.google_tokens
    ADD CONSTRAINT google_tokens_user_id_key UNIQUE (user_id);


--
-- Name: installment_history installment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_history
    ADD CONSTRAINT installment_history_pkey PRIMARY KEY (id);


--
-- Name: interested_leads interested_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interested_leads
    ADD CONSTRAINT interested_leads_pkey PRIMARY KEY (id);


--
-- Name: lead_addresses lead_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_addresses
    ADD CONSTRAINT lead_addresses_pkey PRIMARY KEY (id);


--
-- Name: lead_events lead_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_pkey PRIMARY KEY (id);


--
-- Name: lead_followups lead_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_followups
    ADD CONSTRAINT lead_followups_pkey PRIMARY KEY (id);


--
-- Name: lead_kit_rejections lead_kit_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_kit_rejections
    ADD CONSTRAINT lead_kit_rejections_pkey PRIMARY KEY (id);


--
-- Name: lead_product_answers lead_product_answers_lead_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_answers
    ADD CONSTRAINT lead_product_answers_lead_id_product_id_key UNIQUE (lead_id, product_id);


--
-- Name: lead_product_answers lead_product_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_answers
    ADD CONSTRAINT lead_product_answers_pkey PRIMARY KEY (id);


--
-- Name: lead_product_question_answers lead_product_question_answers_lead_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_question_answers
    ADD CONSTRAINT lead_product_question_answers_lead_id_question_id_key UNIQUE (lead_id, question_id);


--
-- Name: lead_product_question_answers lead_product_question_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_question_answers
    ADD CONSTRAINT lead_product_question_answers_pkey PRIMARY KEY (id);


--
-- Name: lead_products lead_products_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_products
    ADD CONSTRAINT lead_products_name_key UNIQUE (name);


--
-- Name: lead_products lead_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_products
    ADD CONSTRAINT lead_products_pkey PRIMARY KEY (id);


--
-- Name: lead_responsibles lead_responsibles_lead_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_responsibles
    ADD CONSTRAINT lead_responsibles_lead_id_user_id_key UNIQUE (lead_id, user_id);


--
-- Name: lead_responsibles lead_responsibles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_responsibles
    ADD CONSTRAINT lead_responsibles_pkey PRIMARY KEY (id);


--
-- Name: lead_source_history lead_source_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_source_history
    ADD CONSTRAINT lead_source_history_pkey PRIMARY KEY (id);


--
-- Name: lead_sources lead_sources_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_sources
    ADD CONSTRAINT lead_sources_name_key UNIQUE (name);


--
-- Name: lead_sources lead_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_sources
    ADD CONSTRAINT lead_sources_pkey PRIMARY KEY (id);


--
-- Name: lead_stage_history lead_stage_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_stage_history
    ADD CONSTRAINT lead_stage_history_pkey PRIMARY KEY (id);


--
-- Name: lead_standard_question_answers lead_standard_question_answers_lead_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_standard_question_answers
    ADD CONSTRAINT lead_standard_question_answers_lead_id_question_id_key UNIQUE (lead_id, question_id);


--
-- Name: lead_standard_question_answers lead_standard_question_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_standard_question_answers
    ADD CONSTRAINT lead_standard_question_answers_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: non_purchase_reasons non_purchase_reasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_purchase_reasons
    ADD CONSTRAINT non_purchase_reasons_pkey PRIMARY KEY (id);


--
-- Name: onboarding_data onboarding_data_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_data
    ADD CONSTRAINT onboarding_data_organization_id_key UNIQUE (organization_id);


--
-- Name: onboarding_data onboarding_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_data
    ADD CONSTRAINT onboarding_data_pkey PRIMARY KEY (id);


--
-- Name: organization_funnel_stages organization_funnel_stages_organization_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_funnel_stages
    ADD CONSTRAINT organization_funnel_stages_organization_id_position_key UNIQUE (organization_id, "position");


--
-- Name: organization_funnel_stages organization_funnel_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_funnel_stages
    ADD CONSTRAINT organization_funnel_stages_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organization_whatsapp_credits organization_whatsapp_credits_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_whatsapp_credits
    ADD CONSTRAINT organization_whatsapp_credits_organization_id_key UNIQUE (organization_id);


--
-- Name: organization_whatsapp_credits organization_whatsapp_credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_whatsapp_credits
    ADD CONSTRAINT organization_whatsapp_credits_pkey PRIMARY KEY (id);


--
-- Name: organization_whatsapp_providers organization_whatsapp_providers_org_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_whatsapp_providers
    ADD CONSTRAINT organization_whatsapp_providers_org_provider_key UNIQUE (organization_id, provider);


--
-- Name: organization_whatsapp_providers organization_whatsapp_providers_organization_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_whatsapp_providers
    ADD CONSTRAINT organization_whatsapp_providers_organization_id_provider_key UNIQUE (organization_id, provider);


--
-- Name: organization_whatsapp_providers organization_whatsapp_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_whatsapp_providers
    ADD CONSTRAINT organization_whatsapp_providers_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: payment_acquirers payment_acquirers_organization_id_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_acquirers
    ADD CONSTRAINT payment_acquirers_organization_id_normalized_name_key UNIQUE (organization_id, normalized_name);


--
-- Name: payment_acquirers payment_acquirers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_acquirers
    ADD CONSTRAINT payment_acquirers_pkey PRIMARY KEY (id);


--
-- Name: payment_bank_destinations payment_bank_destinations_organization_id_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_bank_destinations
    ADD CONSTRAINT payment_bank_destinations_organization_id_normalized_name_key UNIQUE (organization_id, normalized_name);


--
-- Name: payment_bank_destinations payment_bank_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_bank_destinations
    ADD CONSTRAINT payment_bank_destinations_pkey PRIMARY KEY (id);


--
-- Name: payment_cnpj_destinations payment_cnpj_destinations_organization_id_normalized_cnpj_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_cnpj_destinations
    ADD CONSTRAINT payment_cnpj_destinations_organization_id_normalized_cnpj_key UNIQUE (organization_id, normalized_cnpj);


--
-- Name: payment_cnpj_destinations payment_cnpj_destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_cnpj_destinations
    ADD CONSTRAINT payment_cnpj_destinations_pkey PRIMARY KEY (id);


--
-- Name: payment_cost_centers payment_cost_centers_organization_id_normalized_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_cost_centers
    ADD CONSTRAINT payment_cost_centers_organization_id_normalized_name_key UNIQUE (organization_id, normalized_name);


--
-- Name: payment_cost_centers payment_cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_cost_centers
    ADD CONSTRAINT payment_cost_centers_pkey PRIMARY KEY (id);


--
-- Name: payment_method_transaction_fees payment_method_transaction_fe_payment_method_id_transaction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_transaction_fees
    ADD CONSTRAINT payment_method_transaction_fe_payment_method_id_transaction_key UNIQUE (payment_method_id, transaction_type);


--
-- Name: payment_method_transaction_fees payment_method_transaction_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_transaction_fees
    ADD CONSTRAINT payment_method_transaction_fees_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: post_sale_surveys post_sale_surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_sale_surveys
    ADD CONSTRAINT post_sale_surveys_pkey PRIMARY KEY (id);


--
-- Name: post_sale_surveys post_sale_surveys_sale_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_sale_surveys
    ADD CONSTRAINT post_sale_surveys_sale_id_key UNIQUE (sale_id);


--
-- Name: product_faqs product_faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_faqs
    ADD CONSTRAINT product_faqs_pkey PRIMARY KEY (id);


--
-- Name: product_ingredients product_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_pkey PRIMARY KEY (id);


--
-- Name: product_price_kits product_price_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_kits
    ADD CONSTRAINT product_price_kits_pkey PRIMARY KEY (id);


--
-- Name: product_price_kits product_price_kits_product_id_quantity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_kits
    ADD CONSTRAINT product_price_kits_product_id_quantity_key UNIQUE (product_id, quantity);


--
-- Name: product_questions product_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_questions
    ADD CONSTRAINT product_questions_pkey PRIMARY KEY (id);


--
-- Name: product_standard_questions product_standard_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_standard_questions
    ADD CONSTRAINT product_standard_questions_pkey PRIMARY KEY (id);


--
-- Name: product_standard_questions product_standard_questions_product_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_standard_questions
    ADD CONSTRAINT product_standard_questions_product_id_question_id_key UNIQUE (product_id, question_id);


--
-- Name: product_user_visibility product_user_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_user_visibility
    ADD CONSTRAINT product_user_visibility_pkey PRIMARY KEY (id);


--
-- Name: product_user_visibility product_user_visibility_product_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_user_visibility
    ADD CONSTRAINT product_user_visibility_product_id_user_id_key UNIQUE (product_id, user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_whatsapp_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_whatsapp_unique UNIQUE (whatsapp);


--
-- Name: receptive_attendances receptive_attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptive_attendances
    ADD CONSTRAINT receptive_attendances_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_organization_id_role_resource_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_organization_id_role_resource_key UNIQUE (organization_id, role, resource);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: sac_ticket_comments sac_ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_ticket_comments
    ADD CONSTRAINT sac_ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: sac_ticket_users sac_ticket_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_ticket_users
    ADD CONSTRAINT sac_ticket_users_pkey PRIMARY KEY (id);


--
-- Name: sac_ticket_users sac_ticket_users_ticket_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_ticket_users
    ADD CONSTRAINT sac_ticket_users_ticket_id_user_id_key UNIQUE (ticket_id, user_id);


--
-- Name: sac_tickets sac_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_tickets
    ADD CONSTRAINT sac_tickets_pkey PRIMARY KEY (id);


--
-- Name: sale_carrier_tracking sale_carrier_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_carrier_tracking
    ADD CONSTRAINT sale_carrier_tracking_pkey PRIMARY KEY (id);


--
-- Name: sale_changes_log sale_changes_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_changes_log
    ADD CONSTRAINT sale_changes_log_pkey PRIMARY KEY (id);


--
-- Name: sale_checkpoints sale_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_checkpoints
    ADD CONSTRAINT sale_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: sale_checkpoints sale_checkpoints_sale_id_checkpoint_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_checkpoints
    ADD CONSTRAINT sale_checkpoints_sale_id_checkpoint_type_key UNIQUE (sale_id, checkpoint_type);


--
-- Name: sale_installments sale_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_installments
    ADD CONSTRAINT sale_installments_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sale_status_history sale_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_status_history
    ADD CONSTRAINT sale_status_history_pkey PRIMARY KEY (id);


--
-- Name: sales_manager_team_members sales_manager_team_members_manager_user_id_team_member_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_manager_team_members
    ADD CONSTRAINT sales_manager_team_members_manager_user_id_team_member_user_key UNIQUE (manager_user_id, team_member_user_id);


--
-- Name: sales_manager_team_members sales_manager_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_manager_team_members
    ADD CONSTRAINT sales_manager_team_members_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales sales_romaneio_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_romaneio_number_key UNIQUE (romaneio_number);


--
-- Name: shipping_carriers shipping_carriers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_carriers
    ADD CONSTRAINT shipping_carriers_pkey PRIMARY KEY (id);


--
-- Name: standard_question_options standard_question_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_question_options
    ADD CONSTRAINT standard_question_options_pkey PRIMARY KEY (id);


--
-- Name: standard_questions standard_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_questions
    ADD CONSTRAINT standard_questions_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_key UNIQUE (organization_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: teams teams_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: temp_password_resets temp_password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_password_resets
    ADD CONSTRAINT temp_password_resets_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding_progress user_onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding_progress user_onboarding_progress_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_user_id_key UNIQUE (user_id);


--
-- Name: user_permissions user_permissions_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: whatsapp_bot_configs whatsapp_bot_configs_instance_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_bot_configs
    ADD CONSTRAINT whatsapp_bot_configs_instance_id_key UNIQUE (instance_id);


--
-- Name: whatsapp_bot_configs whatsapp_bot_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_bot_configs
    ADD CONSTRAINT whatsapp_bot_configs_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_conversations whatsapp_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_instance_users whatsapp_instance_users_instance_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instance_users
    ADD CONSTRAINT whatsapp_instance_users_instance_id_user_id_key UNIQUE (instance_id, user_id);


--
-- Name: whatsapp_instance_users whatsapp_instance_users_instance_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instance_users
    ADD CONSTRAINT whatsapp_instance_users_instance_user_unique UNIQUE (instance_id, user_id);


--
-- Name: whatsapp_instance_users whatsapp_instance_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instance_users
    ADD CONSTRAINT whatsapp_instance_users_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_instances whatsapp_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_media_tokens whatsapp_media_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_media_tokens
    ADD CONSTRAINT whatsapp_media_tokens_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_media_tokens whatsapp_media_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_media_tokens
    ADD CONSTRAINT whatsapp_media_tokens_token_key UNIQUE (token);


--
-- Name: whatsapp_messages whatsapp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_v2_chats whatsapp_v2_chats_instance_id_whatsapp_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_chats
    ADD CONSTRAINT whatsapp_v2_chats_instance_id_whatsapp_id_key UNIQUE (instance_id, whatsapp_id);


--
-- Name: whatsapp_v2_chats whatsapp_v2_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_chats
    ADD CONSTRAINT whatsapp_v2_chats_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_v2_instance_users whatsapp_v2_instance_users_instance_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_instance_users
    ADD CONSTRAINT whatsapp_v2_instance_users_instance_id_user_id_key UNIQUE (instance_id, user_id);


--
-- Name: whatsapp_v2_instance_users whatsapp_v2_instance_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_instance_users
    ADD CONSTRAINT whatsapp_v2_instance_users_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_v2_instances whatsapp_v2_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_instances
    ADD CONSTRAINT whatsapp_v2_instances_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_v2_messages whatsapp_v2_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_messages
    ADD CONSTRAINT whatsapp_v2_messages_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_v2_messages whatsapp_v2_messages_wa_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_messages
    ADD CONSTRAINT whatsapp_v2_messages_wa_message_id_key UNIQUE (wa_message_id);


--
-- Name: idx_contact_identities_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_identities_contact ON public.contact_identities USING btree (contact_id);


--
-- Name: idx_contact_identities_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_identities_lookup ON public.contact_identities USING btree (organization_id, type, value_normalized);


--
-- Name: idx_contact_identities_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_identities_org ON public.contact_identities USING btree (organization_id);


--
-- Name: idx_contact_identities_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_identities_phone ON public.contact_identities USING btree (value_normalized) WHERE (type = 'phone'::text);


--
-- Name: idx_contacts_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_last_activity ON public.contacts USING btree (organization_id, last_activity_at DESC NULLS LAST);


--
-- Name: idx_contacts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_name ON public.contacts USING btree (organization_id, full_name);


--
-- Name: idx_contacts_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_org ON public.contacts USING btree (organization_id);


--
-- Name: idx_continuous_medications_org_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_continuous_medications_org_name ON public.continuous_medications USING btree (organization_id, normalized_name);


--
-- Name: idx_continuous_medications_usage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_continuous_medications_usage ON public.continuous_medications USING btree (organization_id, usage_count DESC);


--
-- Name: idx_conversations_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_assigned ON public.whatsapp_conversations USING btree (organization_id, assigned_user_id);


--
-- Name: idx_conversations_org_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_org_contact ON public.whatsapp_conversations USING btree (organization_id, contact_id);


--
-- Name: idx_conversations_org_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_org_phone ON public.whatsapp_conversations USING btree (organization_id, customer_phone_e164);


--
-- Name: idx_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_status ON public.whatsapp_conversations USING btree (organization_id, status);


--
-- Name: idx_delivery_region_schedules_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_region_schedules_region ON public.delivery_region_schedules USING btree (region_id);


--
-- Name: idx_delivery_regions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_regions_org ON public.delivery_regions USING btree (organization_id);


--
-- Name: idx_delivery_regions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_regions_user ON public.delivery_regions USING btree (assigned_user_id);


--
-- Name: idx_discount_authorizations_authorizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_authorizations_authorizer ON public.discount_authorizations USING btree (authorizer_user_id);


--
-- Name: idx_discount_authorizations_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_authorizations_org_id ON public.discount_authorizations USING btree (organization_id);


--
-- Name: idx_discount_authorizations_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_discount_authorizations_sale_id ON public.discount_authorizations USING btree (sale_id);


--
-- Name: idx_error_logs_org_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_org_created ON public.error_logs USING btree (organization_id, created_at DESC);


--
-- Name: idx_error_logs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_type ON public.error_logs USING btree (error_type);


--
-- Name: idx_installment_history_installment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_installment_history_installment_id ON public.installment_history USING btree (installment_id);


--
-- Name: idx_lead_addresses_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_addresses_lead_id ON public.lead_addresses USING btree (lead_id);


--
-- Name: idx_lead_addresses_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_addresses_organization_id ON public.lead_addresses USING btree (organization_id);


--
-- Name: idx_lead_followups_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followups_lead_id ON public.lead_followups USING btree (lead_id);


--
-- Name: idx_lead_followups_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followups_organization_id ON public.lead_followups USING btree (organization_id);


--
-- Name: idx_lead_followups_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followups_scheduled_at ON public.lead_followups USING btree (scheduled_at);


--
-- Name: idx_lead_followups_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_followups_user_id ON public.lead_followups USING btree (user_id);


--
-- Name: idx_lead_kit_rejections_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_kit_rejections_lead ON public.lead_kit_rejections USING btree (lead_id);


--
-- Name: idx_lead_kit_rejections_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_kit_rejections_product ON public.lead_kit_rejections USING btree (product_id);


--
-- Name: idx_lead_product_question_answers_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_product_question_answers_lead_id ON public.lead_product_question_answers USING btree (lead_id);


--
-- Name: idx_lead_product_question_answers_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_product_question_answers_product_id ON public.lead_product_question_answers USING btree (product_id);


--
-- Name: idx_lead_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_products_category ON public.lead_products USING btree (organization_id, category) WHERE (is_active = true);


--
-- Name: idx_lead_products_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_products_featured ON public.lead_products USING btree (organization_id, is_featured) WHERE (is_active = true);


--
-- Name: idx_lead_responsibles_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_responsibles_lead_id ON public.lead_responsibles USING btree (lead_id);


--
-- Name: idx_lead_responsibles_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_responsibles_org_id ON public.lead_responsibles USING btree (organization_id);


--
-- Name: idx_lead_responsibles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_responsibles_user_id ON public.lead_responsibles USING btree (user_id);


--
-- Name: idx_lead_source_history_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_source_history_lead_id ON public.lead_source_history USING btree (lead_id);


--
-- Name: idx_lead_source_history_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_source_history_org ON public.lead_source_history USING btree (organization_id);


--
-- Name: idx_lead_stage_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_stage_history_created_at ON public.lead_stage_history USING btree (created_at DESC);


--
-- Name: idx_lead_stage_history_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_stage_history_lead_id ON public.lead_stage_history USING btree (lead_id);


--
-- Name: idx_lead_standard_answers_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_standard_answers_lead ON public.lead_standard_question_answers USING btree (lead_id);


--
-- Name: idx_lead_standard_answers_options; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_standard_answers_options ON public.lead_standard_question_answers USING gin (selected_option_ids);


--
-- Name: idx_lead_standard_answers_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_standard_answers_question ON public.lead_standard_question_answers USING btree (question_id);


--
-- Name: idx_leads_delivery_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_delivery_region ON public.leads USING btree (delivery_region_id);


--
-- Name: idx_leads_tenant_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_tenant_stage ON public.leads USING btree (organization_id, stage);


--
-- Name: idx_messages_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_contact ON public.whatsapp_messages USING btree (contact_id);


--
-- Name: idx_messages_provider_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_messages_provider_unique ON public.whatsapp_messages USING btree (instance_id, z_api_message_id) WHERE (z_api_message_id IS NOT NULL);


--
-- Name: idx_non_purchase_reasons_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_non_purchase_reasons_org ON public.non_purchase_reasons USING btree (organization_id);


--
-- Name: idx_org_members_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_members_tenant ON public.organization_members USING btree (organization_id);


--
-- Name: idx_organization_members_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_organization_members_team_id ON public.organization_members USING btree (team_id);


--
-- Name: idx_payment_methods_org_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_methods_org_active ON public.payment_methods USING btree (organization_id, is_active);


--
-- Name: idx_product_faqs_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_faqs_product ON public.product_faqs USING btree (product_id);


--
-- Name: idx_product_ingredients_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_ingredients_product ON public.product_ingredients USING btree (product_id);


--
-- Name: idx_product_price_kits_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_price_kits_org_id ON public.product_price_kits USING btree (organization_id);


--
-- Name: idx_product_price_kits_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_price_kits_product_id ON public.product_price_kits USING btree (product_id);


--
-- Name: idx_product_questions_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_questions_org_id ON public.product_questions USING btree (organization_id);


--
-- Name: idx_product_questions_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_questions_product_id ON public.product_questions USING btree (product_id);


--
-- Name: idx_product_standard_questions_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_standard_questions_product ON public.product_standard_questions USING btree (product_id);


--
-- Name: idx_product_user_visibility_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_user_visibility_org ON public.product_user_visibility USING btree (organization_id);


--
-- Name: idx_product_user_visibility_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_user_visibility_product ON public.product_user_visibility USING btree (product_id);


--
-- Name: idx_product_user_visibility_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_user_visibility_user ON public.product_user_visibility USING btree (user_id);


--
-- Name: idx_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);


--
-- Name: idx_receptive_attendances_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receptive_attendances_lead ON public.receptive_attendances USING btree (lead_id);


--
-- Name: idx_receptive_attendances_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receptive_attendances_org ON public.receptive_attendances USING btree (organization_id);


--
-- Name: idx_receptive_attendances_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receptive_attendances_user ON public.receptive_attendances USING btree (user_id);


--
-- Name: idx_sac_ticket_comments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sac_ticket_comments_ticket_id ON public.sac_ticket_comments USING btree (ticket_id);


--
-- Name: idx_sac_ticket_users_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sac_ticket_users_ticket_id ON public.sac_ticket_users USING btree (ticket_id);


--
-- Name: idx_sac_tickets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sac_tickets_created_by ON public.sac_tickets USING btree (created_by);


--
-- Name: idx_sac_tickets_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sac_tickets_lead_id ON public.sac_tickets USING btree (lead_id);


--
-- Name: idx_sac_tickets_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sac_tickets_org_id ON public.sac_tickets USING btree (organization_id);


--
-- Name: idx_sac_tickets_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sac_tickets_sale_id ON public.sac_tickets USING btree (sale_id);


--
-- Name: idx_sac_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sac_tickets_status ON public.sac_tickets USING btree (status);


--
-- Name: idx_sale_carrier_tracking_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_carrier_tracking_sale_id ON public.sale_carrier_tracking USING btree (sale_id);


--
-- Name: idx_sale_changes_log_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_changes_log_changed_at ON public.sale_changes_log USING btree (changed_at DESC);


--
-- Name: idx_sale_changes_log_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_changes_log_organization_id ON public.sale_changes_log USING btree (organization_id);


--
-- Name: idx_sale_changes_log_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_changes_log_sale_id ON public.sale_changes_log USING btree (sale_id);


--
-- Name: idx_sale_checkpoints_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_checkpoints_sale_id ON public.sale_checkpoints USING btree (sale_id);


--
-- Name: idx_sale_installments_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_installments_due_date ON public.sale_installments USING btree (due_date);


--
-- Name: idx_sale_installments_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_installments_org_id ON public.sale_installments USING btree (organization_id);


--
-- Name: idx_sale_installments_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_installments_sale_id ON public.sale_installments USING btree (sale_id);


--
-- Name: idx_sale_installments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_installments_status ON public.sale_installments USING btree (status);


--
-- Name: idx_sale_items_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_items_sale_id ON public.sale_items USING btree (sale_id);


--
-- Name: idx_sale_status_history_sale_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_status_history_sale_id ON public.sale_status_history USING btree (sale_id);


--
-- Name: idx_sales_assigned_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_assigned_delivery ON public.sales USING btree (assigned_delivery_user_id);


--
-- Name: idx_sales_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_created_at ON public.sales USING btree (created_at DESC);


--
-- Name: idx_sales_delivery_ordering; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_delivery_ordering ON public.sales USING btree (assigned_delivery_user_id, scheduled_delivery_date, scheduled_delivery_shift, delivery_position) WHERE (status = ANY (ARRAY['dispatched'::public.sale_status, 'pending_expedition'::public.sale_status]));


--
-- Name: idx_sales_delivery_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_delivery_region ON public.sales USING btree (delivery_region_id);


--
-- Name: idx_sales_delivery_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_delivery_type ON public.sales USING btree (delivery_type);


--
-- Name: idx_sales_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_lead_id ON public.sales USING btree (lead_id);


--
-- Name: idx_sales_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_organization_id ON public.sales USING btree (organization_id);


--
-- Name: idx_sales_post_sale_contact_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_post_sale_contact_status ON public.sales USING btree (organization_id, post_sale_contact_status) WHERE (status = 'delivered'::public.sale_status);


--
-- Name: idx_sales_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_scheduled_date ON public.sales USING btree (scheduled_delivery_date);


--
-- Name: idx_sales_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_status ON public.sales USING btree (status);


--
-- Name: idx_shipping_carriers_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_carriers_org ON public.shipping_carriers USING btree (organization_id);


--
-- Name: idx_standard_question_options_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standard_question_options_question ON public.standard_question_options USING btree (question_id);


--
-- Name: idx_standard_questions_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standard_questions_category ON public.standard_questions USING btree (category);


--
-- Name: idx_standard_questions_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standard_questions_org ON public.standard_questions USING btree (organization_id);


--
-- Name: idx_stock_movements_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_created ON public.stock_movements USING btree (created_at DESC);


--
-- Name: idx_stock_movements_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_org ON public.stock_movements USING btree (organization_id);


--
-- Name: idx_stock_movements_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_product ON public.stock_movements USING btree (product_id);


--
-- Name: idx_teams_organization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teams_organization_id ON public.teams USING btree (organization_id);


--
-- Name: idx_temp_password_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_password_email ON public.temp_password_resets USING btree (email);


--
-- Name: idx_temp_password_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_password_user_id ON public.temp_password_resets USING btree (user_id);


--
-- Name: idx_v2_chats_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_chats_instance ON public.whatsapp_v2_chats USING btree (instance_id);


--
-- Name: idx_v2_chats_last_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_chats_last_message ON public.whatsapp_v2_chats USING btree (last_message_time DESC NULLS LAST);


--
-- Name: idx_v2_chats_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_chats_tenant ON public.whatsapp_v2_chats USING btree (tenant_id);


--
-- Name: idx_v2_chats_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_chats_unread ON public.whatsapp_v2_chats USING btree (unread_count) WHERE (unread_count > 0);


--
-- Name: idx_v2_chats_whatsapp_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_chats_whatsapp_id ON public.whatsapp_v2_chats USING btree (whatsapp_id);


--
-- Name: idx_v2_instance_users_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_instance_users_user ON public.whatsapp_v2_instance_users USING btree (user_id);


--
-- Name: idx_v2_instances_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_instances_status ON public.whatsapp_v2_instances USING btree (status) WHERE (is_active = true);


--
-- Name: idx_v2_instances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_instances_tenant ON public.whatsapp_v2_instances USING btree (tenant_id);


--
-- Name: idx_v2_messages_chat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_messages_chat ON public.whatsapp_v2_messages USING btree (chat_id);


--
-- Name: idx_v2_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_messages_created ON public.whatsapp_v2_messages USING btree (created_at DESC);


--
-- Name: idx_v2_messages_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_messages_tenant ON public.whatsapp_v2_messages USING btree (tenant_id);


--
-- Name: idx_v2_messages_wa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_v2_messages_wa_id ON public.whatsapp_v2_messages USING btree (wa_message_id) WHERE (wa_message_id IS NOT NULL);


--
-- Name: idx_whatsapp_conv_org_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_whatsapp_conv_org_phone ON public.whatsapp_conversations USING btree (organization_id, phone_number);


--
-- Name: idx_whatsapp_conversations_instance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_conversations_instance ON public.whatsapp_conversations USING btree (instance_id);


--
-- Name: idx_whatsapp_conversations_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_conversations_lead ON public.whatsapp_conversations USING btree (lead_id);


--
-- Name: idx_whatsapp_conversations_sendable_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_conversations_sendable_phone ON public.whatsapp_conversations USING btree (sendable_phone) WHERE (sendable_phone IS NOT NULL);


--
-- Name: idx_whatsapp_conversations_tenant_last_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_conversations_tenant_last_msg ON public.whatsapp_conversations USING btree (organization_id, last_message_at DESC NULLS LAST);


--
-- Name: idx_whatsapp_instances_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_instances_org ON public.whatsapp_instances USING btree (organization_id);


--
-- Name: idx_whatsapp_instances_tenant_connected; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_instances_tenant_connected ON public.whatsapp_instances USING btree (organization_id, is_connected);


--
-- Name: idx_whatsapp_media_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_media_tokens_expires_at ON public.whatsapp_media_tokens USING btree (expires_at);


--
-- Name: idx_whatsapp_media_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_media_tokens_token ON public.whatsapp_media_tokens USING btree (token);


--
-- Name: idx_whatsapp_messages_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_contact_id ON public.whatsapp_messages USING btree (contact_id);


--
-- Name: idx_whatsapp_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages USING btree (conversation_id);


--
-- Name: idx_whatsapp_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_conversation_created ON public.whatsapp_messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_whatsapp_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_created ON public.whatsapp_messages USING btree (created_at DESC);


--
-- Name: idx_whatsapp_messages_provider_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_provider_msg ON public.whatsapp_messages USING btree (provider, provider_message_id);


--
-- Name: whatsapp_conversations_org_chat_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX whatsapp_conversations_org_chat_id_uidx ON public.whatsapp_conversations USING btree (organization_id, chat_id) WHERE (chat_id IS NOT NULL);


--
-- Name: organization_members on_org_member_create_permissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_org_member_create_permissions AFTER INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.create_default_user_permissions();


--
-- Name: organizations seed_return_reasons_on_org_create; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seed_return_reasons_on_org_create AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.seed_default_return_reasons();


--
-- Name: organizations seed_standard_questions_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER seed_standard_questions_trigger AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.seed_standard_questions_on_org_create();


--
-- Name: organization_members trg_org_member_added; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_org_member_added AFTER INSERT ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.on_org_member_added();


--
-- Name: whatsapp_instances trg_whatsapp_instance_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_whatsapp_instance_created AFTER INSERT ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.on_whatsapp_instance_created();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: continuous_medications update_continuous_medications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_continuous_medications_updated_at BEFORE UPDATE ON public.continuous_medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: google_tokens update_google_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_google_tokens_updated_at BEFORE UPDATE ON public.google_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: interested_leads update_interested_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_interested_leads_updated_at BEFORE UPDATE ON public.interested_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_events update_lead_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_events_updated_at BEFORE UPDATE ON public.lead_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_followups update_lead_followups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_followups_updated_at BEFORE UPDATE ON public.lead_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_product_answers update_lead_product_answers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_product_answers_updated_at BEFORE UPDATE ON public.lead_product_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_products update_lead_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_products_updated_at BEFORE UPDATE ON public.lead_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_standard_question_answers update_lead_standard_answers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_lead_standard_answers_updated_at BEFORE UPDATE ON public.lead_standard_question_answers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: non_purchase_reasons update_non_purchase_reasons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_non_purchase_reasons_updated_at BEFORE UPDATE ON public.non_purchase_reasons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: onboarding_data update_onboarding_data_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_onboarding_data_updated_at BEFORE UPDATE ON public.onboarding_data FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_whatsapp_credits update_org_whatsapp_credits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_org_whatsapp_credits_updated_at BEFORE UPDATE ON public.organization_whatsapp_credits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_whatsapp_providers update_org_whatsapp_providers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_org_whatsapp_providers_updated_at BEFORE UPDATE ON public.organization_whatsapp_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organization_funnel_stages update_organization_funnel_stages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organization_funnel_stages_updated_at BEFORE UPDATE ON public.organization_funnel_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: post_sale_surveys update_post_sale_surveys_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_post_sale_surveys_updated_at BEFORE UPDATE ON public.post_sale_surveys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_price_kits update_product_price_kits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_price_kits_updated_at BEFORE UPDATE ON public.product_price_kits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: receptive_attendances update_receptive_attendances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_receptive_attendances_updated_at BEFORE UPDATE ON public.receptive_attendances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: role_permissions update_role_permissions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_role_permissions_updated_at BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sac_tickets update_sac_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sac_tickets_updated_at BEFORE UPDATE ON public.sac_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sale_checkpoints update_sale_checkpoints_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sale_checkpoints_updated_at BEFORE UPDATE ON public.sale_checkpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sale_installments update_sale_installments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sale_installments_updated_at BEFORE UPDATE ON public.sale_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sales update_sales_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: standard_questions update_standard_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_standard_questions_updated_at BEFORE UPDATE ON public.standard_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_onboarding_progress update_user_onboarding_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_onboarding_progress_updated_at BEFORE UPDATE ON public.user_onboarding_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_bot_configs update_whatsapp_bot_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_bot_configs_updated_at BEFORE UPDATE ON public.whatsapp_bot_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_conversations update_whatsapp_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_conversations_updated_at BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_instances update_whatsapp_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_v2_chats update_whatsapp_v2_chats_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_v2_chats_updated_at BEFORE UPDATE ON public.whatsapp_v2_chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_v2_instances update_whatsapp_v2_instances_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_v2_instances_updated_at BEFORE UPDATE ON public.whatsapp_v2_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_identities contact_identities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_identities contact_identities_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_identities
    ADD CONSTRAINT contact_identities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: continuous_medications continuous_medications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.continuous_medications
    ADD CONSTRAINT continuous_medications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: delivery_region_schedules delivery_region_schedules_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_region_schedules
    ADD CONSTRAINT delivery_region_schedules_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.delivery_regions(id) ON DELETE CASCADE;


--
-- Name: delivery_region_users delivery_region_users_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_region_users
    ADD CONSTRAINT delivery_region_users_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.delivery_regions(id) ON DELETE CASCADE;


--
-- Name: delivery_regions delivery_regions_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_regions
    ADD CONSTRAINT delivery_regions_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: delivery_regions delivery_regions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_regions
    ADD CONSTRAINT delivery_regions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: delivery_return_reasons delivery_return_reasons_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_return_reasons
    ADD CONSTRAINT delivery_return_reasons_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: discount_authorizations discount_authorizations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_authorizations
    ADD CONSTRAINT discount_authorizations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: discount_authorizations discount_authorizations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_authorizations
    ADD CONSTRAINT discount_authorizations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: discount_authorizations discount_authorizations_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_authorizations
    ADD CONSTRAINT discount_authorizations_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: discount_authorizations discount_authorizations_sale_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_authorizations
    ADD CONSTRAINT discount_authorizations_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id) ON DELETE SET NULL;


--
-- Name: discount_coupons discount_coupons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount_coupons
    ADD CONSTRAINT discount_coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: error_logs error_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: installment_history installment_history_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_history
    ADD CONSTRAINT installment_history_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.sale_installments(id) ON DELETE CASCADE;


--
-- Name: installment_history installment_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installment_history
    ADD CONSTRAINT installment_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: interested_leads interested_leads_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interested_leads
    ADD CONSTRAINT interested_leads_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: lead_addresses lead_addresses_delivery_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_addresses
    ADD CONSTRAINT lead_addresses_delivery_region_id_fkey FOREIGN KEY (delivery_region_id) REFERENCES public.delivery_regions(id) ON DELETE SET NULL;


--
-- Name: lead_addresses lead_addresses_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_addresses
    ADD CONSTRAINT lead_addresses_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_addresses lead_addresses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_addresses
    ADD CONSTRAINT lead_addresses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_events lead_events_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_events lead_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_events
    ADD CONSTRAINT lead_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_followups lead_followups_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_followups
    ADD CONSTRAINT lead_followups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_followups lead_followups_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_followups
    ADD CONSTRAINT lead_followups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_kit_rejections lead_kit_rejections_kit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_kit_rejections
    ADD CONSTRAINT lead_kit_rejections_kit_id_fkey FOREIGN KEY (kit_id) REFERENCES public.product_price_kits(id) ON DELETE CASCADE;


--
-- Name: lead_kit_rejections lead_kit_rejections_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_kit_rejections
    ADD CONSTRAINT lead_kit_rejections_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_kit_rejections lead_kit_rejections_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_kit_rejections
    ADD CONSTRAINT lead_kit_rejections_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_kit_rejections lead_kit_rejections_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_kit_rejections
    ADD CONSTRAINT lead_kit_rejections_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: lead_product_answers lead_product_answers_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_answers
    ADD CONSTRAINT lead_product_answers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_product_answers lead_product_answers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_answers
    ADD CONSTRAINT lead_product_answers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_product_answers lead_product_answers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_answers
    ADD CONSTRAINT lead_product_answers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: lead_product_answers lead_product_answers_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_answers
    ADD CONSTRAINT lead_product_answers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: lead_product_question_answers lead_product_question_answers_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_question_answers
    ADD CONSTRAINT lead_product_question_answers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_product_question_answers lead_product_question_answers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_question_answers
    ADD CONSTRAINT lead_product_question_answers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_product_question_answers lead_product_question_answers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_question_answers
    ADD CONSTRAINT lead_product_question_answers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: lead_product_question_answers lead_product_question_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_product_question_answers
    ADD CONSTRAINT lead_product_question_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.product_questions(id) ON DELETE CASCADE;


--
-- Name: lead_products lead_products_crosssell_product_1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_products
    ADD CONSTRAINT lead_products_crosssell_product_1_id_fkey FOREIGN KEY (crosssell_product_1_id) REFERENCES public.lead_products(id) ON DELETE SET NULL;


--
-- Name: lead_products lead_products_crosssell_product_2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_products
    ADD CONSTRAINT lead_products_crosssell_product_2_id_fkey FOREIGN KEY (crosssell_product_2_id) REFERENCES public.lead_products(id) ON DELETE SET NULL;


--
-- Name: lead_products lead_products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_products
    ADD CONSTRAINT lead_products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_responsibles lead_responsibles_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_responsibles
    ADD CONSTRAINT lead_responsibles_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_source_history lead_source_history_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_source_history
    ADD CONSTRAINT lead_source_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_source_history lead_source_history_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_source_history
    ADD CONSTRAINT lead_source_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_source_history lead_source_history_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_source_history
    ADD CONSTRAINT lead_source_history_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.lead_sources(id) ON DELETE CASCADE;


--
-- Name: lead_sources lead_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_sources
    ADD CONSTRAINT lead_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_stage_history lead_stage_history_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_stage_history
    ADD CONSTRAINT lead_stage_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_standard_question_answers lead_standard_question_answers_answered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_standard_question_answers
    ADD CONSTRAINT lead_standard_question_answers_answered_by_fkey FOREIGN KEY (answered_by) REFERENCES auth.users(id);


--
-- Name: lead_standard_question_answers lead_standard_question_answers_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_standard_question_answers
    ADD CONSTRAINT lead_standard_question_answers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_standard_question_answers lead_standard_question_answers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_standard_question_answers
    ADD CONSTRAINT lead_standard_question_answers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_standard_question_answers lead_standard_question_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_standard_question_answers
    ADD CONSTRAINT lead_standard_question_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.standard_questions(id) ON DELETE CASCADE;


--
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: leads leads_delivery_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_delivery_region_id_fkey FOREIGN KEY (delivery_region_id) REFERENCES public.delivery_regions(id) ON DELETE SET NULL;


--
-- Name: leads leads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: non_purchase_reasons non_purchase_reasons_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_purchase_reasons
    ADD CONSTRAINT non_purchase_reasons_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: non_purchase_reasons non_purchase_reasons_target_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.non_purchase_reasons
    ADD CONSTRAINT non_purchase_reasons_target_stage_id_fkey FOREIGN KEY (target_stage_id) REFERENCES public.organization_funnel_stages(id) ON DELETE SET NULL;


--
-- Name: onboarding_data onboarding_data_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_data
    ADD CONSTRAINT onboarding_data_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_funnel_stages organization_funnel_stages_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_funnel_stages
    ADD CONSTRAINT organization_funnel_stages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organization_whatsapp_credits organization_whatsapp_credits_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_whatsapp_credits
    ADD CONSTRAINT organization_whatsapp_credits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_whatsapp_providers organization_whatsapp_providers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_whatsapp_providers
    ADD CONSTRAINT organization_whatsapp_providers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_acquirers payment_acquirers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_acquirers
    ADD CONSTRAINT payment_acquirers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_bank_destinations payment_bank_destinations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_bank_destinations
    ADD CONSTRAINT payment_bank_destinations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_cnpj_destinations payment_cnpj_destinations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_cnpj_destinations
    ADD CONSTRAINT payment_cnpj_destinations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_cost_centers payment_cost_centers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_cost_centers
    ADD CONSTRAINT payment_cost_centers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_method_transaction_fees payment_method_transaction_fees_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_transaction_fees
    ADD CONSTRAINT payment_method_transaction_fees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payment_method_transaction_fees payment_method_transaction_fees_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method_transaction_fees
    ADD CONSTRAINT payment_method_transaction_fees_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_acquirer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_acquirer_id_fkey FOREIGN KEY (acquirer_id) REFERENCES public.payment_acquirers(id);


--
-- Name: payment_methods payment_methods_bank_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_bank_destination_id_fkey FOREIGN KEY (bank_destination_id) REFERENCES public.payment_bank_destinations(id);


--
-- Name: payment_methods payment_methods_cnpj_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_cnpj_destination_id_fkey FOREIGN KEY (cnpj_destination_id) REFERENCES public.payment_cnpj_destinations(id);


--
-- Name: payment_methods payment_methods_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.payment_cost_centers(id);


--
-- Name: payment_methods payment_methods_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: post_sale_surveys post_sale_surveys_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_sale_surveys
    ADD CONSTRAINT post_sale_surveys_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: post_sale_surveys post_sale_surveys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_sale_surveys
    ADD CONSTRAINT post_sale_surveys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: post_sale_surveys post_sale_surveys_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_sale_surveys
    ADD CONSTRAINT post_sale_surveys_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: product_faqs product_faqs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_faqs
    ADD CONSTRAINT product_faqs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_faqs product_faqs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_faqs
    ADD CONSTRAINT product_faqs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: product_ingredients product_ingredients_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_ingredients product_ingredients_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: product_price_kits product_price_kits_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_kits
    ADD CONSTRAINT product_price_kits_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_price_kits product_price_kits_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_kits
    ADD CONSTRAINT product_price_kits_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: product_questions product_questions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_questions
    ADD CONSTRAINT product_questions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_questions product_questions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_questions
    ADD CONSTRAINT product_questions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: product_standard_questions product_standard_questions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_standard_questions
    ADD CONSTRAINT product_standard_questions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: product_standard_questions product_standard_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_standard_questions
    ADD CONSTRAINT product_standard_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.standard_questions(id) ON DELETE CASCADE;


--
-- Name: product_user_visibility product_user_visibility_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_user_visibility
    ADD CONSTRAINT product_user_visibility_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_user_visibility product_user_visibility_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_user_visibility
    ADD CONSTRAINT product_user_visibility_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: product_user_visibility product_user_visibility_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_user_visibility
    ADD CONSTRAINT product_user_visibility_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: receptive_attendances receptive_attendances_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptive_attendances
    ADD CONSTRAINT receptive_attendances_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: receptive_attendances receptive_attendances_non_purchase_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptive_attendances
    ADD CONSTRAINT receptive_attendances_non_purchase_reason_id_fkey FOREIGN KEY (non_purchase_reason_id) REFERENCES public.non_purchase_reasons(id) ON DELETE SET NULL;


--
-- Name: receptive_attendances receptive_attendances_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptive_attendances
    ADD CONSTRAINT receptive_attendances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: receptive_attendances receptive_attendances_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptive_attendances
    ADD CONSTRAINT receptive_attendances_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE SET NULL;


--
-- Name: receptive_attendances receptive_attendances_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receptive_attendances
    ADD CONSTRAINT receptive_attendances_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sac_ticket_comments sac_ticket_comments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_ticket_comments
    ADD CONSTRAINT sac_ticket_comments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sac_ticket_comments sac_ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_ticket_comments
    ADD CONSTRAINT sac_ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.sac_tickets(id) ON DELETE CASCADE;


--
-- Name: sac_ticket_users sac_ticket_users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_ticket_users
    ADD CONSTRAINT sac_ticket_users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sac_ticket_users sac_ticket_users_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_ticket_users
    ADD CONSTRAINT sac_ticket_users_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.sac_tickets(id) ON DELETE CASCADE;


--
-- Name: sac_tickets sac_tickets_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_tickets
    ADD CONSTRAINT sac_tickets_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: sac_tickets sac_tickets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_tickets
    ADD CONSTRAINT sac_tickets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sac_tickets sac_tickets_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sac_tickets
    ADD CONSTRAINT sac_tickets_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;


--
-- Name: sale_carrier_tracking sale_carrier_tracking_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_carrier_tracking
    ADD CONSTRAINT sale_carrier_tracking_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sale_carrier_tracking sale_carrier_tracking_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_carrier_tracking
    ADD CONSTRAINT sale_carrier_tracking_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_changes_log sale_changes_log_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_changes_log
    ADD CONSTRAINT sale_changes_log_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.sale_items(id) ON DELETE SET NULL;


--
-- Name: sale_changes_log sale_changes_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_changes_log
    ADD CONSTRAINT sale_changes_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sale_changes_log sale_changes_log_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_changes_log
    ADD CONSTRAINT sale_changes_log_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_checkpoints sale_checkpoints_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_checkpoints
    ADD CONSTRAINT sale_checkpoints_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sale_checkpoints sale_checkpoints_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_checkpoints
    ADD CONSTRAINT sale_checkpoints_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_installments sale_installments_acquirer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_installments
    ADD CONSTRAINT sale_installments_acquirer_id_fkey FOREIGN KEY (acquirer_id) REFERENCES public.payment_acquirers(id);


--
-- Name: sale_installments sale_installments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_installments
    ADD CONSTRAINT sale_installments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sale_installments sale_installments_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_installments
    ADD CONSTRAINT sale_installments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE RESTRICT;


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sale_status_history sale_status_history_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_status_history
    ADD CONSTRAINT sale_status_history_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sales sales_delivery_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_delivery_region_id_fkey FOREIGN KEY (delivery_region_id) REFERENCES public.delivery_regions(id) ON DELETE SET NULL;


--
-- Name: sales sales_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT;


--
-- Name: sales_manager_team_members sales_manager_team_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_manager_team_members
    ADD CONSTRAINT sales_manager_team_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sales sales_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sales sales_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- Name: sales sales_return_reason_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_return_reason_id_fkey FOREIGN KEY (return_reason_id) REFERENCES public.delivery_return_reasons(id);


--
-- Name: sales sales_seller_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_seller_user_id_fkey FOREIGN KEY (seller_user_id) REFERENCES auth.users(id);


--
-- Name: sales sales_shipping_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_shipping_address_id_fkey FOREIGN KEY (shipping_address_id) REFERENCES public.lead_addresses(id) ON DELETE SET NULL;


--
-- Name: sales sales_shipping_carrier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_shipping_carrier_id_fkey FOREIGN KEY (shipping_carrier_id) REFERENCES public.shipping_carriers(id) ON DELETE SET NULL;


--
-- Name: shipping_carriers shipping_carriers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_carriers
    ADD CONSTRAINT shipping_carriers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: standard_question_options standard_question_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_question_options
    ADD CONSTRAINT standard_question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.standard_questions(id) ON DELETE CASCADE;


--
-- Name: standard_questions standard_questions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standard_questions
    ADD CONSTRAINT standard_questions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.lead_products(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: teams teams_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_onboarding_progress user_onboarding_progress_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT user_onboarding_progress_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: whatsapp_bot_configs whatsapp_bot_configs_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_bot_configs
    ADD CONSTRAINT whatsapp_bot_configs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;


--
-- Name: whatsapp_conversations whatsapp_conversations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: whatsapp_conversations whatsapp_conversations_current_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_current_instance_id_fkey FOREIGN KEY (current_instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;


--
-- Name: whatsapp_conversations whatsapp_conversations_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;


--
-- Name: whatsapp_conversations whatsapp_conversations_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: whatsapp_conversations whatsapp_conversations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_instance_users whatsapp_instance_users_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instance_users
    ADD CONSTRAINT whatsapp_instance_users_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;


--
-- Name: whatsapp_instance_users whatsapp_instance_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instance_users
    ADD CONSTRAINT whatsapp_instance_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: whatsapp_instances whatsapp_instances_applied_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_applied_coupon_id_fkey FOREIGN KEY (applied_coupon_id) REFERENCES public.discount_coupons(id);


--
-- Name: whatsapp_instances whatsapp_instances_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_instances
    ADD CONSTRAINT whatsapp_instances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_messages whatsapp_messages_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: whatsapp_messages whatsapp_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_messages whatsapp_messages_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;


--
-- Name: whatsapp_v2_chats whatsapp_v2_chats_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_chats
    ADD CONSTRAINT whatsapp_v2_chats_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: whatsapp_v2_chats whatsapp_v2_chats_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_chats
    ADD CONSTRAINT whatsapp_v2_chats_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.whatsapp_v2_instances(id) ON DELETE CASCADE;


--
-- Name: whatsapp_v2_chats whatsapp_v2_chats_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_chats
    ADD CONSTRAINT whatsapp_v2_chats_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: whatsapp_v2_chats whatsapp_v2_chats_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_chats
    ADD CONSTRAINT whatsapp_v2_chats_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_v2_instance_users whatsapp_v2_instance_users_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_instance_users
    ADD CONSTRAINT whatsapp_v2_instance_users_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.whatsapp_v2_instances(id) ON DELETE CASCADE;


--
-- Name: whatsapp_v2_instances whatsapp_v2_instances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_instances
    ADD CONSTRAINT whatsapp_v2_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_v2_messages whatsapp_v2_messages_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_messages
    ADD CONSTRAINT whatsapp_v2_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.whatsapp_v2_chats(id) ON DELETE CASCADE;


--
-- Name: whatsapp_v2_messages whatsapp_v2_messages_quoted_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_messages
    ADD CONSTRAINT whatsapp_v2_messages_quoted_message_id_fkey FOREIGN KEY (quoted_message_id) REFERENCES public.whatsapp_v2_messages(id) ON DELETE SET NULL;


--
-- Name: whatsapp_v2_messages whatsapp_v2_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_v2_messages
    ADD CONSTRAINT whatsapp_v2_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: whatsapp_v2_chats Admins can delete chats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete chats" ON public.whatsapp_v2_chats FOR DELETE USING (((tenant_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), tenant_id)));


--
-- Name: contacts Admins can delete contacts in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete contacts in their org" ON public.contacts FOR DELETE USING (((organization_id = public.current_tenant_id()) AND public.is_tenant_admin(auth.uid(), organization_id)));


--
-- Name: contact_identities Admins can delete identities in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete identities in their org" ON public.contact_identities FOR DELETE USING (((organization_id = public.current_tenant_id()) AND public.is_tenant_admin(auth.uid(), organization_id)));


--
-- Name: post_sale_surveys Admins can delete post_sale_surveys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete post_sale_surveys" ON public.post_sale_surveys FOR DELETE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: product_questions Admins can delete questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete questions" ON public.product_questions FOR DELETE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: sales Admins can delete sales of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete sales of their org" ON public.sales FOR DELETE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: teams Admins can delete teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: profiles Admins can insert any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert any profile" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_questions Admins can insert questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert questions" ON public.product_questions FOR INSERT WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can insert teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert teams" ON public.teams FOR INSERT WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_acquirers Admins can manage acquirers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage acquirers" ON public.payment_acquirers USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_bank_destinations Admins can manage bank destinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage bank destinations" ON public.payment_bank_destinations USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: shipping_carriers Admins can manage carriers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage carriers" ON public.shipping_carriers USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_cnpj_destinations Admins can manage cnpj destinations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage cnpj destinations" ON public.payment_cnpj_destinations USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_cost_centers Admins can manage cost centers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage cost centers" ON public.payment_cost_centers USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: whatsapp_v2_instance_users Admins can manage instance users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage instance users" ON public.whatsapp_v2_instance_users USING ((EXISTS ( SELECT 1
   FROM public.whatsapp_v2_instances wi
  WHERE ((wi.id = whatsapp_v2_instance_users.instance_id) AND (wi.tenant_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), wi.tenant_id)))));


--
-- Name: lead_sources Admins can manage lead sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage lead sources" ON public.lead_sources TO authenticated USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: non_purchase_reasons Admins can manage non_purchase_reasons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage non_purchase_reasons" ON public.non_purchase_reasons USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_methods Admins can manage payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage payment methods" ON public.payment_methods USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: product_standard_questions Admins can manage product standard questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage product standard questions" ON public.product_standard_questions USING ((product_id IN ( SELECT lead_products.id
   FROM public.lead_products
  WHERE (lead_products.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::public.org_role, 'admin'::public.org_role]))))))));


--
-- Name: product_user_visibility Admins can manage product visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage product visibility" ON public.product_user_visibility USING (public.is_org_admin(auth.uid(), organization_id)) WITH CHECK (public.is_org_admin(auth.uid(), organization_id));


--
-- Name: standard_question_options Admins can manage question options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage question options" ON public.standard_question_options USING ((question_id IN ( SELECT standard_questions.id
   FROM public.standard_questions
  WHERE (standard_questions.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::public.org_role, 'admin'::public.org_role]))))))));


--
-- Name: delivery_region_users Admins can manage region users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage region users" ON public.delivery_region_users USING ((EXISTS ( SELECT 1
   FROM public.delivery_regions dr
  WHERE ((dr.id = delivery_region_users.region_id) AND (dr.organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), dr.organization_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.delivery_regions dr
  WHERE ((dr.id = delivery_region_users.region_id) AND (dr.organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), dr.organization_id)))));


--
-- Name: delivery_regions Admins can manage regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage regions" ON public.delivery_regions USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: delivery_return_reasons Admins can manage return reasons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage return reasons" ON public.delivery_return_reasons USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: delivery_region_schedules Admins can manage schedules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage schedules" ON public.delivery_region_schedules USING ((EXISTS ( SELECT 1
   FROM public.delivery_regions dr
  WHERE ((dr.id = delivery_region_schedules.region_id) AND (dr.organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), dr.organization_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.delivery_regions dr
  WHERE ((dr.id = delivery_region_schedules.region_id) AND (dr.organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), dr.organization_id)))));


--
-- Name: standard_questions Admins can manage standard questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage standard questions" ON public.standard_questions USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::public.org_role, 'admin'::public.org_role]))))));


--
-- Name: sales_manager_team_members Admins can manage team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage team members" ON public.sales_manager_team_members USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: payment_method_transaction_fees Admins can manage transaction fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage transaction fees" ON public.payment_method_transaction_fees USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: user_permissions Admins can manage user permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage user permissions" ON public.user_permissions USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: interested_leads Admins can update interested leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update interested leads" ON public.interested_leads FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_questions Admins can update questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update questions" ON public.product_questions FOR UPDATE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: user_roles Admins can update roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: teams Admins can update teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: interested_leads Admins can view all interested leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all interested leads" ON public.interested_leads FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Anyone authenticated can insert their profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone authenticated can insert their profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: error_logs Anyone can insert error logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert error logs" ON public.error_logs FOR INSERT WITH CHECK (true);


--
-- Name: interested_leads Anyone can insert interested leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert interested leads" ON public.interested_leads FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: subscription_plans Anyone can view active plans or master admin sees all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active plans or master admin sees all" ON public.subscription_plans FOR SELECT USING (((is_active = true) OR public.is_master_admin(auth.uid())));


--
-- Name: discount_coupons Authenticated users can view active coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view active coupons" ON public.discount_coupons FOR SELECT TO authenticated USING (((is_active = true) AND ((valid_until IS NULL) OR (valid_until > now()))));


--
-- Name: whatsapp_media_tokens Deny all for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny all for authenticated users" ON public.whatsapp_media_tokens TO authenticated USING (false) WITH CHECK (false);


--
-- Name: organization_members Master admin can insert organization members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can insert organization members" ON public.organization_members FOR INSERT WITH CHECK (public.is_master_admin(auth.uid()));


--
-- Name: organizations Master admin can insert organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can insert organizations" ON public.organizations FOR INSERT WITH CHECK (public.is_master_admin(auth.uid()));


--
-- Name: subscriptions Master admin can insert subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can insert subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (public.is_master_admin(auth.uid()));


--
-- Name: whatsapp_instances Master admin can manage all instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can manage all instances" ON public.whatsapp_instances USING (public.is_master_admin(auth.uid()));


--
-- Name: organization_whatsapp_providers Master admin can manage all org providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can manage all org providers" ON public.organization_whatsapp_providers USING (public.is_master_admin(auth.uid()));


--
-- Name: discount_coupons Master admin can manage coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can manage coupons" ON public.discount_coupons USING (public.is_master_admin(auth.uid()));


--
-- Name: organization_whatsapp_credits Master admin can manage org credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can manage org credits" ON public.organization_whatsapp_credits USING (public.is_master_admin(auth.uid()));


--
-- Name: organizations Master admin can update all organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can update all organizations" ON public.organizations FOR UPDATE USING (public.is_master_admin(auth.uid()));


--
-- Name: profiles Master admin can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can update all profiles" ON public.profiles FOR UPDATE USING (public.is_master_admin(auth.uid()));


--
-- Name: subscriptions Master admin can update all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can update all subscriptions" ON public.subscriptions FOR UPDATE USING (public.is_master_admin(auth.uid()));


--
-- Name: onboarding_data Master admin can view all onboarding data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can view all onboarding data" ON public.onboarding_data FOR SELECT USING (public.is_master_admin(auth.uid()));


--
-- Name: organization_members Master admin can view all organization members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can view all organization members" ON public.organization_members FOR SELECT USING (public.is_master_admin(auth.uid()));


--
-- Name: organizations Master admin can view all organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can view all organizations" ON public.organizations FOR SELECT USING (public.is_master_admin(auth.uid()));


--
-- Name: subscriptions Master admin can view all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Master admin can view all subscriptions" ON public.subscriptions FOR SELECT USING (public.is_master_admin(auth.uid()));


--
-- Name: whatsapp_instances Org admins can delete instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can delete instances" ON public.whatsapp_instances FOR DELETE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: whatsapp_v2_instances Org admins can delete instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can delete instances" ON public.whatsapp_v2_instances FOR DELETE USING (((tenant_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), tenant_id)));


--
-- Name: organization_members Org admins can delete members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can delete members" ON public.organization_members FOR DELETE USING (public.is_org_admin(auth.uid(), organization_id));


--
-- Name: organization_funnel_stages Org admins can delete stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can delete stages" ON public.organization_funnel_stages FOR DELETE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: whatsapp_instances Org admins can insert instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can insert instances" ON public.whatsapp_instances FOR INSERT WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: whatsapp_v2_instances Org admins can insert instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can insert instances" ON public.whatsapp_v2_instances FOR INSERT WITH CHECK (((tenant_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), tenant_id)));


--
-- Name: organization_members Org admins can insert members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can insert members" ON public.organization_members FOR INSERT WITH CHECK (public.is_org_admin(auth.uid(), organization_id));


--
-- Name: organization_funnel_stages Org admins can insert stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can insert stages" ON public.organization_funnel_stages FOR INSERT WITH CHECK (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: whatsapp_bot_configs Org admins can manage bot configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage bot configs" ON public.whatsapp_bot_configs USING ((EXISTS ( SELECT 1
   FROM public.whatsapp_instances wi
  WHERE ((wi.id = whatsapp_bot_configs.instance_id) AND (wi.organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), wi.organization_id)))));


--
-- Name: whatsapp_instance_users Org admins can manage instance permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can manage instance permissions" ON public.whatsapp_instance_users USING ((EXISTS ( SELECT 1
   FROM public.whatsapp_instances wi
  WHERE ((wi.id = whatsapp_instance_users.instance_id) AND (wi.organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), wi.organization_id)))));


--
-- Name: whatsapp_instances Org admins can update instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update instances" ON public.whatsapp_instances FOR UPDATE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: whatsapp_v2_instances Org admins can update instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update instances" ON public.whatsapp_v2_instances FOR UPDATE USING (((tenant_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), tenant_id)));


--
-- Name: organization_members Org admins can update members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update members" ON public.organization_members FOR UPDATE USING (public.is_org_admin(auth.uid(), organization_id));


--
-- Name: profiles Org admins can update profiles of their org members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update profiles of their org members" ON public.profiles FOR UPDATE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), public.get_user_organization_id())));


--
-- Name: organization_funnel_stages Org admins can update stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update stages" ON public.organization_funnel_stages FOR UPDATE USING (((organization_id = public.get_user_organization_id()) AND public.is_org_admin(auth.uid(), organization_id)));


--
-- Name: subscriptions Org admins can update subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update subscription" ON public.subscriptions FOR UPDATE USING (public.is_org_admin(auth.uid(), organization_id));


--
-- Name: organizations Org admins can update their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admins can update their organization" ON public.organizations FOR UPDATE USING (public.is_org_admin(auth.uid(), id));


--
-- Name: profiles Org members can view profiles of same org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view profiles of same org" ON public.profiles FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: error_logs Org members can view their own error logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view their own error logs" ON public.error_logs FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: lead_products Owners can manage lead products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage lead products" ON public.lead_products USING (((organization_id = public.get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.user_id = auth.uid()) AND (om.organization_id = lead_products.organization_id) AND (om.role = 'owner'::public.org_role)))))) WITH CHECK (((organization_id = public.get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.user_id = auth.uid()) AND (om.organization_id = lead_products.organization_id) AND (om.role = 'owner'::public.org_role))))));


--
-- Name: role_permissions Owners can manage permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage permissions" ON public.role_permissions USING (((organization_id = public.get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.organization_id = role_permissions.organization_id) AND (organization_members.role = 'owner'::public.org_role))))));


--
-- Name: temp_password_resets Service role only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only" ON public.temp_password_resets USING (false);


--
-- Name: subscription_plans Subscribed org can view assigned plan; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Subscribed org can view assigned plan" ON public.subscription_plans FOR SELECT TO authenticated USING ((public.is_master_admin(auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.subscriptions s
  WHERE ((s.organization_id = public.current_tenant_id()) AND (s.plan_id = subscription_plans.id))))));


--
-- Name: lead_followups Users can create followups in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create followups in their organization" ON public.lead_followups FOR INSERT WITH CHECK ((organization_id IN ( SELECT om.organization_id
   FROM public.organization_members om
  WHERE (om.user_id = auth.uid()))));


--
-- Name: product_faqs Users can delete FAQs of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete FAQs of their org" ON public.product_faqs FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_addresses Users can delete addresses of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete addresses of their org" ON public.lead_addresses FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_question_answers Users can delete answers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete answers of their org" ON public.lead_product_question_answers FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_followups Users can delete followups in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete followups in their organization" ON public.lead_followups FOR DELETE USING ((organization_id IN ( SELECT om.organization_id
   FROM public.organization_members om
  WHERE (om.user_id = auth.uid()))));


--
-- Name: product_ingredients Users can delete ingredients of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete ingredients of their org" ON public.product_ingredients FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_installments Users can delete installments of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete installments of their org" ON public.sale_installments FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: product_price_kits Users can delete kits of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete kits of their org" ON public.product_price_kits FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_events Users can delete lead_events of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete lead_events of their org" ON public.lead_events FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_answers Users can delete lead_product_answers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete lead_product_answers of their org" ON public.lead_product_answers FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_responsibles Users can delete lead_responsibles of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete lead_responsibles of their org" ON public.lead_responsibles FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: leads Users can delete leads in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete leads in their org" ON public.leads FOR DELETE TO authenticated USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: sale_items Users can delete sale items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete sale items" ON public.sale_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.organization_id = public.get_user_organization_id())))));


--
-- Name: google_tokens Users can delete their own google tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own google tokens" ON public.google_tokens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: sac_ticket_users Users can delete ticket users of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete ticket users of their org" ON public.sac_ticket_users FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sac_tickets Users can delete tickets of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete tickets of their org" ON public.sac_tickets FOR DELETE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: discount_coupons Users can increment coupon usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can increment coupon usage" ON public.discount_coupons FOR UPDATE USING (true) WITH CHECK ((current_uses >= 0));


--
-- Name: product_faqs Users can insert FAQs in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert FAQs in their org" ON public.product_faqs FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_addresses Users can insert addresses in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert addresses in their org" ON public.lead_addresses FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_question_answers Users can insert answers in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert answers in their org" ON public.lead_product_question_answers FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: discount_authorizations Users can insert authorizations for their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert authorizations for their organization" ON public.discount_authorizations FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_carrier_tracking Users can insert carrier tracking to their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert carrier tracking to their org" ON public.sale_carrier_tracking FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: whatsapp_v2_chats Users can insert chats in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert chats in their org" ON public.whatsapp_v2_chats FOR INSERT WITH CHECK ((tenant_id = public.get_user_organization_id()));


--
-- Name: sac_ticket_comments Users can insert comments in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert comments in their org" ON public.sac_ticket_comments FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: contacts Users can insert contacts in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert contacts in their org" ON public.contacts FOR INSERT WITH CHECK ((organization_id = public.current_tenant_id()));


--
-- Name: whatsapp_conversations Users can insert conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert conversations" ON public.whatsapp_conversations FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: installment_history Users can insert history in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert history in their org" ON public.installment_history FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: contact_identities Users can insert identities in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert identities in their org" ON public.contact_identities FOR INSERT WITH CHECK ((organization_id = public.current_tenant_id()));


--
-- Name: product_ingredients Users can insert ingredients in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert ingredients in their org" ON public.product_ingredients FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_installments Users can insert installments in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert installments in their org" ON public.sale_installments FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_kit_rejections Users can insert kit rejections in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert kit rejections in their organization" ON public.lead_kit_rejections FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: product_price_kits Users can insert kits in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert kits in their org" ON public.product_price_kits FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_events Users can insert lead_events in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert lead_events in their org" ON public.lead_events FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_answers Users can insert lead_product_answers in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert lead_product_answers in their org" ON public.lead_product_answers FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_responsibles Users can insert lead_responsibles in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert lead_responsibles in their org" ON public.lead_responsibles FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: leads Users can insert leads in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert leads in their org" ON public.leads FOR INSERT TO authenticated WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: continuous_medications Users can insert medications in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert medications in their organization" ON public.continuous_medications FOR INSERT WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: whatsapp_messages Users can insert messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert messages" ON public.whatsapp_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.whatsapp_conversations wc
     JOIN public.whatsapp_instance_users wiu ON ((wiu.instance_id = wc.instance_id)))
  WHERE ((wc.id = whatsapp_messages.conversation_id) AND (wiu.user_id = auth.uid()) AND (wiu.can_send = true)))));


--
-- Name: whatsapp_v2_messages Users can insert messages in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert messages in their org" ON public.whatsapp_v2_messages FOR INSERT WITH CHECK ((tenant_id = public.get_user_organization_id()));


--
-- Name: post_sale_surveys Users can insert post_sale_surveys in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert post_sale_surveys in their org" ON public.post_sale_surveys FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_changes_log Users can insert sale changes logs for their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sale changes logs for their organization" ON public.sale_changes_log FOR INSERT WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: sale_checkpoints Users can insert sale checkpoints to their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sale checkpoints to their org" ON public.sale_checkpoints FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_status_history Users can insert sale history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sale history" ON public.sale_status_history FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_items Users can insert sale items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sale items" ON public.sale_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.organization_id = public.get_user_organization_id())))));


--
-- Name: sales Users can insert sales in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert sales in their org" ON public.sales FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_source_history Users can insert source history in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert source history in their org" ON public.lead_source_history FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_stage_history Users can insert stage history for their org leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert stage history for their org leads" ON public.lead_stage_history FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: stock_movements Users can insert stock movements in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert stock movements in their org" ON public.stock_movements FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: onboarding_data Users can insert their org onboarding data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their org onboarding data" ON public.onboarding_data FOR INSERT WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));


--
-- Name: google_tokens Users can insert their own google tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own google tokens" ON public.google_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_onboarding_progress Users can insert their own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own onboarding progress" ON public.user_onboarding_progress FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: receptive_attendances Users can insert their own receptive_attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own receptive_attendances" ON public.receptive_attendances FOR INSERT WITH CHECK (((organization_id = public.get_user_organization_id()) AND (user_id = auth.uid())));


--
-- Name: sac_ticket_users Users can insert ticket users in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert ticket users in their org" ON public.sac_ticket_users FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: sac_tickets Users can insert tickets in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert tickets in their org" ON public.sac_tickets FOR INSERT WITH CHECK ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_standard_question_answers Users can manage answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage answers" ON public.lead_standard_question_answers USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: product_faqs Users can update FAQs of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update FAQs of their org" ON public.product_faqs FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_addresses Users can update addresses of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update addresses of their org" ON public.lead_addresses FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_question_answers Users can update answers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update answers of their org" ON public.lead_product_question_answers FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: whatsapp_v2_chats Users can update chats in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update chats in their org" ON public.whatsapp_v2_chats FOR UPDATE USING ((tenant_id = public.get_user_organization_id()));


--
-- Name: contacts Users can update contacts in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update contacts in their org" ON public.contacts FOR UPDATE USING ((organization_id = public.current_tenant_id()));


--
-- Name: whatsapp_conversations Users can update conversations they have access to; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update conversations they have access to" ON public.whatsapp_conversations FOR UPDATE USING (((organization_id = public.get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.whatsapp_instance_users wiu
  WHERE ((wiu.instance_id = whatsapp_conversations.instance_id) AND (wiu.user_id = auth.uid()))))));


--
-- Name: lead_followups Users can update followups in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update followups in their organization" ON public.lead_followups FOR UPDATE USING ((organization_id IN ( SELECT om.organization_id
   FROM public.organization_members om
  WHERE (om.user_id = auth.uid()))));


--
-- Name: contact_identities Users can update identities in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update identities in their org" ON public.contact_identities FOR UPDATE USING ((organization_id = public.current_tenant_id()));


--
-- Name: product_ingredients Users can update ingredients of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update ingredients of their org" ON public.product_ingredients FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_installments Users can update installments of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update installments of their org" ON public.sale_installments FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: product_price_kits Users can update kits of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update kits of their org" ON public.product_price_kits FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_events Users can update lead_events of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update lead_events of their org" ON public.lead_events FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_answers Users can update lead_product_answers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update lead_product_answers of their org" ON public.lead_product_answers FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_responsibles Users can update lead_responsibles of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update lead_responsibles of their org" ON public.lead_responsibles FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: leads Users can update leads in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update leads in their org" ON public.leads FOR UPDATE TO authenticated USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: continuous_medications Users can update medications in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update medications in their organization" ON public.continuous_medications FOR UPDATE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: whatsapp_v2_messages Users can update message status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update message status" ON public.whatsapp_v2_messages FOR UPDATE USING ((tenant_id = public.get_user_organization_id()));


--
-- Name: post_sale_surveys Users can update post_sale_surveys of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update post_sale_surveys of their org" ON public.post_sale_surveys FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_checkpoints Users can update sale checkpoints from their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update sale checkpoints from their org" ON public.sale_checkpoints FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_items Users can update sale items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update sale items" ON public.sale_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.organization_id = public.get_user_organization_id())))));


--
-- Name: sales Users can update sales of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update sales of their org" ON public.sales FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: onboarding_data Users can update their org onboarding data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their org onboarding data" ON public.onboarding_data FOR UPDATE USING (public.user_belongs_to_org(auth.uid(), organization_id));


--
-- Name: google_tokens Users can update their own google tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own google tokens" ON public.google_tokens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_onboarding_progress Users can update their own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own onboarding progress" ON public.user_onboarding_progress FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: receptive_attendances Users can update their own receptive_attendances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own receptive_attendances" ON public.receptive_attendances FOR UPDATE USING (((organization_id = public.get_user_organization_id()) AND (user_id = auth.uid())));


--
-- Name: temp_password_resets Users can update their own temp password resets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own temp password resets" ON public.temp_password_resets FOR UPDATE USING (((auth.jwt() ->> 'email'::text) = email)) WITH CHECK (((auth.jwt() ->> 'email'::text) = email));


--
-- Name: sac_tickets Users can update tickets of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update tickets of their org" ON public.sac_tickets FOR UPDATE USING ((organization_id = public.get_user_organization_id()));


--
-- Name: product_faqs Users can view FAQs of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view FAQs of their org" ON public.product_faqs FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: payment_acquirers Users can view acquirers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view acquirers of their org" ON public.payment_acquirers FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_addresses Users can view addresses of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view addresses of their org" ON public.lead_addresses FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_question_answers Users can view answers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view answers of their org" ON public.lead_product_question_answers FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: discount_authorizations Users can view authorizations from their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view authorizations from their organization" ON public.discount_authorizations FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: payment_bank_destinations Users can view bank destinations of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bank destinations of their org" ON public.payment_bank_destinations FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: whatsapp_bot_configs Users can view bot configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bot configs" ON public.whatsapp_bot_configs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.whatsapp_instances wi
  WHERE ((wi.id = whatsapp_bot_configs.instance_id) AND (wi.organization_id = public.get_user_organization_id())))));


--
-- Name: sale_carrier_tracking Users can view carrier tracking from their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view carrier tracking from their org" ON public.sale_carrier_tracking FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: shipping_carriers Users can view carriers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view carriers of their org" ON public.shipping_carriers FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: whatsapp_v2_chats Users can view chats of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view chats of their org" ON public.whatsapp_v2_chats FOR SELECT USING ((tenant_id = public.get_user_organization_id()));


--
-- Name: payment_cnpj_destinations Users can view cnpj destinations of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view cnpj destinations of their org" ON public.payment_cnpj_destinations FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sac_ticket_comments Users can view comments of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view comments of their org" ON public.sac_ticket_comments FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: contacts Users can view contacts of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view contacts of their org" ON public.contacts FOR SELECT USING ((organization_id = public.current_tenant_id()));


--
-- Name: payment_cost_centers Users can view cost centers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view cost centers of their org" ON public.payment_cost_centers FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_followups Users can view followups in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view followups in their organization" ON public.lead_followups FOR SELECT USING ((organization_id IN ( SELECT om.organization_id
   FROM public.organization_members om
  WHERE (om.user_id = auth.uid()))));


--
-- Name: installment_history Users can view history of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view history of their org" ON public.installment_history FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: contact_identities Users can view identities of their contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view identities of their contacts" ON public.contact_identities FOR SELECT USING ((organization_id = public.current_tenant_id()));


--
-- Name: product_ingredients Users can view ingredients of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ingredients of their org" ON public.product_ingredients FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_installments Users can view installments of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view installments of their org" ON public.sale_installments FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: whatsapp_instance_users Users can view instance permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view instance permissions" ON public.whatsapp_instance_users FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.whatsapp_instances wi
  WHERE ((wi.id = whatsapp_instance_users.instance_id) AND (wi.organization_id = public.get_user_organization_id())))));


--
-- Name: whatsapp_v2_instance_users Users can view instance users of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view instance users of their org" ON public.whatsapp_v2_instance_users FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.whatsapp_v2_instances wi
  WHERE ((wi.id = whatsapp_v2_instance_users.instance_id) AND (wi.tenant_id = public.get_user_organization_id())))));


--
-- Name: whatsapp_v2_instances Users can view instances of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view instances of their org" ON public.whatsapp_v2_instances FOR SELECT USING ((tenant_id = public.get_user_organization_id()));


--
-- Name: lead_kit_rejections Users can view kit rejections in their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view kit rejections in their organization" ON public.lead_kit_rejections FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: product_price_kits Users can view kits of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view kits of their org" ON public.product_price_kits FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_products Users can view lead products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lead products" ON public.lead_products FOR SELECT TO authenticated USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_sources Users can view lead sources; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lead sources" ON public.lead_sources FOR SELECT TO authenticated USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_events Users can view lead_events of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lead_events of their org" ON public.lead_events FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_product_answers Users can view lead_product_answers of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lead_product_answers of their org" ON public.lead_product_answers FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_responsibles Users can view lead_responsibles of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view lead_responsibles of their org" ON public.lead_responsibles FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: leads Users can view leads in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view leads in their org" ON public.leads FOR SELECT TO authenticated USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: continuous_medications Users can view medications from their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view medications from their organization" ON public.continuous_medications FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: organization_members Users can view members of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view members of their org" ON public.organization_members FOR SELECT USING (public.user_belongs_to_org(auth.uid(), organization_id));


--
-- Name: whatsapp_v2_messages Users can view messages of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages of their org" ON public.whatsapp_v2_messages FOR SELECT USING ((tenant_id = public.get_user_organization_id()));


--
-- Name: non_purchase_reasons Users can view non_purchase_reasons of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view non_purchase_reasons of their org" ON public.non_purchase_reasons FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: payment_methods Users can view payment methods of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view payment methods of their org" ON public.payment_methods FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: user_permissions Users can view permissions in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view permissions in their org" ON public.user_permissions FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: post_sale_surveys Users can view post_sale_surveys of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view post_sale_surveys of their org" ON public.post_sale_surveys FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: product_standard_questions Users can view product standard questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view product standard questions" ON public.product_standard_questions FOR SELECT USING ((product_id IN ( SELECT lead_products.id
   FROM public.lead_products
  WHERE (lead_products.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE (organization_members.user_id = auth.uid()))))));


--
-- Name: product_user_visibility Users can view product visibility for their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view product visibility for their org" ON public.product_user_visibility FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: standard_question_options Users can view question options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view question options" ON public.standard_question_options FOR SELECT USING ((question_id IN ( SELECT standard_questions.id
   FROM public.standard_questions
  WHERE (standard_questions.organization_id IN ( SELECT organization_members.organization_id
           FROM public.organization_members
          WHERE (organization_members.user_id = auth.uid()))))));


--
-- Name: product_questions Users can view questions of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view questions of their org" ON public.product_questions FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: receptive_attendances Users can view receptive_attendances of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view receptive_attendances of their org" ON public.receptive_attendances FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: delivery_region_users Users can view region users of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view region users of their org" ON public.delivery_region_users FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.delivery_regions dr
  WHERE ((dr.id = delivery_region_users.region_id) AND (dr.organization_id = public.get_user_organization_id())))));


--
-- Name: delivery_regions Users can view regions of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view regions of their org" ON public.delivery_regions FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: delivery_return_reasons Users can view return reasons of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view return reasons of their org" ON public.delivery_return_reasons FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_changes_log Users can view sale changes logs for their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sale changes logs for their organization" ON public.sale_changes_log FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: sale_checkpoints Users can view sale checkpoints from their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sale checkpoints from their org" ON public.sale_checkpoints FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_status_history Users can view sale history of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sale history of their org" ON public.sale_status_history FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sale_items Users can view sale items of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sale items of their org" ON public.sale_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.sales s
  WHERE ((s.id = sale_items.sale_id) AND (s.organization_id = public.get_user_organization_id())))));


--
-- Name: sales Users can view sales of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view sales of their org" ON public.sales FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: delivery_region_schedules Users can view schedules of their org regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view schedules of their org regions" ON public.delivery_region_schedules FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.delivery_regions dr
  WHERE ((dr.id = delivery_region_schedules.region_id) AND (dr.organization_id = public.get_user_organization_id())))));


--
-- Name: lead_source_history Users can view source history of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view source history of their org" ON public.lead_source_history FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: lead_stage_history Users can view stage history of their org leads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view stage history of their org leads" ON public.lead_stage_history FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: organization_funnel_stages Users can view stages of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view stages of their org" ON public.organization_funnel_stages FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: stock_movements Users can view stock movements of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view stock movements of their org" ON public.stock_movements FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sales_manager_team_members Users can view team members in their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view team members in their org" ON public.sales_manager_team_members FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: teams Users can view teams from their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view teams from their organization" ON public.teams FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: organization_whatsapp_credits Users can view their org credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org credits" ON public.organization_whatsapp_credits FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: whatsapp_instances Users can view their org instances; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org instances" ON public.whatsapp_instances FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: onboarding_data Users can view their org onboarding data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org onboarding data" ON public.onboarding_data FOR SELECT USING (public.user_belongs_to_org(auth.uid(), organization_id));


--
-- Name: role_permissions Users can view their org permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org permissions" ON public.role_permissions FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: organization_whatsapp_providers Users can view their org providers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org providers" ON public.organization_whatsapp_providers FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: subscriptions Users can view their org subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their org subscription" ON public.subscriptions FOR SELECT USING (public.user_belongs_to_org(auth.uid(), organization_id));


--
-- Name: organizations Users can view their organization; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their organization" ON public.organizations FOR SELECT USING (public.user_belongs_to_org(auth.uid(), id));


--
-- Name: lead_standard_question_answers Users can view their organization's answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their organization's answers" ON public.lead_standard_question_answers FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: standard_questions Users can view their organization's standard questions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their organization's standard questions" ON public.standard_questions FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM public.organization_members
  WHERE (organization_members.user_id = auth.uid()))));


--
-- Name: google_tokens Users can view their own google tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own google tokens" ON public.google_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: organization_members Users can view their own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own membership" ON public.organization_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_onboarding_progress Users can view their own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own onboarding progress" ON public.user_onboarding_progress FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_permissions Users can view their own permissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own permissions" ON public.user_permissions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: temp_password_resets Users can view their own temp password resets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own temp password resets" ON public.temp_password_resets FOR SELECT USING (((auth.jwt() ->> 'email'::text) = email));


--
-- Name: sac_ticket_users Users can view ticket users of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view ticket users of their org" ON public.sac_ticket_users FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: sac_tickets Users can view tickets of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view tickets of their org" ON public.sac_tickets FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: payment_method_transaction_fees Users can view transaction fees of their org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view transaction fees of their org" ON public.payment_method_transaction_fees FOR SELECT USING ((organization_id = public.get_user_organization_id()));


--
-- Name: contact_identities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_identities ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: continuous_medications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.continuous_medications ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_region_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_region_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_region_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_region_users ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_regions ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_return_reasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_return_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: discount_authorizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discount_authorizations ENABLE ROW LEVEL SECURITY;

--
-- Name: discount_coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: error_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: google_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: installment_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.installment_history ENABLE ROW LEVEL SECURITY;

--
-- Name: interested_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interested_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_followups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_kit_rejections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_kit_rejections ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_product_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_product_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_product_question_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_product_question_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_products ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_responsibles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_responsibles ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_source_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_source_history ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_stage_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_standard_question_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_standard_question_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: non_purchase_reasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.non_purchase_reasons ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.onboarding_data ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_funnel_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_funnel_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_whatsapp_credits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_whatsapp_credits ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_whatsapp_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_whatsapp_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_acquirers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_acquirers ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_bank_destinations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_bank_destinations ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_cnpj_destinations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_cnpj_destinations ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_cost_centers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_cost_centers ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_method_transaction_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_method_transaction_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: post_sale_surveys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_sale_surveys ENABLE ROW LEVEL SECURITY;

--
-- Name: product_faqs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: product_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: product_price_kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_price_kits ENABLE ROW LEVEL SECURITY;

--
-- Name: product_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: product_standard_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_standard_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: product_user_visibility; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_user_visibility ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: receptive_attendances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receptive_attendances ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: sac_ticket_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sac_ticket_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: sac_ticket_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sac_ticket_users ENABLE ROW LEVEL SECURITY;

--
-- Name: sac_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sac_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_carrier_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_carrier_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_changes_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_changes_log ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_checkpoints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_checkpoints ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_installments ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sale_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_manager_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales_manager_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_carriers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

--
-- Name: standard_question_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.standard_question_options ENABLE ROW LEVEL SECURITY;

--
-- Name: standard_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.standard_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_password_resets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_password_resets ENABLE ROW LEVEL SECURITY;

--
-- Name: user_onboarding_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_bot_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_bot_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_conversations whatsapp_conversations_select_by_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY whatsapp_conversations_select_by_org ON public.whatsapp_conversations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = whatsapp_conversations.organization_id) AND (om.user_id = auth.uid())))));


--
-- Name: whatsapp_instance_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_instance_users ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_media_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_media_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_messages whatsapp_messages_select_by_org; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY whatsapp_messages_select_by_org ON public.whatsapp_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.whatsapp_conversations c
     JOIN public.organization_members om ON ((om.organization_id = c.organization_id)))
  WHERE ((c.id = whatsapp_messages.conversation_id) AND (om.user_id = auth.uid())))));


--
-- Name: whatsapp_v2_chats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_v2_chats ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_v2_instance_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_v2_instance_users ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_v2_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_v2_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_v2_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_v2_messages ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;
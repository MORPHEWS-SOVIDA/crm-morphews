-- =====================================================
-- Add cost_center_id to pos_terminals for Multi-CNPJ support
-- =====================================================
ALTER TABLE public.pos_terminals 
    ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.payment_cost_centers(id) ON DELETE SET NULL;

-- Index for filtering by cost center
CREATE INDEX IF NOT EXISTS idx_pos_terminals_cost_center ON public.pos_terminals(cost_center_id) WHERE cost_center_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.pos_terminals.cost_center_id IS 'Centro de custo/CNPJ ao qual esta máquina pertence';

-- =====================================================
-- Index for querying by user (multiple terminals per user)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_pos_terminal_assignments_user_active 
    ON public.pos_terminal_assignments(user_id, pos_terminal_id) 
    WHERE unassigned_at IS NULL;

-- =====================================================
-- Add payment_type enum for delivery completion
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_payment_type') THEN
        CREATE TYPE public.delivery_payment_type AS ENUM ('cash', 'prepaid', 'pos_card');
    END IF;
END $$;

-- =====================================================
-- Add delivery payment tracking to sales
-- =====================================================
ALTER TABLE public.sales 
    ADD COLUMN IF NOT EXISTS delivery_payment_type public.delivery_payment_type,
    ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivery_confirmed_by UUID REFERENCES public.profiles(user_id);

-- Comment
COMMENT ON COLUMN public.sales.delivery_payment_type IS 'cash = dinheiro, prepaid = já estava pago (PIX/online), pos_card = máquina de cartão';

-- =====================================================
-- Function to get unmatched POS transactions for a user
-- Used when motoboy selects "Máquina" to link transaction
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_unmatched_pos_transactions_for_user(
    p_user_id UUID,
    p_organization_id UUID
)
RETURNS TABLE (
    id UUID,
    amount_cents INTEGER,
    card_brand VARCHAR,
    card_last_digits VARCHAR,
    transaction_type VARCHAR,
    nsu VARCHAR,
    authorization_code VARCHAR,
    gateway_type public.pos_gateway_type,
    terminal_name VARCHAR,
    gateway_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id,
        pt.amount_cents,
        pt.card_brand,
        pt.card_last_digits,
        pt.transaction_type,
        pt.nsu,
        pt.authorization_code,
        pt.gateway_type,
        term.name::VARCHAR AS terminal_name,
        pt.gateway_timestamp,
        pt.created_at
    FROM pos_transactions pt
    LEFT JOIN pos_terminals term ON term.id = pt.pos_terminal_id
    LEFT JOIN pos_terminal_assignments pta ON pta.pos_terminal_id = pt.pos_terminal_id 
        AND pta.unassigned_at IS NULL
    WHERE pt.organization_id = p_organization_id
      AND pt.match_status = 'pending'
      AND pt.sale_id IS NULL
      AND (
          -- Either the transaction is from a terminal assigned to this user
          pta.user_id = p_user_id
          -- Or it's an orphan transaction (no terminal or no assignment)
          OR pt.pos_terminal_id IS NULL
          OR pta.id IS NULL
      )
    ORDER BY pt.created_at DESC
    LIMIT 50;
END;
$$;

-- =====================================================
-- Function to link a POS transaction to a sale (manual matching)
-- =====================================================
CREATE OR REPLACE FUNCTION public.link_pos_transaction_to_sale(
    p_transaction_id UUID,
    p_sale_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_tx_amount INTEGER;
    v_sale_total INTEGER;
BEGIN
    -- Get transaction details
    SELECT organization_id, amount_cents INTO v_org_id, v_tx_amount
    FROM pos_transactions WHERE id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found';
    END IF;
    
    -- Get sale total
    SELECT total_cents INTO v_sale_total
    FROM sales WHERE id = p_sale_id AND organization_id = v_org_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale not found or wrong organization';
    END IF;
    
    -- Update transaction
    UPDATE pos_transactions
    SET 
        sale_id = p_sale_id,
        match_status = 'matched',
        matched_at = now(),
        matched_by = p_user_id,
        matched_user_id = p_user_id,
        updated_at = now()
    WHERE id = p_transaction_id;
    
    -- Update sale
    UPDATE sales
    SET 
        pos_transaction_id = p_transaction_id,
        delivery_payment_type = 'pos_card',
        delivery_confirmed_at = now(),
        delivery_confirmed_by = p_user_id,
        status = CASE WHEN status = 'delivered' THEN status ELSE 'paid' END,
        payment_status = 'confirmed'
    WHERE id = p_sale_id;
    
    RETURN TRUE;
END;
$$;
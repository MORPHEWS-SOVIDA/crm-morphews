-- =====================================================
-- POS Terminals Integration for Motoboy/Counter Sales
-- =====================================================

-- Gateway types for POS terminals
CREATE TYPE public.pos_gateway_type AS ENUM ('getnet', 'pagarme', 'banrisul', 'vero', 'banricompras', 'stone');

-- Match status for POS transactions
CREATE TYPE public.pos_match_status AS ENUM ('pending', 'matched', 'orphan', 'manual');

-- =====================================================
-- Table: pos_terminals
-- Stores physical card machine configurations
-- =====================================================
CREATE TABLE public.pos_terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Gateway identification
    terminal_id VARCHAR(100) NOT NULL, -- ID sent by gateway (TID)
    serial_number VARCHAR(100), -- Physical serial number
    logical_number VARCHAR(50), -- Logical number (Getnet specific)
    gateway_type public.pos_gateway_type NOT NULL,
    
    -- Link to payment method for financial categorization
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
    
    -- User-friendly identification
    name VARCHAR(100) NOT NULL, -- Friendly name: "Máquina Azul 01"
    
    -- Assignment type: NULL = user assignment, 'counter' = counter pickup
    assignment_type VARCHAR(50) DEFAULT NULL, -- 'counter', 'pickup', NULL
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Gateway-specific configuration
    webhook_secret VARCHAR(255), -- For signature validation
    extra_config JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique terminal per org+gateway
    CONSTRAINT pos_terminals_org_gateway_terminal_unique UNIQUE (organization_id, gateway_type, terminal_id)
);

-- =====================================================
-- Table: pos_terminal_assignments
-- Links terminals to motoboys/sellers (who is carrying which machine)
-- =====================================================
CREATE TABLE public.pos_terminal_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    pos_terminal_id UUID NOT NULL REFERENCES public.pos_terminals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    
    -- Assignment period
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unassigned_at TIMESTAMPTZ, -- NULL = currently active
    
    -- Notes
    notes TEXT,
    
    -- Who made the assignment
    assigned_by UUID REFERENCES public.profiles(user_id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for finding current assignment
CREATE INDEX idx_pos_terminal_assignments_active 
    ON public.pos_terminal_assignments(pos_terminal_id, user_id) 
    WHERE unassigned_at IS NULL;

-- =====================================================
-- Table: pos_transactions
-- Stores all transactions received from POS webhooks
-- =====================================================
CREATE TABLE public.pos_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    pos_terminal_id UUID REFERENCES public.pos_terminals(id) ON DELETE SET NULL,
    
    -- Linked sale/installment (may be NULL if orphan)
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    sale_installment_id UUID REFERENCES public.sale_installments(id) ON DELETE SET NULL,
    
    -- Gateway transaction details
    gateway_type public.pos_gateway_type NOT NULL,
    gateway_transaction_id VARCHAR(100),
    nsu VARCHAR(50),
    authorization_code VARCHAR(50),
    
    -- Transaction values
    amount_cents INTEGER NOT NULL,
    fee_cents INTEGER DEFAULT 0,
    net_amount_cents INTEGER,
    
    -- Card details
    card_brand VARCHAR(50), -- visa, mastercard, elo, etc
    card_last_digits VARCHAR(4),
    transaction_type VARCHAR(20) NOT NULL, -- credit, debit, pix
    installments INTEGER DEFAULT 1,
    
    -- Timestamps from gateway
    gateway_timestamp TIMESTAMPTZ,
    
    -- Raw webhook payload for debugging/audit
    raw_payload JSONB,
    
    -- Matching status
    match_status public.pos_match_status NOT NULL DEFAULT 'pending',
    matched_at TIMESTAMPTZ,
    matched_by UUID REFERENCES public.profiles(user_id),
    matched_user_id UUID REFERENCES public.profiles(user_id), -- User assigned to terminal at time of transaction
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for matching algorithm
CREATE INDEX idx_pos_transactions_match ON public.pos_transactions(organization_id, match_status, amount_cents);
CREATE INDEX idx_pos_transactions_terminal ON public.pos_transactions(pos_terminal_id, created_at DESC);
CREATE INDEX idx_pos_transactions_sale ON public.pos_transactions(sale_id) WHERE sale_id IS NOT NULL;

-- =====================================================
-- Add POS reference to sales table
-- =====================================================
ALTER TABLE public.sales 
    ADD COLUMN IF NOT EXISTS pos_transaction_id UUID REFERENCES public.pos_transactions(id);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_sales_pos_transaction ON public.sales(pos_transaction_id) WHERE pos_transaction_id IS NOT NULL;

-- =====================================================
-- Add POS reference to sale_installments for reconciliation
-- =====================================================
ALTER TABLE public.sale_installments 
    ADD COLUMN IF NOT EXISTS pos_transaction_id UUID REFERENCES public.pos_transactions(id),
    ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(20) DEFAULT 'pending';

-- =====================================================
-- Enable RLS on all new tables
-- =====================================================
ALTER TABLE public.pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_terminal_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Helper function to check if user is org admin/manager
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = _user_id 
          AND om.organization_id = _org_id 
          AND om.role IN ('owner', 'admin', 'manager')
    );
$$;

-- =====================================================
-- RLS Policies for pos_terminals
-- =====================================================
CREATE POLICY "Users can view terminals in their organization" 
    ON public.pos_terminals FOR SELECT 
    USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can insert terminals" 
    ON public.pos_terminals FOR INSERT 
    WITH CHECK (
        organization_id = public.get_user_organization_id() 
        AND public.is_org_admin_or_manager(auth.uid(), organization_id)
    );

CREATE POLICY "Admins can update terminals" 
    ON public.pos_terminals FOR UPDATE 
    USING (
        organization_id = public.get_user_organization_id() 
        AND public.is_org_admin_or_manager(auth.uid(), organization_id)
    );

CREATE POLICY "Admins can delete terminals" 
    ON public.pos_terminals FOR DELETE 
    USING (
        organization_id = public.get_user_organization_id() 
        AND public.is_org_admin_or_manager(auth.uid(), organization_id)
    );

-- =====================================================
-- RLS Policies for pos_terminal_assignments
-- =====================================================
CREATE POLICY "Users can view assignments in their organization" 
    ON public.pos_terminal_assignments FOR SELECT 
    USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can insert assignments" 
    ON public.pos_terminal_assignments FOR INSERT 
    WITH CHECK (
        organization_id = public.get_user_organization_id() 
        AND public.is_org_admin_or_manager(auth.uid(), organization_id)
    );

CREATE POLICY "Admins can update assignments" 
    ON public.pos_terminal_assignments FOR UPDATE 
    USING (
        organization_id = public.get_user_organization_id() 
        AND public.is_org_admin_or_manager(auth.uid(), organization_id)
    );

CREATE POLICY "Admins can delete assignments" 
    ON public.pos_terminal_assignments FOR DELETE 
    USING (
        organization_id = public.get_user_organization_id() 
        AND public.is_org_admin_or_manager(auth.uid(), organization_id)
    );

-- =====================================================
-- RLS Policies for pos_transactions
-- =====================================================
CREATE POLICY "Users can view transactions in their organization" 
    ON public.pos_transactions FOR SELECT 
    USING (organization_id = public.get_user_organization_id());

CREATE POLICY "System can insert transactions" 
    ON public.pos_transactions FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Admins can update transactions" 
    ON public.pos_transactions FOR UPDATE 
    USING (
        organization_id = public.get_user_organization_id() 
        AND public.is_org_admin_or_manager(auth.uid(), organization_id)
    );

-- =====================================================
-- Trigger to update updated_at
-- =====================================================
CREATE TRIGGER update_pos_terminals_updated_at
    BEFORE UPDATE ON public.pos_terminals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pos_transactions_updated_at
    BEFORE UPDATE ON public.pos_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE public.pos_terminals IS 'Physical card machine configurations linked to payment methods and assignable to motoboys/counters';
COMMENT ON TABLE public.pos_terminal_assignments IS 'History of which user was carrying which machine at which time';
COMMENT ON TABLE public.pos_transactions IS 'All transactions received from POS webhooks for matching with sales';
COMMENT ON COLUMN public.pos_terminals.assignment_type IS 'NULL for user assignment, "counter" for counter pickup, "pickup" for other fixed locations';
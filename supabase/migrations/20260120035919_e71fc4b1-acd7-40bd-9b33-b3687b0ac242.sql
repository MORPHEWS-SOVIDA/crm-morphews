-- Criar função atômica para assumir lead com lock de concorrência
-- Isso previne que dois vendedores assumam o mesmo lead simultaneamente
CREATE OR REPLACE FUNCTION public.claim_lead(
    p_lead_id uuid,
    p_user_id uuid,
    p_organization_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_count integer;
    v_result json;
BEGIN
    -- Lock the lead row to prevent race conditions
    PERFORM id FROM leads WHERE id = p_lead_id FOR UPDATE;
    
    -- Check if lead already has any responsibles
    SELECT COUNT(*) INTO v_existing_count
    FROM lead_responsibles
    WHERE lead_id = p_lead_id;
    
    IF v_existing_count > 0 THEN
        -- Lead already claimed by someone else
        RETURN json_build_object(
            'success', false,
            'error', 'already_claimed',
            'message', 'Este lead já foi assumido por outro vendedor'
        );
    END IF;
    
    -- Claim the lead atomically
    INSERT INTO lead_responsibles (lead_id, user_id, organization_id)
    VALUES (p_lead_id, p_user_id, p_organization_id);
    
    -- Update the lead stage to indicate contact was made
    UPDATE leads 
    SET stage = 'contacted',
        updated_at = now()
    WHERE id = p_lead_id;
    
    RETURN json_build_object(
        'success', true,
        'lead_id', p_lead_id
    );
END;
$$;
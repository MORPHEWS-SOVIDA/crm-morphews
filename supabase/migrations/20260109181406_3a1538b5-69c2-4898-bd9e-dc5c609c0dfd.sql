-- Corrigir função de round-robin para fazer rodízio correto
CREATE OR REPLACE FUNCTION public.get_next_available_user_for_distribution(p_instance_id uuid, p_organization_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_next_user_id uuid;
    v_last_assigned_user_id uuid;
    v_last_assigned_at timestamp with time zone;
    v_current_time time;
BEGIN
    v_current_time := CURRENT_TIME;
    
    -- Pegar o último usuário atribuído e quando foi atribuído
    SELECT last_assigned_user_id INTO v_last_assigned_user_id
    FROM whatsapp_instances
    WHERE id = p_instance_id;
    
    -- Buscar próximo usuário elegível (round-robin real)
    -- Se tiver um último atribuído, pegar o próximo na ordem (por created_at)
    -- Se não tiver, pegar o primeiro
    IF v_last_assigned_user_id IS NOT NULL THEN
        -- Buscar o created_at do último atribuído
        SELECT created_at INTO v_last_assigned_at
        FROM whatsapp_instance_users
        WHERE instance_id = p_instance_id AND user_id = v_last_assigned_user_id;
        
        -- Buscar o próximo usuário após o último (circular)
        SELECT wiu.user_id INTO v_next_user_id
        FROM whatsapp_instance_users wiu
        WHERE wiu.instance_id = p_instance_id
          AND wiu.participates_in_distribution = true
          AND wiu.can_view = true
          AND wiu.user_id != v_last_assigned_user_id
          AND (
              wiu.is_always_available = true
              OR (v_current_time >= wiu.available_from::time AND v_current_time <= wiu.available_until::time)
          )
        ORDER BY 
            CASE 
                WHEN wiu.created_at > v_last_assigned_at THEN 0
                ELSE 1
            END,
            wiu.created_at
        LIMIT 1;
        
        -- Se não encontrou outro usuário disponível, pode ser que só tem 1 elegível
        -- Nesse caso, atribuir ao mesmo usuário novamente
        IF v_next_user_id IS NULL THEN
            SELECT wiu.user_id INTO v_next_user_id
            FROM whatsapp_instance_users wiu
            WHERE wiu.instance_id = p_instance_id
              AND wiu.participates_in_distribution = true
              AND wiu.can_view = true
              AND (
                  wiu.is_always_available = true
                  OR (v_current_time >= wiu.available_from::time AND v_current_time <= wiu.available_until::time)
              )
            LIMIT 1;
        END IF;
    ELSE
        -- Primeiro usuário (nenhum atribuído antes)
        SELECT wiu.user_id INTO v_next_user_id
        FROM whatsapp_instance_users wiu
        WHERE wiu.instance_id = p_instance_id
          AND wiu.participates_in_distribution = true
          AND wiu.can_view = true
          AND (
              wiu.is_always_available = true
              OR (v_current_time >= wiu.available_from::time AND v_current_time <= wiu.available_until::time)
          )
        ORDER BY wiu.created_at
        LIMIT 1;
    END IF;
    
    -- Se ainda não encontrou, buscar admin como fallback
    IF v_next_user_id IS NULL THEN
        SELECT wiu.user_id INTO v_next_user_id
        FROM whatsapp_instance_users wiu
        WHERE wiu.instance_id = p_instance_id
          AND wiu.is_instance_admin = true
          AND wiu.can_view = true
        ORDER BY wiu.created_at
        LIMIT 1;
    END IF;
    
    -- Se encontrou, atualizar o último atribuído
    IF v_next_user_id IS NOT NULL THEN
        UPDATE whatsapp_instances
        SET last_assigned_user_id = v_next_user_id
        WHERE id = p_instance_id;
    END IF;
    
    RETURN v_next_user_id;
END;
$function$;
-- Criar função RPC para reordenar etapas de forma atômica (transação única)
CREATE OR REPLACE FUNCTION public.reorder_funnel_stages(
  p_stages JSONB -- Array de {id: string, position: number}
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record JSONB;
  stage_id UUID;
  new_position INTEGER;
  org_id UUID;
  first_org_id UUID;
BEGIN
  -- Validar que há dados
  IF p_stages IS NULL OR jsonb_array_length(p_stages) = 0 THEN
    RAISE EXCEPTION 'Nenhuma etapa fornecida para reordenação';
  END IF;

  -- Verificar se todas as etapas pertencem à mesma organização
  SELECT DISTINCT organization_id INTO first_org_id
  FROM organization_funnel_stages
  WHERE id = (p_stages->0->>'id')::UUID;

  -- Verificar permissão do usuário para essa organização
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = first_org_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não tem permissão para esta organização';
  END IF;

  -- Primeiro, mover TODAS as etapas afetadas para posições temporárias muito altas
  -- Isso evita conflitos de unique constraint durante a atualização
  FOR stage_record IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    stage_id := (stage_record->>'id')::UUID;
    
    UPDATE organization_funnel_stages
    SET position = position + 1000000
    WHERE id = stage_id
      AND organization_id = first_org_id;
  END LOOP;

  -- Agora, aplicar as posições finais
  FOR stage_record IN SELECT * FROM jsonb_array_elements(p_stages)
  LOOP
    stage_id := (stage_record->>'id')::UUID;
    new_position := (stage_record->>'position')::INTEGER;
    
    -- Validar que a posição não é negativa
    IF new_position < 0 THEN
      RAISE EXCEPTION 'Posição inválida: % para etapa %', new_position, stage_id;
    END IF;
    
    UPDATE organization_funnel_stages
    SET position = new_position
    WHERE id = stage_id
      AND organization_id = first_org_id;
  END LOOP;

  RETURN TRUE;
  
EXCEPTION WHEN OTHERS THEN
  -- Em caso de qualquer erro, a transação inteira é revertida automaticamente
  RAISE;
END;
$$;

-- Adicionar constraint para impedir posições negativas no banco
ALTER TABLE organization_funnel_stages
DROP CONSTRAINT IF EXISTS position_must_be_positive;

ALTER TABLE organization_funnel_stages
ADD CONSTRAINT position_must_be_positive 
CHECK (position >= 0);

-- Criar índice para melhorar performance de queries de ordenação
CREATE INDEX IF NOT EXISTS idx_funnel_stages_org_position 
ON organization_funnel_stages(organization_id, position);
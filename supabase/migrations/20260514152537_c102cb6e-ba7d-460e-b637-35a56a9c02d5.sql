-- RPC: vincula uma etiqueta serial CRUA (status=available) a um produto E associa a uma venda
-- numa única transação atômica. Reaproveita o último lote/validade usados pra esse produto
-- caso não sejam fornecidos.
CREATE OR REPLACE FUNCTION public.link_and_assign_serial_to_sale(
  p_serial_code text,
  p_product_id uuid,
  p_sale_id uuid,
  p_sale_item_id uuid,
  p_lote text DEFAULT NULL,
  p_validade text DEFAULT NULL
)
RETURNS public.product_serial_labels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid := auth.uid();
  v_label public.product_serial_labels;
  v_product_name text;
  v_sale_org uuid;
  v_sale_item_product uuid;
  v_lote text := p_lote;
  v_validade text := p_validade;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Org do usuário corrente (mesmo critério usado nas outras RPCs)
  SELECT organization_id INTO v_org
  FROM public.organization_members
  WHERE user_id = v_user
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada para o usuário';
  END IF;

  -- Trava a etiqueta
  SELECT * INTO v_label
  FROM public.product_serial_labels
  WHERE organization_id = v_org
    AND serial_code = upper(p_serial_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etiqueta % não encontrada nesta organização', p_serial_code;
  END IF;

  IF v_label.status <> 'available' THEN
    RAISE EXCEPTION 'Etiqueta % não está disponível para vínculo (status atual: %)', p_serial_code, v_label.status;
  END IF;

  -- Valida produto
  SELECT name INTO v_product_name
  FROM public.lead_products
  WHERE id = p_product_id AND organization_id = v_org;

  IF v_product_name IS NULL THEN
    RAISE EXCEPTION 'Produto % não encontrado nesta organização', p_product_id;
  END IF;

  -- Valida venda + sale_item
  SELECT s.organization_id INTO v_sale_org
  FROM public.sales s
  WHERE s.id = p_sale_id;

  IF v_sale_org IS NULL OR v_sale_org <> v_org THEN
    RAISE EXCEPTION 'Venda % não pertence à sua organização', p_sale_id;
  END IF;

  SELECT product_id INTO v_sale_item_product
  FROM public.sale_items
  WHERE id = p_sale_item_id AND sale_id = p_sale_id;

  IF v_sale_item_product IS NULL THEN
    RAISE EXCEPTION 'Item da venda % não encontrado', p_sale_item_id;
  END IF;

  IF v_sale_item_product <> p_product_id THEN
    RAISE EXCEPTION 'Produto % não corresponde ao item da venda (esperado: %)', p_product_id, v_sale_item_product;
  END IF;

  -- Auto-preenche lote/validade com o último usado para esse produto na org
  IF v_lote IS NULL OR v_lote = '' OR v_validade IS NULL OR v_validade = '' THEN
    SELECT
      COALESCE(NULLIF(v_lote, ''), lote),
      COALESCE(NULLIF(v_validade, ''), validade)
    INTO v_lote, v_validade
    FROM public.product_serial_labels
    WHERE organization_id = v_org
      AND product_id = p_product_id
      AND lote IS NOT NULL
      AND validade IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  -- ETAPA 1: vincular produto (available -> in_stock)
  UPDATE public.product_serial_labels
  SET product_id = p_product_id,
      product_name = v_product_name,
      lote = v_lote,
      validade = v_validade,
      status = 'in_stock',
      stocked_at = now(),
      stocked_by = v_user,
      updated_at = now()
  WHERE id = v_label.id;

  INSERT INTO public.serial_label_logs (
    organization_id, serial_code, action, details, user_id, success
  ) VALUES (
    v_org, v_label.serial_code, 'assign_product',
    jsonb_build_object(
      'product_id', p_product_id,
      'product_name', v_product_name,
      'lote', v_lote,
      'validade', v_validade,
      'mode', 'inline_scan'
    ),
    v_user, true
  );

  -- ETAPA 2: associar à venda (in_stock -> assigned)
  UPDATE public.product_serial_labels
  SET sale_id = p_sale_id,
      sale_item_id = p_sale_item_id,
      status = 'assigned',
      assigned_at = now(),
      assigned_by = v_user,
      updated_at = now()
  WHERE id = v_label.id
  RETURNING * INTO v_label;

  INSERT INTO public.serial_label_logs (
    organization_id, serial_code, action, details, user_id, sale_id, success
  ) VALUES (
    v_org, v_label.serial_code, 'assign_sale',
    jsonb_build_object('sale_item_id', p_sale_item_id, 'mode', 'inline_scan'),
    v_user, p_sale_id, true
  );

  RETURN v_label;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_and_assign_serial_to_sale(text, uuid, uuid, uuid, text, text) TO authenticated;

-- RPC auxiliar: pega o último lote/validade usados para um produto (usado para pré-preencher o diálogo)
CREATE OR REPLACE FUNCTION public.get_last_lote_validade_for_product(p_product_id uuid)
RETURNS TABLE(lote text, validade text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT psl.lote, psl.validade
  FROM public.product_serial_labels psl
  WHERE psl.organization_id = v_org
    AND psl.product_id = p_product_id
    AND psl.lote IS NOT NULL
    AND psl.validade IS NOT NULL
  ORDER BY psl.updated_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_lote_validade_for_product(uuid) TO authenticated;
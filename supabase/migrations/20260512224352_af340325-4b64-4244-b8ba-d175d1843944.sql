-- Trigger to prevent overscan: ensure total assigned serials for a product
-- in a sale never exceeds the total quantity of that product in sale_items.
CREATE OR REPLACE FUNCTION public.prevent_serial_overscan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needed integer;
  v_assigned integer;
BEGIN
  -- Only validate when assigning to a sale (sale_id is being set or product changed)
  IF NEW.sale_id IS NULL OR NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if nothing relevant changed
  IF TG_OP = 'UPDATE'
     AND OLD.sale_id IS NOT DISTINCT FROM NEW.sale_id
     AND OLD.product_id IS NOT DISTINCT FROM NEW.product_id THEN
    RETURN NEW;
  END IF;

  -- Total quantity of this product across all sale_items in the sale
  SELECT COALESCE(SUM(quantity), 0) INTO v_needed
  FROM public.sale_items
  WHERE sale_id = NEW.sale_id
    AND product_id = NEW.product_id;

  -- Already-assigned serials for this product+sale (excluding current row)
  SELECT COUNT(*) INTO v_assigned
  FROM public.product_serial_labels
  WHERE sale_id = NEW.sale_id
    AND product_id = NEW.product_id
    AND id <> NEW.id;

  IF (v_assigned + 1) > v_needed THEN
    RAISE EXCEPTION 'Excesso de bipes: já há % unidade(s) escaneada(s) e o pedido pede % do produto %',
      v_assigned, v_needed, NEW.product_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_serial_overscan ON public.product_serial_labels;
CREATE TRIGGER trg_prevent_serial_overscan
BEFORE UPDATE ON public.product_serial_labels
FOR EACH ROW
EXECUTE FUNCTION public.prevent_serial_overscan();
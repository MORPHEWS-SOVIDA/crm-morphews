
-- Add stock_reserved column to lead_products
ALTER TABLE public.lead_products
ADD COLUMN IF NOT EXISTS stock_reserved integer DEFAULT 0;

-- Comment for documentation
COMMENT ON COLUMN public.lead_products.stock_reserved IS 'Quantity reserved by pending sales (draft to dispatched)';

-- Update stock_movements to support reserve movements
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE public.stock_movements
ADD CONSTRAINT stock_movements_movement_type_check 
CHECK (movement_type IN ('entry', 'exit', 'adjustment', 'sale', 'return', 'reserve', 'unreserve'));

-- Create function to reserve stock when sale is created
CREATE OR REPLACE FUNCTION public.reserve_stock_for_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Create function to unreserve stock when sale is cancelled
CREATE OR REPLACE FUNCTION public.unreserve_stock_for_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Create function to deduct stock when sale is delivered
CREATE OR REPLACE FUNCTION public.deduct_stock_for_delivered_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Create function to restore stock when delivered sale is cancelled
CREATE OR REPLACE FUNCTION public.restore_stock_for_cancelled_delivered_sale(_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

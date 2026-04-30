CREATE OR REPLACE FUNCTION public.fn_set_financial_audit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_updated_by boolean;
  has_created_by boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=TG_TABLE_SCHEMA AND table_name=TG_TABLE_NAME AND column_name='updated_by'
  ) INTO has_updated_by;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema=TG_TABLE_SCHEMA AND table_name=TG_TABLE_NAME AND column_name='created_by'
  ) INTO has_created_by;

  IF TG_OP = 'INSERT' THEN
    IF has_created_by THEN
      NEW := NEW #= hstore('created_by', COALESCE((to_jsonb(NEW)->>'created_by'), auth.uid()::text));
    END IF;
    IF has_updated_by THEN
      NEW := NEW #= hstore('updated_by', COALESCE((to_jsonb(NEW)->>'updated_by'), auth.uid()::text));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF has_updated_by THEN
      NEW := NEW #= hstore('updated_by', auth.uid()::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
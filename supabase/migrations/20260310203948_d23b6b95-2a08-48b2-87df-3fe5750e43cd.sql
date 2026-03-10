
-- Fix trigger to NOT overwrite manually edited system_prompt on UPDATE
CREATE OR REPLACE FUNCTION public.trigger_generate_bot_prompt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- On INSERT: always generate if system_prompt is empty/null
  IF TG_OP = 'INSERT' THEN
    IF NEW.system_prompt IS NULL OR NEW.system_prompt = '' THEN
      NEW.system_prompt := generate_bot_system_prompt(
        NEW.gender, NEW.brazilian_state, NEW.age_range, NEW.service_type, 
        NEW.response_length, NEW.company_differential, NEW.personality_description, 
        NEW.regional_expressions, NEW.company_name
      );
    END IF;
  END IF;
  
  -- On UPDATE: only regenerate if personality-related fields changed AND system_prompt was NOT explicitly changed
  IF TG_OP = 'UPDATE' THEN
    -- If system_prompt was explicitly changed by the user, respect it
    IF NEW.system_prompt IS DISTINCT FROM OLD.system_prompt THEN
      -- User edited the prompt directly, keep their version
      NULL;
    ELSE
      -- Check if any prompt-generating fields changed
      IF (NEW.gender IS DISTINCT FROM OLD.gender) OR
         (NEW.brazilian_state IS DISTINCT FROM OLD.brazilian_state) OR
         (NEW.age_range IS DISTINCT FROM OLD.age_range) OR
         (NEW.service_type IS DISTINCT FROM OLD.service_type) OR
         (NEW.response_length IS DISTINCT FROM OLD.response_length) OR
         (NEW.company_differential IS DISTINCT FROM OLD.company_differential) OR
         (NEW.personality_description IS DISTINCT FROM OLD.personality_description) OR
         (NEW.regional_expressions IS DISTINCT FROM OLD.regional_expressions) OR
         (NEW.company_name IS DISTINCT FROM OLD.company_name) THEN
        -- Regenerate because personality fields changed
        NEW.system_prompt := generate_bot_system_prompt(
          NEW.gender, NEW.brazilian_state, NEW.age_range, NEW.service_type, 
          NEW.response_length, NEW.company_differential, NEW.personality_description, 
          NEW.regional_expressions, NEW.company_name
        );
      END IF;
    END IF;
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

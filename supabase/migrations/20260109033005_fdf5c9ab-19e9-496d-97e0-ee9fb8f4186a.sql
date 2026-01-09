-- Fix imc_height column precision to allow values like 176 cm
ALTER TABLE public.lead_standard_question_answers
  ALTER COLUMN imc_height TYPE numeric(5,2);
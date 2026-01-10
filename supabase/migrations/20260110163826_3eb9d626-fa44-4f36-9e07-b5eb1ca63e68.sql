
-- Fix unique constraint for lead_product_question_answers
-- It should be unique per (lead, product, question), not just (lead, question)
-- This allows the same question to have different answers for different products

-- First, drop the incorrect constraint
ALTER TABLE public.lead_product_question_answers 
DROP CONSTRAINT IF EXISTS lead_product_question_answers_lead_id_question_id_key;

-- Create the correct constraint
ALTER TABLE public.lead_product_question_answers 
ADD CONSTRAINT lead_product_question_answers_lead_product_question_key 
UNIQUE (lead_id, product_id, question_id);

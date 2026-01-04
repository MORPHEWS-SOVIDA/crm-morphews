
-- Function to seed standard questions for an organization
CREATE OR REPLACE FUNCTION public.seed_standard_questions_for_org(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  q_id uuid;
BEGIN
  -- Verificar se já tem perguntas padrão
  IF EXISTS (SELECT 1 FROM standard_questions WHERE organization_id = _org_id AND is_system = true) THEN
    RETURN;
  END IF;

  -- =============================
  -- CATEGORIA: DORES ARTICULARES
  -- =============================
  
  -- Pergunta 1: Onde você sofre com dores?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'dores_articulares', 'Aonde você sofre com dores?', 'multiple_choice', true, 1)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Joelho', 1),
    (q_id, 'Costas', 2),
    (q_id, 'Coluna', 3),
    (q_id, 'Ombro', 4),
    (q_id, 'Mão', 5),
    (q_id, 'Dedos', 6),
    (q_id, 'Ciático', 7),
    (q_id, 'Pé', 8),
    (q_id, 'Perna', 9),
    (q_id, 'Pescoço', 10),
    (q_id, 'Outro lugar do corpo', 11);
  
  -- Pergunta 2: O que deixa de fazer por culpa das dores?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'dores_articulares', 'O que você deixa de fazer por culpa das dores?', 'multiple_choice', true, 2)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Cozinhar', 1),
    (q_id, 'Lavar louça', 2),
    (q_id, 'Fazer compras (ir ao mercado/supermercado)', 3),
    (q_id, 'Limpar a casa (varrer, passar pano)', 4),
    (q_id, 'Lavar e passar roupa', 5),
    (q_id, 'Tomar banho ou se vestir', 6),
    (q_id, 'Cuidar do jardim/quintal', 7),
    (q_id, 'Subir e descer escadas', 8),
    (q_id, 'Caminhar longas distâncias', 9),
    (q_id, 'Ficar em pé por muito tempo', 10),
    (q_id, 'Ficar sentado(a) por muito tempo', 11),
    (q_id, 'Praticar exercícios físicos ou esportes', 12),
    (q_id, 'Carregar objetos pesados (sacolas de compras, mochilas)', 13),
    (q_id, 'Trabalhar (no escritório ou em casa)', 14),
    (q_id, 'Dirigir', 15),
    (q_id, 'Dormir (dificuldade em encontrar posição confortável)', 16),
    (q_id, 'Sair com amigos/familiares ou socializar', 17),
    (q_id, 'Participar de hobbies ou atividades de lazer', 18),
    (q_id, 'Viajar', 19),
    (q_id, 'Nenhuma das opções acima', 20);
  
  -- Pergunta 3: Quanto tempo sofre com dores?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'dores_articulares', 'Quanto tempo você sofre com dores?', 'single_choice', true, 3)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, '1 semana', 1),
    (q_id, '1 mês', 2),
    (q_id, 'De 1 a 3 meses', 3),
    (q_id, 'De 3 meses a 1 ano', 4),
    (q_id, 'Mais de 1 ano', 5),
    (q_id, 'Mais de 5 anos', 6),
    (q_id, 'Mais de 10 anos', 7);

  -- =============================
  -- CATEGORIA: EMAGRECIMENTO
  -- =============================
  
  -- Pergunta IMC (especial)
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'emagrecimento', 'Cálculo de IMC (Peso, Altura e Idade)', 'imc_calculator', true, 4)
  RETURNING id INTO q_id;
  
  -- Pergunta: Quantos kg quer emagrecer?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'emagrecimento', 'Quantos kg você quer emagrecer?', 'number', true, 5)
  RETURNING id INTO q_id;
  
  -- Pergunta: Maior dificuldade para emagrecer
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'emagrecimento', 'Qual sua maior dificuldade para emagrecer?', 'multiple_choice', true, 6)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Como muito doce', 1),
    (q_id, 'Como muito salgado', 2),
    (q_id, 'Tenho muita ansiedade', 3),
    (q_id, 'Como fora de hora', 4),
    (q_id, 'Como por olho', 5),
    (q_id, 'Repito muitas vezes na hora da refeição', 6),
    (q_id, 'Não sei por que engordo, como pouco', 7),
    (q_id, 'Outro motivo', 8);

  -- =============================
  -- CATEGORIA: DIABETES
  -- =============================
  
  -- Pergunta: Você tem diabetes?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'diabetes', 'Você tem diabetes?', 'multiple_choice', true, 7)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Não tenho diabetes', 1),
    (q_id, 'Não sei se tenho diabetes', 2),
    (q_id, 'Tenho histórico de diabetes na família', 3),
    (q_id, 'Tenho diabetes tipo 1', 4),
    (q_id, 'Tenho diabetes tipo 2', 5);
  
  -- Pergunta: Faz uso de insulina?
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'diabetes', 'Faz uso de insulina injetável?', 'single_choice', true, 8)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Faço uso de insulina injetável', 1),
    (q_id, 'Não faço uso de insulina injetável', 2);

  -- =============================
  -- CATEGORIA: SAÚDE GERAL
  -- =============================
  
  -- Pergunta: Osteoporose
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você tem osteoporose?', 'single_choice', true, 9)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Não', 1),
    (q_id, 'Não sei', 2),
    (q_id, 'Tenho', 3);
  
  -- Pergunta: Pernas inchadas
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você sofre de pernas inchadas?', 'single_choice', true, 10)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Sim', 1),
    (q_id, 'Poucas vezes', 2),
    (q_id, 'Não', 3);
  
  -- Pergunta: Formigamento
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você sofre de formigamento?', 'single_choice', true, 11)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Sim', 1),
    (q_id, 'Poucas vezes', 2),
    (q_id, 'Não', 3);
  
  -- Pergunta: Visão embaçada
  INSERT INTO standard_questions (organization_id, category, question_text, question_type, is_system, position)
  VALUES (_org_id, 'saude_geral', 'Você está com sua visão embaçada, ou mudando de óculos de pouco em pouco tempo?', 'single_choice', true, 12)
  RETURNING id INTO q_id;
  
  INSERT INTO standard_question_options (question_id, option_text, position) VALUES
    (q_id, 'Sim', 1),
    (q_id, 'Não', 2);
    
END;
$$;

-- Trigger para novas organizações
CREATE OR REPLACE FUNCTION public.seed_standard_questions_on_org_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM seed_standard_questions_for_org(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_standard_questions_trigger ON organizations;
CREATE TRIGGER seed_standard_questions_trigger
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_standard_questions_on_org_create();

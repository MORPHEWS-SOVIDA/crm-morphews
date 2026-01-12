-- =============================================
-- SISTEMA DE DEMANDAS - ESTRUTURA COMPLETA
-- =============================================

-- 1. CONFIGURAÇÃO DE SLA POR ORGANIZAÇÃO
CREATE TABLE public.demand_sla_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  hours INTEGER NOT NULL DEFAULT 72,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, urgency)
);

-- 2. QUADROS KANBAN (SETORES)
CREATE TABLE public.demand_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. COLUNAS DO KANBAN
CREATE TABLE public.demand_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.demand_boards(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#e2e8f0',
  position INTEGER NOT NULL DEFAULT 0,
  is_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. DEMANDAS
CREATE TABLE public.demands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.demand_boards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.demand_columns(id),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  urgency TEXT NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  due_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  total_time_seconds INTEGER NOT NULL DEFAULT 0,
  estimated_time_seconds INTEGER,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 5. RESPONSÁVEIS/ATRIBUÍDOS À DEMANDA
CREATE TABLE public.demand_assignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'assignee' CHECK (role IN ('assignee', 'watcher')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  notified_at TIMESTAMPTZ,
  UNIQUE(demand_id, user_id)
);

-- 6. REGISTROS DE TEMPO
CREATE TABLE public.demand_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. COMENTÁRIOS
CREATE TABLE public.demand_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ANEXOS
CREATE TABLE public.demand_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. HISTÓRICO DE MUDANÇAS (AUDIT LOG)
CREATE TABLE public.demand_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. CHECKLISTS (SUBTAREFAS)
CREATE TABLE public.demand_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. LABELS/TAGS
CREATE TABLE public.demand_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.demand_label_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.demand_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(demand_id, label_id)
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX idx_demands_org ON public.demands(organization_id);
CREATE INDEX idx_demands_board ON public.demands(board_id);
CREATE INDEX idx_demands_column ON public.demands(column_id);
CREATE INDEX idx_demands_lead ON public.demands(lead_id);
CREATE INDEX idx_demands_urgency ON public.demands(urgency);
CREATE INDEX idx_demands_sla ON public.demands(sla_deadline);
CREATE INDEX idx_demand_assignees_user ON public.demand_assignees(user_id);
CREATE INDEX idx_demand_assignees_demand ON public.demand_assignees(demand_id);
CREATE INDEX idx_demand_time_entries_user ON public.demand_time_entries(user_id);
CREATE INDEX idx_demand_time_entries_demand ON public.demand_time_entries(demand_id);
CREATE INDEX idx_demand_comments_demand ON public.demand_comments(demand_id);
CREATE INDEX idx_demand_history_demand ON public.demand_history(demand_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- SLA Config
ALTER TABLE public.demand_sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view sla config" ON public.demand_sla_config
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Admins can manage sla config" ON public.demand_sla_config
  FOR ALL USING (
    organization_id = public.get_user_organization_id() 
    AND EXISTS (
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = demand_sla_config.organization_id 
      AND om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin')
    )
  );

-- Boards
ALTER TABLE public.demand_boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view boards" ON public.demand_boards
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can manage boards" ON public.demand_boards
  FOR ALL USING (organization_id = public.get_user_organization_id());

-- Columns
ALTER TABLE public.demand_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view columns" ON public.demand_columns
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can manage columns" ON public.demand_columns
  FOR ALL USING (organization_id = public.get_user_organization_id());

-- Demands
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view demands" ON public.demands
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can manage demands" ON public.demands
  FOR ALL USING (organization_id = public.get_user_organization_id());

-- Assignees
ALTER TABLE public.demand_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view assignees" ON public.demand_assignees
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can manage assignees" ON public.demand_assignees
  FOR ALL USING (organization_id = public.get_user_organization_id());

-- Time Entries
ALTER TABLE public.demand_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view time entries" ON public.demand_time_entries
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can manage own time entries" ON public.demand_time_entries
  FOR ALL USING (organization_id = public.get_user_organization_id() AND user_id = auth.uid());
CREATE POLICY "Admins can manage all time entries" ON public.demand_time_entries
  FOR ALL USING (
    organization_id = public.get_user_organization_id() 
    AND EXISTS (
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = demand_time_entries.organization_id 
      AND om.user_id = auth.uid() 
      AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- Comments
ALTER TABLE public.demand_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view comments" ON public.demand_comments
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can create comments" ON public.demand_comments
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id() AND user_id = auth.uid());
CREATE POLICY "Users can update own comments" ON public.demand_comments
  FOR UPDATE USING (organization_id = public.get_user_organization_id() AND user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON public.demand_comments
  FOR DELETE USING (organization_id = public.get_user_organization_id() AND user_id = auth.uid());

-- Attachments
ALTER TABLE public.demand_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view attachments" ON public.demand_attachments
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can manage attachments" ON public.demand_attachments
  FOR ALL USING (organization_id = public.get_user_organization_id());

-- History
ALTER TABLE public.demand_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view history" ON public.demand_history
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "System can insert history" ON public.demand_history
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- Checklist
ALTER TABLE public.demand_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view checklist" ON public.demand_checklist_items
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can manage checklist" ON public.demand_checklist_items
  FOR ALL USING (organization_id = public.get_user_organization_id());

-- Labels
ALTER TABLE public.demand_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view labels" ON public.demand_labels
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Org members can manage labels" ON public.demand_labels
  FOR ALL USING (organization_id = public.get_user_organization_id());

ALTER TABLE public.demand_label_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view label assignments" ON public.demand_label_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.demands d WHERE d.id = demand_id AND d.organization_id = public.get_user_organization_id())
  );
CREATE POLICY "Org members can manage label assignments" ON public.demand_label_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.demands d WHERE d.id = demand_id AND d.organization_id = public.get_user_organization_id())
  );

-- =============================================
-- FUNÇÕES AUXILIARES
-- =============================================

-- Função para calcular SLA deadline
CREATE OR REPLACE FUNCTION public.calculate_demand_sla_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sla_hours INTEGER;
BEGIN
  -- Buscar configuração de SLA
  SELECT hours INTO sla_hours
  FROM public.demand_sla_config
  WHERE organization_id = NEW.organization_id AND urgency = NEW.urgency;
  
  -- Default se não configurado
  IF sla_hours IS NULL THEN
    sla_hours := CASE NEW.urgency
      WHEN 'high' THEN 24
      WHEN 'medium' THEN 48
      WHEN 'low' THEN 72
      ELSE 48
    END;
  END IF;
  
  NEW.sla_deadline := NEW.created_at + (sla_hours || ' hours')::INTERVAL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calculate_sla_deadline
  BEFORE INSERT ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_demand_sla_deadline();

-- Função para atualizar tempo total
CREATE OR REPLACE FUNCTION public.update_demand_total_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.ended_at IS NOT NULL AND NEW.duration_seconds IS NULL THEN
      NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
    END IF;
    
    UPDATE public.demands
    SET total_time_seconds = (
      SELECT COALESCE(SUM(duration_seconds), 0)
      FROM public.demand_time_entries
      WHERE demand_id = NEW.demand_id AND duration_seconds IS NOT NULL
    ),
    updated_at = now()
    WHERE id = NEW.demand_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_demand_time
  AFTER INSERT OR UPDATE ON public.demand_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_demand_total_time();

-- Função para registrar histórico
CREATE OR REPLACE FUNCTION public.log_demand_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Log mudança de coluna (status)
    IF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
      INSERT INTO public.demand_history (demand_id, organization_id, user_id, action, old_value, new_value)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'column_changed', 
        jsonb_build_object('column_id', OLD.column_id),
        jsonb_build_object('column_id', NEW.column_id)
      );
    END IF;
    
    -- Log mudança de urgência
    IF OLD.urgency IS DISTINCT FROM NEW.urgency THEN
      INSERT INTO public.demand_history (demand_id, organization_id, user_id, action, old_value, new_value)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'urgency_changed',
        jsonb_build_object('urgency', OLD.urgency),
        jsonb_build_object('urgency', NEW.urgency)
      );
    END IF;
    
    -- Log conclusão
    IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
      INSERT INTO public.demand_history (demand_id, organization_id, user_id, action, old_value, new_value)
      VALUES (NEW.id, NEW.organization_id, auth.uid(), 'completed', NULL, 
        jsonb_build_object('completed_at', NEW.completed_at)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_demand_changes
  AFTER UPDATE ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.log_demand_changes();

-- Função para inicializar SLA config padrão
CREATE OR REPLACE FUNCTION public.initialize_demand_sla_config(org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.demand_sla_config (organization_id, urgency, hours)
  VALUES 
    (org_id, 'low', 72),
    (org_id, 'medium', 48),
    (org_id, 'high', 24)
  ON CONFLICT (organization_id, urgency) DO NOTHING;
END;
$$;

-- Função para inicializar colunas padrão de um board
CREATE OR REPLACE FUNCTION public.initialize_demand_board_columns(p_board_id UUID, p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.demand_columns (board_id, organization_id, name, color, position, is_final)
  VALUES 
    (p_board_id, p_organization_id, 'A Fazer', '#e2e8f0', 0, false),
    (p_board_id, p_organization_id, 'Em Andamento', '#fef3c7', 1, false),
    (p_board_id, p_organization_id, 'Em Revisão', '#dbeafe', 2, false),
    (p_board_id, p_organization_id, 'Concluído', '#d1fae5', 3, true);
END;
$$;

-- Storage bucket para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('demand-attachments', 'demand-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Org members can view demand attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'demand-attachments' 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can upload demand attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'demand-attachments' 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can delete demand attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'demand-attachments' 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM public.organization_members WHERE user_id = auth.uid()
  )
);
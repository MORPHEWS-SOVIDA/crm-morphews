
CREATE TABLE public.routing_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id text NOT NULL,
  team_id uuid REFERENCES public.bot_teams(id) ON DELETE SET NULL,
  current_bot_id uuid REFERENCES public.ai_bots(id) ON DELETE SET NULL,
  target_bot_id uuid REFERENCES public.ai_bots(id) ON DELETE SET NULL,
  matched_route_id uuid REFERENCES public.bot_team_routes(id) ON DELETE SET NULL,
  match_type text NOT NULL DEFAULT 'none',
  confidence_score integer DEFAULT 0,
  user_message text,
  classification_reason text,
  routes_evaluated integer DEFAULT 0,
  decision text NOT NULL DEFAULT 'no_match',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_routing_logs_org ON public.routing_decision_logs(organization_id);
CREATE INDEX idx_routing_logs_team ON public.routing_decision_logs(team_id);
CREATE INDEX idx_routing_logs_created ON public.routing_decision_logs(created_at DESC);

ALTER TABLE public.routing_decision_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view routing logs"
ON public.routing_decision_logs
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- 1. ONBOARDING EMAIL CADENCE SYSTEM
-- ============================================================================

-- Templates de emails de onboarding (editáveis no Super Admin)
CREATE TABLE IF NOT EXISTS public.onboarding_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_offset INTEGER NOT NULL DEFAULT 0, -- Dias após cadastro (0 = mesmo dia)
  hours_offset INTEGER NOT NULL DEFAULT 0, -- Horas extras após o dia (0, 2, 6, etc.)
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT, -- Versão plain text opcional
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0, -- Para ordenar na lista
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Fila de emails a serem enviados
CREATE TABLE IF NOT EXISTS public.onboarding_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.onboarding_email_templates(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_onboarding_queue_status_scheduled 
  ON public.onboarding_email_queue(status, scheduled_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_onboarding_queue_org 
  ON public.onboarding_email_queue(organization_id);

-- Enable RLS
ALTER TABLE public.onboarding_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_email_queue ENABLE ROW LEVEL SECURITY;

-- Policies para templates (apenas master admins via service role)
CREATE POLICY "Templates are readable by authenticated users"
  ON public.onboarding_email_templates FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policies para queue (service role only, via edge functions)
CREATE POLICY "Queue readable by service role"
  ON public.onboarding_email_queue FOR SELECT
  USING (true); -- Edge functions use service role

-- Função para enfileirar emails de onboarding quando usuário é criado
CREATE OR REPLACE FUNCTION public.enqueue_onboarding_emails(
  _organization_id UUID,
  _user_id UUID,
  _email TEXT,
  _name TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template RECORD;
  scheduled TIMESTAMPTZ;
  count INTEGER := 0;
  base_time TIMESTAMPTZ := now();
BEGIN
  -- Para cada template ativo, criar entrada na fila
  FOR template IN 
    SELECT * FROM onboarding_email_templates 
    WHERE is_active = true 
    ORDER BY day_offset, hours_offset
  LOOP
    -- Calcular horário de envio
    scheduled := base_time + (template.day_offset || ' days')::INTERVAL + (template.hours_offset || ' hours')::INTERVAL;
    
    -- Inserir na fila
    INSERT INTO onboarding_email_queue (
      organization_id, user_id, template_id, email, name, scheduled_at
    ) VALUES (
      _organization_id, _user_id, template.id, _email, _name, scheduled
    );
    
    count := count + 1;
  END LOOP;
  
  RETURN count;
END;
$$;

-- ============================================================================
-- 2. DADOS INICIAIS DE TEMPLATES DE ONBOARDING
-- ============================================================================

-- Dia 0 - Hora 0 (Imediato - Boas-vindas)
INSERT INTO public.onboarding_email_templates (day_offset, hours_offset, subject, body_html, position) VALUES
(0, 0, '🎉 Bem-vindo ao Morphews CRM - Comece Aqui!', E'<h1>Olá {{nome}}!</h1>
<p>Seja muito bem-vindo ao <strong>Morphews CRM</strong>! 🎉</p>
<p>Estamos muito felizes em ter você conosco. Nas próximas mensagens, vamos te ensinar a usar todas as funcionalidades do sistema para que você possa:</p>
<ul>
  <li>✅ Cadastrar e gerenciar seus leads</li>
  <li>✅ Acompanhar seu funil de vendas</li>
  <li>✅ Integrar com WhatsApp</li>
  <li>✅ Automatizar follow-ups</li>
</ul>
<p><a href="https://crm.morphews.com/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Acessar o Sistema</a></p>
<p>Qualquer dúvida, é só responder este email!</p>
<p>Abraços,<br><strong>Equipe Morphews</strong></p>', 1),

-- Dia 0 - Hora 2 (Primeiro cadastro)
(0, 2, '📝 Seu primeiro lead - Como cadastrar', E'<h1>{{primeiro_nome}}, vamos cadastrar seu primeiro lead?</h1>
<p>Agora que você já acessou o sistema, o próximo passo é cadastrar seu primeiro lead!</p>
<h2>📱 3 formas de cadastrar leads:</h2>
<ol>
  <li><strong>Pelo Dashboard:</strong> Clique em "+ Novo Lead" e preencha os dados</li>
  <li><strong>Pelo WhatsApp:</strong> Envie o número do cliente para nossa Secretária IA</li>
  <li><strong>Por Integração:</strong> Configure webhooks para captura automática</li>
</ol>
<p>💡 <strong>Dica:</strong> Use estrelas (1-5) para classificar a qualidade dos leads!</p>
<p><a href="https://crm.morphews.com/leads/novo" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Cadastrar Primeiro Lead</a></p>', 2),

-- Dia 0 - Hora 6 (Funil de vendas)
(0, 6, '🎯 Entenda seu Funil de Vendas', E'<h1>{{primeiro_nome}}, seu funil é seu mapa do tesouro!</h1>
<p>O funil de vendas do Morphews te ajuda a visualizar exatamente onde cada lead está na jornada de compra.</p>
<h2>📊 As etapas padrão são:</h2>
<ul>
  <li>🆕 <strong>Novo Lead:</strong> Acabou de entrar</li>
  <li>📞 <strong>Primeiro Contato:</strong> Você já fez o primeiro contato</li>
  <li>📅 <strong>Reunião Agendada:</strong> Tem uma call marcada</li>
  <li>💬 <strong>Negociação:</strong> Discutindo valores e condições</li>
  <li>💰 <strong>Fechado/Ganho:</strong> PARABÉNS! Vendeu!</li>
</ul>
<p>💡 <strong>Dica:</strong> Você pode personalizar as etapas em Configurações!</p>
<p><a href="https://crm.morphews.com/dashboard-kanban" style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Meu Funil</a></p>', 3),

-- Dia 1 (WhatsApp)
(1, 0, '💬 Conecte seu WhatsApp ao CRM', E'<h1>{{primeiro_nome}}, hora de conectar o WhatsApp!</h1>
<p>A integração com WhatsApp é uma das funcionalidades mais poderosas do Morphews.</p>
<h2>🚀 Com ela você pode:</h2>
<ul>
  <li>📱 Atender clientes diretamente pelo CRM</li>
  <li>🤖 Usar bots de IA para atendimento automático</li>
  <li>📊 Ver todas as conversas vinculadas aos leads</li>
  <li>⏰ Agendar mensagens para envio futuro</li>
</ul>
<p>Para conectar, acesse Configurações → Integrações → WhatsApp</p>
<p><a href="https://crm.morphews.com/whatsapp" style="background: #25d366; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Configurar WhatsApp</a></p>', 4),

-- Dia 2 (Follow-ups)
(2, 0, '⏰ Nunca mais esqueça um follow-up!', E'<h1>{{primeiro_nome}}, follow-ups são a chave do sucesso!</h1>
<p>Estudos mostram que 80% das vendas acontecem depois do 5º follow-up. E adivinha? O Morphews te ajuda a nunca esquecer nenhum!</p>
<h2>🔔 Como funciona:</h2>
<ol>
  <li>Ao cadastrar um lead, defina a data do próximo contato</li>
  <li>O sistema te lembra automaticamente (email + WhatsApp)</li>
  <li>Após cada contato, agende o próximo</li>
</ol>
<p>💡 <strong>Dica Pro:</strong> Use o "Meu Painel" para ver todos os follow-ups do dia!</p>
<p><a href="https://crm.morphews.com/meu-painel" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Meu Painel</a></p>', 5),

-- Dia 3 (Produtos)
(3, 0, '📦 Cadastre seus produtos', E'<h1>{{primeiro_nome}}, seus produtos organizados!</h1>
<p>Se você vende produtos ou serviços, pode cadastrá-los no Morphews para:</p>
<ul>
  <li>📋 Gerar orçamentos rapidamente</li>
  <li>💰 Controlar estoque</li>
  <li>📊 Ver relatórios de vendas por produto</li>
  <li>🤖 O bot de IA pode responder sobre seus produtos!</li>
</ul>
<p><a href="https://crm.morphews.com/produtos" style="background: #06b6d4; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Cadastrar Produtos</a></p>', 6),

-- Dia 5 (Equipe)
(5, 0, '👥 Adicione sua equipe', E'<h1>{{primeiro_nome}}, trabalhe em equipe!</h1>
<p>O Morphews foi feito para equipes de vendas. Você pode:</p>
<ul>
  <li>👤 Adicionar vendedores, gerentes e atendentes</li>
  <li>🔐 Definir permissões específicas para cada um</li>
  <li>📊 Acompanhar performance individual</li>
  <li>🏆 Ver rankings de vendas da equipe</li>
</ul>
<p><a href="https://crm.morphews.com/equipe" style="background: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Gerenciar Equipe</a></p>', 7),

-- Dia 7 (Relatórios)
(7, 0, '📊 Análise de dados e relatórios', E'<h1>Uma semana com Morphews! 🎉</h1>
<p>{{primeiro_nome}}, parabéns pela primeira semana!</p>
<p>Agora que você já está usando o sistema, é hora de analisar os dados:</p>
<ul>
  <li>📈 <strong>Dashboard:</strong> Visão geral de leads e vendas</li>
  <li>🏆 <strong>Ranking de Vendas:</strong> Performance da equipe</li>
  <li>💰 <strong>Relatório de Comissões:</strong> Quanto cada vendedor ganhou</li>
  <li>📦 <strong>Relatório de Expedição:</strong> Status das entregas</li>
</ul>
<p><a href="https://crm.morphews.com/dashboard" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Dashboard</a></p>', 8),

-- Dia 10 (Robôs de IA)
(10, 0, '🤖 Robôs de IA para atendimento', E'<h1>{{primeiro_nome}}, deixe a IA trabalhar por você!</h1>
<p>Você sabia que pode criar robôs de IA personalizados para atender seus clientes?</p>
<h2>🚀 O que os bots podem fazer:</h2>
<ul>
  <li>Responder perguntas sobre produtos automaticamente</li>
  <li>Qualificar leads enquanto você dorme</li>
  <li>Agendar reuniões</li>
  <li>Transferir para humano quando necessário</li>
</ul>
<p><a href="https://crm.morphews.com/robos-ia" style="background: #14b8a6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Criar Meu Bot</a></p>', 9),

-- Dia 14 (Integrações)
(14, 0, '🔗 Integrações e Automações', E'<h1>{{primeiro_nome}}, automatize tudo!</h1>
<p>O Morphews se integra com diversas ferramentas para automatizar seu fluxo de trabalho:</p>
<ul>
  <li>📱 <strong>WhatsApp:</strong> Atendimento multi-atendente</li>
  <li>📸 <strong>Instagram:</strong> DMs direto no CRM</li>
  <li>🔔 <strong>Webhooks:</strong> Receba leads de qualquer formulário</li>
  <li>💳 <strong>Pagamentos:</strong> Integração com meios de pagamento</li>
</ul>
<p><a href="https://crm.morphews.com/integracoes" style="background: #a855f7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Integrações</a></p>', 10),

-- Dia 17 (Pós-Venda)
(17, 0, '🎯 Pós-venda e Fidelização', E'<h1>{{primeiro_nome}}, venda é só o começo!</h1>
<p>Um cliente satisfeito compra de novo e indica amigos. O Morphews te ajuda no pós-venda:</p>
<ul>
  <li>📞 <strong>SAC:</strong> Sistema de tickets para suporte</li>
  <li>📋 <strong>Pós-venda:</strong> Acompanhamento de satisfação</li>
  <li>🔄 <strong>Recompra:</strong> Identifique oportunidades de nova venda</li>
</ul>
<p><a href="https://crm.morphews.com/pos-venda" style="background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Módulo Pós-Venda</a></p>', 11),

-- Dia 20 (Dicas avançadas)
(20, 0, '💡 Dicas avançadas para vender mais', E'<h1>{{primeiro_nome}}, você está mandando bem!</h1>
<p>Depois de 20 dias, você já conhece o básico. Aqui vão dicas avançadas:</p>
<h2>🔥 Power Tips:</h2>
<ol>
  <li><strong>Use estrelas:</strong> Priorize leads 4-5 estrelas</li>
  <li><strong>Secretária IA:</strong> Peça estatísticas pelo WhatsApp!</li>
  <li><strong>Campos customizados:</strong> Crie campos específicos do seu negócio</li>
  <li><strong>Mensagens automáticas:</strong> Configure follow-ups por motivo de não compra</li>
</ol>
<p>💡 Dica: Envie "stats" para a Secretária Morphews e veja suas métricas em tempo real!</p>', 12),

-- Dia 25 (Configurações)
(25, 0, '⚙️ Personalize seu CRM', E'<h1>{{primeiro_nome}}, deixe o CRM com a sua cara!</h1>
<p>Você sabia que pode personalizar quase tudo no Morphews?</p>
<h2>⚙️ Configurações importantes:</h2>
<ul>
  <li>🎨 <strong>Etapas do funil:</strong> Crie as suas próprias</li>
  <li>📝 <strong>Campos customizados:</strong> Adicione informações específicas</li>
  <li>📧 <strong>Templates de mensagem:</strong> Padronize sua comunicação</li>
  <li>🔔 <strong>Notificações:</strong> Escolha o que te avisa</li>
</ul>
<p><a href="https://crm.morphews.com/configuracoes" style="background: #64748b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Configurações</a></p>', 13),

-- Dia 30 (Fechamento)
(30, 0, '🏆 1 Mês com Morphews - Feedback', E'<h1>Parabéns, {{primeiro_nome}}! 🎉</h1>
<p>Você completou <strong>1 mês</strong> usando o Morphews CRM!</p>
<p>Esperamos que o sistema esteja te ajudando a vender mais e melhor.</p>
<h2>📊 Próximos passos:</h2>
<ul>
  <li>📈 Analise seus relatórios do mês</li>
  <li>🎯 Defina metas para o próximo mês</li>
  <li>👥 Treine sua equipe nas funcionalidades avançadas</li>
</ul>
<p>Tem alguma sugestão ou dúvida? Responda este email, adoramos ouvir nossos clientes!</p>
<p>Abraços,<br><strong>Equipe Morphews</strong></p>', 14);

-- Atualizar função de timestamp
CREATE OR REPLACE FUNCTION public.update_onboarding_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_onboarding_templates_timestamp
  BEFORE UPDATE ON public.onboarding_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_onboarding_templates_updated_at();
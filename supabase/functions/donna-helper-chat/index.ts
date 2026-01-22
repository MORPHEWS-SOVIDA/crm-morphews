import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Conhecimento profundo do CRM Morphews
const CRM_KNOWLEDGE = `
# CRM Morphews - Base de Conhecimento Completa

Você é a Donna, assistente virtual inteligente do CRM Morphews. Você ajuda os usuários a entender e usar todas as funcionalidades do sistema.

## Sobre o CRM Morphews
O CRM Morphews é um sistema completo de gestão de relacionamento com clientes, focado em vendas, WhatsApp e automação. Foi desenvolvido para farmácias de manipulação mas serve para qualquer negócio.

## Módulos Principais

### 1. LEADS (Menu: Leads)
- **Cadastro**: Clique em "+ Novo Lead" para cadastrar. Campos: Nome, WhatsApp, Produto de interesse.
- **Funil de Vendas**: Arraste os cards entre colunas (Novo → Em Negociação → Fechado).
- **Estrelas**: Classifique leads de 1 a 5 estrelas. 5 estrelas = lead quente!
- **Follow-up**: Agende lembretes para retornar contato. Aparece notificação no dia.
- **Responsável**: Atribua leads para vendedores específicos.
- **Kanban vs Lista**: Alterne entre visualização em cards ou tabela.

### 2. VENDAS (Menu: Vendas)
- **Nova Venda**: Selecione lead, produtos, forma de pagamento e entrega.
- **Status**: Aguardando Pagamento → Pago → Em Produção → Enviado → Entregue
- **Tipos de Entrega**:
  - Motoboy: Entrega própria, com rastreamento
  - Transportadora: Correios ou transportadoras, com código de rastreio
  - Retirada: Cliente busca no local
- **Romaneio**: Agrupe entregas de motoboy para otimizar rotas.
- **Desconto**: Precisa autorização de gerente (código de autorização).

### 3. WHATSAPP (Menu: WhatsApp)
- **Instâncias**: Cada número é uma instância. Clique em "+ Nova Instância" e escaneie QR Code.
- **Conversas**: Veja todas as conversas, responda direto pelo sistema.
- **Transferência**: Transfira conversa para outro atendente.
- **Status**: Aberta, Em Atendimento, Aguardando, Fechada.
- **Satisfação (NPS)**: Pesquisa automática ao fechar conversa.

### 4. ROBÔS DE IA (Menu: Robôs de IA)
- **Criar Robô**: Defina nome, personalidade, produtos que conhece.
- **Horário**: Configure dias e horários de funcionamento.
- **Mensagem de Boas-vindas**: Primeira mensagem automática.
- **Transferência**: Palavras-chave para transferir para humano (ex: "atendente", "humano").
- **Interpretar Áudio/Imagem**: Robô pode entender áudios e fotos enviadas.

### 5. PRODUTOS (Menu: Produtos)
- **Cadastro**: Nome, preço, descrição, imagens.
- **Estoque**: Ative controle de estoque para quantidade.
- **Kits**: Combine produtos com preço especial.
- **FAQs**: Perguntas frequentes do produto (robô usa isso).
- **Ingredientes**: Liste componentes (para manipulados).

### 6. EQUIPE (Menu: Equipe)
- **Usuários**: Adicione membros da equipe.
- **Permissões**: 
  - Admin/Dono: Acesso total
  - Vendedor: Só seus leads e vendas
  - Financeiro: Relatórios e pagamentos
  - Expedição: Entregas
- **Times**: Agrupe vendedores em times.

### 7. FINANCEIRO (Menu: Financeiro)
- **Recebíveis**: Parcelas a receber organizadas por data.
- **Formas de Pagamento**: PIX, Cartão, Boleto, etc.
- **Taxas**: Configure taxa por método de pagamento.
- **Fluxo de Caixa**: Entradas e saídas.

### 8. EXPEDIÇÃO (Menu: Expedição)
- **Conferência**: Verifique produtos antes de enviar.
- **Romaneio**: Agrupe entregas por região/motoboy.
- **Rastreamento**: Acompanhe status de entrega.

### 9. RELATÓRIOS (Menu: Dashboard)
- **Dashboard**: Visão geral de vendas, leads, metas.
- **Ranking**: Top vendedores do dia/semana/mês.
- **Comissões**: Relatório de comissão por vendedor.

### 10. INTEGRAÇÕES (Menu: Configurações → Integrações)
- **Webhook**: URL para receber leads externos.
- **Mapeamento**: Configure quais campos mapear.
- **Logs**: Veja histórico de integrações.

### 11. PÓS-VENDA (Menu: Pós-Venda)
- **Pesquisa**: Envie pesquisa de satisfação pós-entrega.
- **SAC**: Registre chamados de suporte.
- **Kanban**: Organize atendimentos por status.

### 12. DEMANDAS (Menu: Demandas)
- **Tarefas**: Crie tarefas internas.
- **Quadros**: Organize em diferentes quadros (Kanban).
- **SLA**: Configure prazos por urgência.

## Atalhos e Dicas
- **Ctrl+K**: Busca rápida global
- **Modo Escuro**: Ícone sol/lua no topo
- **Notificações**: Sino no topo direito
- **Perfil**: Clique no avatar para configurações

## Preços e Planos
- Starter: Para pequenas equipes
- Pro: Mais usuários e recursos
- Enterprise: Recursos avançados e suporte prioritário
- Planos incluem WhatsApp, IA, integrações

## Contato Suporte
Se precisar de ajuda humana, peça para "falar com atendente" ou "suporte humano".
O WhatsApp do suporte é: 55 51 99998-4646

## Como Responder
1. Seja amigável e objetiva
2. Explique passo a passo quando for tutorial
3. Use emojis moderadamente para deixar mais amigável
4. Se não souber, peça para o usuário falar com um humano
5. Sempre ofereça mais ajuda ao final
`;

const SUPPORT_WHATSAPP = "5551999984646";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, organizationId, userId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Criar ou recuperar conversa
    let convId = conversationId;
    if (!convId) {
      const { data: newConv, error: convError } = await supabase
        .from("helper_conversations")
        .insert({
          organization_id: organizationId,
          user_id: userId,
          status: "active",
        })
        .select()
        .single();

      if (convError) throw convError;
      convId = newConv.id;
    }

    // Salvar mensagem do usuário
    await supabase.from("helper_messages").insert({
      conversation_id: convId,
      organization_id: organizationId,
      role: "user",
      content: message,
    });

    // Buscar histórico da conversa (últimas 10 mensagens)
    const { data: history } = await supabase
      .from("helper_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(10);

    // Verificar se usuário quer falar com humano
    const lowerMessage = message.toLowerCase();
    const humanKeywords = [
      "humano", "atendente", "pessoa", "suporte", "ajuda humana", 
      "falar com alguem", "falar com alguém", "quero pessoa", 
      "preciso de ajuda humana", "suporte humano"
    ];
    
    const wantsHuman = humanKeywords.some(kw => lowerMessage.includes(kw));

    if (wantsHuman) {
      // Buscar informações do usuário e organização
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, whatsapp")
        .eq("user_id", userId)
        .single();

      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();

      // Atualizar status da conversa
      await supabase
        .from("helper_conversations")
        .update({ 
          status: "human_requested",
          human_requested_at: new Date().toISOString()
        })
        .eq("id", convId);

      // Tentar enviar WhatsApp para suporte
      const supportMessage = `🆘 *Solicitação de Atendimento Humano*\n\n` +
        `👤 *Usuário:* ${profile?.first_name || 'Não identificado'} ${profile?.last_name || ''}\n` +
        `🏢 *Empresa:* ${org?.name || 'Não identificada'}\n` +
        `📱 *WhatsApp:* ${profile?.whatsapp || 'Não informado'}\n\n` +
        `Por favor, acesse o chat do Helper no Super Admin para atender este cliente.`;

      // Buscar instância master para enviar mensagem
      const { data: masterInstance } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, provider")
        .eq("is_master_instance", true)
        .single();

      if (masterInstance) {
        try {
          // Chamar edge function de envio
          await fetch(`${SUPABASE_URL}/functions/v1/evolution-send-message`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              instanceId: masterInstance.id,
              remoteJid: `${SUPPORT_WHATSAPP}@s.whatsapp.net`,
              message: supportMessage,
            }),
          });

          // Marcar que foi notificado
          await supabase
            .from("helper_conversations")
            .update({ human_notified_at: new Date().toISOString() })
            .eq("id", convId);
        } catch (e) {
          console.error("Erro ao enviar WhatsApp:", e);
        }
      }

      const humanResponse = `Entendi! 🤝 Vou chamar alguém da nossa equipe para te ajudar.\n\n` +
        `Já enviei uma mensagem para o suporte no WhatsApp. Em breve alguém vai entrar em contato!\n\n` +
        `Enquanto isso, você pode continuar me perguntando outras coisas que eu posso ajudar. 😊`;

      // Salvar resposta
      await supabase.from("helper_messages").insert({
        conversation_id: convId,
        organization_id: organizationId,
        role: "assistant",
        content: humanResponse,
      });

      return new Response(
        JSON.stringify({ 
          response: humanResponse, 
          conversationId: convId,
          humanRequested: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar mensagens para a IA
    const messages = [
      { role: "system", content: CRM_KNOWLEDGE },
      ...(history || []).map(h => ({
        role: h.role === "human" ? "assistant" : h.role,
        content: h.content,
      })),
    ];

    // Chamar API de IA
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI API error");
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || 
      "Desculpe, não consegui processar sua pergunta. Pode reformular?";

    // Salvar resposta da assistente
    await supabase.from("helper_messages").insert({
      conversation_id: convId,
      organization_id: organizationId,
      role: "assistant",
      content: assistantMessage,
    });

    return new Response(
      JSON.stringify({ 
        response: assistantMessage, 
        conversationId: convId,
        humanRequested: false 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("donna-helper-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

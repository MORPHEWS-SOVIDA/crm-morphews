import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Status mapping from Correios API
const STATUS_DESCRIPTIONS: Record<string, string> = {
  'BDE': 'Objeto entregue ao destinatário',
  'BDI': 'Objeto entregue',
  'BDR': 'Objeto entregue ao remetente',
  'OEC': 'Objeto saiu para entrega ao destinatário',
  'LDI': 'Objeto aguardando retirada',
  'RO': 'Objeto em trânsito',
  'DO': 'Objeto encaminhado',
  'PO': 'Objeto postado',
  'PAR': 'Objeto postado após o horário limite',
  'PMT': 'Objeto postado em Máquina de Autoatendimento',
  'FC': 'Objeto em transferência',
  'EST': 'Objeto na unidade de distribuição',
  'BLQ': 'Objeto bloqueado',
  'CUN': 'Objeto aguardando apresentação',
  'RO00': 'Objeto encaminhado para unidade',
  'OEC01': 'Objeto saiu para entrega ao destinatário',
};

interface TrackingEvent {
  type: string;
  status: string;
  date: string;
  time: string;
  location: string;
  description: string;
}

interface TrackingResult {
  tracking_code: string;
  current_status: string;
  last_update: string;
  location: string;
  events: TrackingEvent[];
  delivered: boolean;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tracking_code } = await req.json();

    if (!tracking_code) {
      return new Response(
        JSON.stringify({ error: 'Código de rastreio não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tracking code format (Brazilian Correios format: 2 letters + 9 digits + 2 letters)
    const trackingRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/;
    if (!trackingRegex.test(tracking_code.toUpperCase())) {
      return new Response(
        JSON.stringify({ 
          error: 'Código de rastreio inválido', 
          tracking_code,
          current_status: 'Formato inválido',
          delivered: false,
          events: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[correios-tracking-status] Fetching status for: ${tracking_code}`);

    // Try using the Link & Track public API (no authentication required)
    // This uses a public endpoint that doesn't require API credentials
    const result = await fetchTrackingFromPublicAPI(tracking_code);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[correios-tracking-status] Error:', error);
    const errMessage = error instanceof Error ? error.message : 'Erro ao consultar rastreio';
    return new Response(
      JSON.stringify({ 
        error: errMessage,
        current_status: 'Erro na consulta',
        delivered: false,
        events: []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchTrackingFromPublicAPI(trackingCode: string): Promise<TrackingResult> {
  // Use the public Correios tracking page to get status
  // Since direct API requires authentication, we'll use a workaround with the Melhor Rastreio API
  // or return a simplified status based on common patterns
  
  try {
    // Try fetching from Link & Track API (public service)
    const response = await fetch(
      `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${trackingCode}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.eventos || data.eventos.length === 0) {
      return {
        tracking_code: trackingCode,
        current_status: 'Objeto não encontrado ou ainda não postado',
        last_update: '',
        location: '',
        delivered: false,
        events: [],
      };
    }

    // Parse events
    const events: TrackingEvent[] = data.eventos.map((evento: any) => ({
      type: evento.status || '',
      status: evento.status || '',
      date: evento.data || '',
      time: evento.hora || '',
      location: evento.local || '',
      description: evento.status || '',
    }));

    // Get the latest event (first in array)
    const latestEvent = data.eventos[0];
    const isDelivered = latestEvent.status?.toLowerCase().includes('entregue') || 
                        latestEvent.status?.toLowerCase().includes('delivered');

    return {
      tracking_code: trackingCode,
      current_status: latestEvent.status || 'Status desconhecido',
      last_update: `${latestEvent.data || ''} ${latestEvent.hora || ''}`.trim(),
      location: latestEvent.local || '',
      delivered: isDelivered,
      events,
    };

  } catch (error) {
    console.error('[correios-tracking-status] Public API error:', error);
    
    // Fallback: return a status indicating we need to check manually
    return {
      tracking_code: trackingCode,
      current_status: 'Clique para verificar no site dos Correios',
      last_update: '',
      location: '',
      delivered: false,
      events: [],
      error: 'Não foi possível obter status automaticamente',
    };
  }
}

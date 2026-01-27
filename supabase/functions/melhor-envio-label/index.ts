import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Melhor Envio API URLs
const MELHOR_ENVIO_API = {
  SANDBOX: 'https://sandbox.melhorenvio.com.br/api/v2',
  // Use the official domain to avoid intermittent DNS issues seen with api.melhorenvio.com.br
  PRODUCTION: 'https://melhorenvio.com.br/api/v2',
};

interface LabelRequest {
  action: 'create_label' | 'get_services';
  organization_id: string;
  sale_id?: string;
  service_id?: number;
  recipient?: {
    name: string;
    cpf_cnpj?: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    phone?: string;
    email?: string;
  };
  package?: {
    weight_grams?: number;
    height_cm?: number;
    width_cm?: number;
    length_cm?: number;
    declared_value_cents?: number;
  };
  invoice?: {
    number?: string;
    key?: string;
  };
  products?: Array<{
    name: string;
    quantity: number;
    unitary_value_cents: number;
  }>;
}

// Default services when API is unreachable
const DEFAULT_SERVICES = [
  { id: 1, name: 'PAC', company: { id: 1, name: 'Correios', picture: '' } },
  { id: 2, name: 'SEDEX', company: { id: 1, name: 'Correios', picture: '' } },
  { id: 3, name: 'Mini Envios', company: { id: 1, name: 'Correios', picture: '' } },
  { id: 17, name: '.Package', company: { id: 2, name: 'Jadlog', picture: '' } },
  { id: 27, name: '.Com', company: { id: 2, name: 'Jadlog', picture: '' } },
  { id: 9, name: 'LATAM Cargo', company: { id: 3, name: 'LATAM Cargo', picture: '' } },
  { id: 22, name: 'Expresso', company: { id: 9, name: 'Azul Cargo', picture: '' } },
];

async function getAvailableServices(token: string, baseUrl: string): Promise<any[]> {
  try {
    const response = await fetch(`${baseUrl}/me/shipment/services`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Morphews CRM (thiago@sonatura.com.br)',
      },
    });

    if (!response.ok) {
      console.warn('[Melhor Envio] Failed to fetch services, using defaults');
      return DEFAULT_SERVICES;
    }

    return response.json();
  } catch (error) {
    console.warn('[Melhor Envio] Error fetching services, using defaults:', error);
    return DEFAULT_SERVICES;
  }
}

async function createLabel(
  token: string,
  baseUrl: string,
  supabase: any,
  request: LabelRequest,
  config: any
): Promise<any> {
  const { recipient, package: pkg, service_id, invoice, products, sale_id, organization_id } = request;

  if (!recipient) throw new Error('Destinatário é obrigatório');
  if (!service_id) throw new Error('Serviço é obrigatório');

  // Step 1: Add to cart
  // Detect if sender document is CPF (11 digits) or CNPJ (14 digits)
  const senderDoc = config.sender_cpf_cnpj?.replace(/\D/g, '') || '';
  const isCNPJ = senderDoc.length === 14;
  const senderCPF = isCNPJ ? '' : senderDoc;
  const senderCNPJ = isCNPJ ? senderDoc : (config.sender_cnpj?.replace(/\D/g, '') || '');

  const cartPayload = {
    service: service_id,
    agency: config.default_agency_id || undefined,
    from: {
      name: config.sender_name,
      phone: config.sender_phone?.replace(/\D/g, ''),
      email: config.sender_email,
      document: senderCPF || undefined,
      company_document: senderCNPJ || undefined,
      state_register: config.sender_ie,
      address: config.sender_street,
      complement: config.sender_complement,
      number: config.sender_number,
      district: config.sender_neighborhood,
      city: config.sender_city,
      country_id: 'BR',
      postal_code: config.sender_cep?.replace(/\D/g, ''),
      note: '',
    },
    to: {
      name: recipient.name,
      phone: recipient.phone?.replace(/\D/g, ''),
      email: recipient.email,
      document: recipient.cpf_cnpj?.replace(/\D/g, ''),
      address: recipient.street,
      complement: recipient.complement,
      number: recipient.number,
      district: recipient.neighborhood,
      city: recipient.city,
      state_abbr: recipient.state,
      country_id: 'BR',
      postal_code: recipient.cep?.replace(/\D/g, ''),
    },
    products: products?.map(p => ({
      name: p.name,
      quantity: p.quantity,
      unitary_value: p.unitary_value_cents / 100,
    })) || [{ name: 'Produto', quantity: 1, unitary_value: (pkg?.declared_value_cents || 1000) / 100 }],
    volumes: [{
      height: pkg?.height_cm || config.default_height_cm || 10,
      width: pkg?.width_cm || config.default_width_cm || 15,
      length: pkg?.length_cm || config.default_length_cm || 20,
      weight: (pkg?.weight_grams || config.default_weight_grams || 500) / 1000,
    }],
    options: {
      insurance_value: pkg?.declared_value_cents ? pkg.declared_value_cents / 100 : 0,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: !invoice?.key,
      invoice: invoice?.key ? { key: invoice.key } : undefined,
    },
  };

  console.log('[Melhor Envio] Cart payload:', JSON.stringify(cartPayload, null, 2));

  let orderId: string | undefined;

  // Add timeout to avoid hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const cartResponse = await fetch(`${baseUrl}/me/cart`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Morphews CRM (thiago@sonatura.com.br)',
      },
      body: JSON.stringify(cartPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const cartText = await cartResponse.text();
    console.log('[Melhor Envio] Cart response:', cartResponse.status, cartText.substring(0, 500));

    if (!cartResponse.ok) {
      let errorMsg = 'Erro ao adicionar ao carrinho';
      try {
        const errorData = JSON.parse(cartText);
        errorMsg = errorData.message || errorData.error || JSON.stringify(errorData.errors) || errorMsg;
      } catch {
        errorMsg = cartText.substring(0, 200);
      }
      throw new Error(errorMsg);
    }

    const cartData = JSON.parse(cartText);
    orderId = cartData.id;

    if (!orderId) {
      throw new Error('ID do pedido não retornado pelo Melhor Envio');
    }

    console.log('[Melhor Envio] Order ID:', orderId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao conectar com Melhor Envio. Verifique sua conexão e tente novamente.');
      }
      // DNS or network error
      if (error.message.includes('dns error') || error.message.includes('failed to lookup')) {
        throw new Error('Não foi possível conectar com a API do Melhor Envio. Por favor, entre em contato com o suporte técnico.');
      }
    }
    throw error;
  }

  if (!orderId) {
    throw new Error('ID do pedido não foi criado');
  }

  // Step 2: Checkout (pay for the label)
  const checkoutPayload = { orders: [orderId] };

  const checkoutResponse = await fetch(`${baseUrl}/me/shipment/checkout`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Morphews CRM (thiago@sonatura.com.br)',
    },
    body: JSON.stringify(checkoutPayload),
  });

  const checkoutText = await checkoutResponse.text();
  console.log('[Melhor Envio] Checkout response:', checkoutResponse.status, checkoutText.substring(0, 500));

  if (!checkoutResponse.ok) {
    let errorMsg = 'Erro no checkout';
    try {
      const errorData = JSON.parse(checkoutText);
      errorMsg = errorData.message || errorData.error || JSON.stringify(errorData.errors) || errorMsg;
    } catch {
      errorMsg = checkoutText.substring(0, 200);
    }
    throw new Error(errorMsg);
  }

  const checkoutData = JSON.parse(checkoutText);
  const purchasedOrder = checkoutData.purchase?.orders?.[0] || checkoutData[orderId];
  
  if (!purchasedOrder) {
    throw new Error('Dados do pedido não retornados após checkout');
  }

  // Step 3: Generate labels
  const generatePayload = { orders: [orderId] };

  const generateResponse = await fetch(`${baseUrl}/me/shipment/generate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Morphews CRM (thiago@sonatura.com.br)',
    },
    body: JSON.stringify(generatePayload),
  });

  const generateText = await generateResponse.text();
  console.log('[Melhor Envio] Generate response:', generateResponse.status, generateText.substring(0, 500));

  if (!generateResponse.ok) {
    console.warn('[Melhor Envio] Generate failed, label might not be ready yet');
  }

  // Step 4: Get print URL
  const printPayload = { orders: [orderId] };

  const printResponse = await fetch(`${baseUrl}/me/shipment/print`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Morphews CRM (thiago@sonatura.com.br)',
    },
    body: JSON.stringify(printPayload),
  });

  const printText = await printResponse.text();
  console.log('[Melhor Envio] Print response:', printResponse.status, printText.substring(0, 500));

  let labelPdfUrl = null;
  if (printResponse.ok) {
    try {
      const printData = JSON.parse(printText);
      labelPdfUrl = printData.url;
    } catch {
      console.warn('[Melhor Envio] Could not parse print response');
    }
  }

  // Get tracking code from order info
  const trackingCode = purchasedOrder.tracking || orderId;
  const serviceName = purchasedOrder.service?.name || `Serviço ${service_id}`;

  // Save label to database
  const labelData = {
    organization_id,
    sale_id: sale_id || null,
    melhor_envio_order_id: orderId,
    tracking_code: trackingCode,
    service_id,
    service_name: serviceName,
    company_name: purchasedOrder.service?.company?.name,
    recipient_name: recipient.name,
    recipient_cpf_cnpj: recipient.cpf_cnpj,
    recipient_street: recipient.street,
    recipient_number: recipient.number,
    recipient_complement: recipient.complement,
    recipient_neighborhood: recipient.neighborhood,
    recipient_city: recipient.city,
    recipient_state: recipient.state,
    recipient_cep: recipient.cep,
    recipient_phone: recipient.phone,
    weight_grams: pkg?.weight_grams,
    height_cm: pkg?.height_cm,
    width_cm: pkg?.width_cm,
    length_cm: pkg?.length_cm,
    declared_value_cents: pkg?.declared_value_cents,
    label_pdf_url: labelPdfUrl,
    status: 'generated',
  };

  const { data: savedLabel, error: saveError } = await supabase
    .from('melhor_envio_labels')
    .insert(labelData)
    .select()
    .single();

  if (saveError) {
    console.error('[Melhor Envio] Error saving label:', saveError);
  }

  // Update sale with tracking code
  if (sale_id) {
    await supabase
      .from('sales')
      .update({ tracking_code: trackingCode })
      .eq('id', sale_id);
  }

  return {
    success: true,
    order_id: orderId,
    tracking_code: trackingCode,
    service_name: serviceName,
    label_pdf_url: labelPdfUrl,
    label: savedLabel,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: LabelRequest = await req.json();
    const { action, organization_id } = body;

    if (!organization_id) {
      throw new Error('organization_id é obrigatório');
    }

    // Get Melhor Envio config
    const { data: config, error: configError } = await supabase
      .from('melhor_envio_config')
      .select('*')
      .eq('organization_id', organization_id)
      .single();

    if (configError || !config) {
      throw new Error('Configuração do Melhor Envio não encontrada');
    }

    if (!config.is_active) {
      throw new Error('Integração com Melhor Envio está desativada');
    }

    const baseUrl = config.ambiente === 'sandbox' ? MELHOR_ENVIO_API.SANDBOX : MELHOR_ENVIO_API.PRODUCTION;

    // Token selection by environment (prevents using sandbox token in production and vice-versa)
    // PRIORITY: 1) config.token_encrypted from DB, 2) env var for specific environment, 3) generic env var
    let token: string | undefined;
    
    if (config.token_encrypted) {
      token = config.token_encrypted;
      console.log('[Melhor Envio] Using token from database config');
    } else if (config.ambiente === 'sandbox') {
      token = Deno.env.get('MELHOR_ENVIO_TOKEN_SANDBOX') || Deno.env.get('MELHOR_ENVIO_TOKEN');
      console.log('[Melhor Envio] Using SANDBOX token from env:', token ? 'found' : 'NOT FOUND');
    } else {
      token = Deno.env.get('MELHOR_ENVIO_TOKEN_PRODUCTION') || Deno.env.get('MELHOR_ENVIO_TOKEN');
      console.log('[Melhor Envio] Using PRODUCTION token from env:', token ? 'found' : 'NOT FOUND');
    }

    console.log('[Melhor Envio] Environment:', config.ambiente, '| Base URL:', baseUrl);

    if (!token) {
      throw new Error(
        config.ambiente === 'sandbox'
          ? 'Token do Melhor Envio (sandbox) não configurado. Adicione MELHOR_ENVIO_TOKEN_SANDBOX nos secrets.'
          : 'Token do Melhor Envio (produção) não configurado. Adicione MELHOR_ENVIO_TOKEN_PRODUCTION nos secrets.'
      );
    }

    if (action === 'get_services') {
      const services = await getAvailableServices(token, baseUrl);
      return new Response(
        JSON.stringify({ success: true, services }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create_label') {
      const result = await createLabel(token, baseUrl, supabase, body, config);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (error: unknown) {
    console.error('[Melhor Envio] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

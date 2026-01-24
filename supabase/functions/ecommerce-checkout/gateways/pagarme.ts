// Pagarme Gateway Implementation - API V5
import { GatewayResponse, PaymentRequest, GatewayConfig } from "../types.ts";

export async function processPagarmePayment(
  config: GatewayConfig,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const secretKey = config.api_key_encrypted;
  
  // V5 uses core endpoint
  const baseUrl = config.is_sandbox
    ? 'https://api.pagar.me/core/v5'
    : 'https://api.pagar.me/core/v5';

  try {
    if (request.payment_method === 'pix') {
      return await createPagarmePixV5(baseUrl, secretKey, request);
    } else if (request.payment_method === 'credit_card') {
      return await createPagarmeCardV5(baseUrl, secretKey, request);
    } else if (request.payment_method === 'boleto') {
      return await createPagarmeBoletoV5(baseUrl, secretKey, request);
    }
    
    throw new Error('Método de pagamento não suportado');
  } catch (error) {
    console.error('[Pagarme V5] Error:', error);
    return {
      success: false,
      error_code: 'GATEWAY_ERROR',
      error_message: error instanceof Error ? error.message : 'Erro no Pagarme',
    };
  }
}

// V5 uses Basic Auth with secret key
function getAuthHeaders(secretKey: string): Record<string, string> {
  const authString = btoa(`${secretKey}:`);
  return {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${authString}`,
  };
}

// Format phone for V5 (requires country_code, area_code, number separately)
function formatPhoneV5(phone: string): { country_code: string; area_code: string; number: string } {
  const cleaned = phone.replace(/\D/g, '');
  // Assume Brazilian phone: 11999999999
  if (cleaned.length >= 10) {
    return {
      country_code: '55',
      area_code: cleaned.slice(0, 2),
      number: cleaned.slice(2),
    };
  }
  return { country_code: '55', area_code: '11', number: cleaned };
}

async function createPagarmePixV5(
  baseUrl: string,
  secretKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const phone = formatPhoneV5(request.customer.phone);
  
  // V5 PIX uses /orders endpoint with pix payment
  const payload = {
    customer: {
      name: request.customer.name,
      email: request.customer.email,
      type: 'individual',
      document: request.customer.document?.replace(/\D/g, '') || '00000000000',
      phones: {
        mobile_phone: phone,
      },
    },
    items: [
      {
        amount: request.amount_cents,
        description: `Pedido ${request.sale_id}`,
        quantity: 1,
        code: request.sale_id,
      },
    ],
    payments: [
      {
        payment_method: 'pix',
        pix: {
          expires_in: 1800, // 30 minutes in seconds
        },
      },
    ],
    metadata: { sale_id: request.sale_id },
  };

  console.log('[Pagarme V5] Creating PIX order:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: getAuthHeaders(secretKey),
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  
  console.log('[Pagarme V5] PIX response status:', response.status);
  console.log('[Pagarme V5] PIX response:', JSON.stringify(result, null, 2));

  if (!response.ok || result.message) {
    return {
      success: false,
      error_code: result.type || 'PAGARME_ERROR',
      error_message: result.message || result.errors?.[0]?.message || 'Erro ao processar PIX',
      raw_response: result,
    };
  }

  // V5 returns charge with pix transaction inside
  const charge = result.charges?.[0];
  const lastTransaction = charge?.last_transaction;
  
  return {
    success: true,
    transaction_id: result.id || charge?.id,
    payment_url: lastTransaction?.qr_code_url,
    pix_code: lastTransaction?.qr_code,
    pix_expiration: lastTransaction?.expires_at,
    status: result.status,
    raw_response: result,
  };
}

async function createPagarmeCardV5(
  baseUrl: string,
  secretKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const phone = formatPhoneV5(request.customer.phone);
  
  // Build card payment object
  let creditCardPayment: Record<string, unknown> = {
    installments: request.installments || 1,
    capture: true,
    statement_descriptor: 'MORPHEWS',
  };

  // Priority: saved card token > raw card data
  if (request.card_token) {
    // V5: Use card_id for saved cards
    creditCardPayment.card_id = request.card_token;
  } else if (request.card_data) {
    // V5: Send card data directly
    creditCardPayment.card = {
      number: request.card_data.number.replace(/\D/g, ''),
      holder_name: request.card_data.holder_name.toUpperCase(),
      exp_month: parseInt(request.card_data.exp_month, 10),
      exp_year: parseInt(request.card_data.exp_year, 10),
      cvv: request.card_data.cvv,
      billing_address: {
        line_1: `${request.customer.address?.number || '0'}, ${request.customer.address?.street || 'Não informado'}`,
        line_2: request.customer.address?.complement || '',
        zip_code: request.customer.address?.zip_code?.replace(/\D/g, '') || '01000000',
        city: request.customer.address?.city || 'São Paulo',
        state: request.customer.address?.state || 'SP',
        country: 'BR',
      },
    };
  } else {
    return {
      success: false,
      error_code: 'MISSING_CARD_DATA',
      error_message: 'Dados do cartão não informados',
    };
  }

  const payload = {
    customer: {
      name: request.customer.name,
      email: request.customer.email,
      type: 'individual',
      document: request.customer.document?.replace(/\D/g, '') || '00000000000',
      phones: {
        mobile_phone: phone,
      },
    },
    items: [
      {
        amount: request.amount_cents,
        description: `Pedido ${request.sale_id}`,
        quantity: 1,
        code: request.sale_id,
      },
    ],
    payments: [
      {
        payment_method: 'credit_card',
        credit_card: creditCardPayment,
      },
    ],
    metadata: { sale_id: request.sale_id },
  };

  console.log('[Pagarme V5] Creating card order:', {
    amount: request.amount_cents,
    installments: creditCardPayment.installments,
    hasCardId: !!creditCardPayment.card_id,
    hasCardData: !!creditCardPayment.card,
  });

  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: getAuthHeaders(secretKey),
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  console.log('[Pagarme V5] Card response status:', response.status);
  console.log('[Pagarme V5] Card response:', JSON.stringify(result, null, 2));

  if (!response.ok || result.message) {
    console.error('[Pagarme V5] Card transaction failed:', result);
    
    // Map V5 errors
    const errorType = result.type || 'PAGARME_ERROR';
    const errorMapping: Record<string, string> = {
      'action_forbidden': 'IP_NOT_AUTHORIZED',
      'invalid_request_error': 'INVALID_DATA',
      'card_declined': 'CARD_DECLINED',
      'processing_error': 'GATEWAY_ERROR',
    };
    
    return {
      success: false,
      error_code: errorMapping[errorType] || errorType,
      error_message: result.message || result.errors?.[0]?.message || 'Erro ao processar cartão',
      raw_response: result,
    };
  }

  // Check order status
  const charge = result.charges?.[0];
  const lastTransaction = charge?.last_transaction;
  const isApproved = result.status === 'paid' || charge?.status === 'paid';
  
  return {
    success: isApproved,
    transaction_id: result.id || charge?.id,
    payment_url: '',
    status: result.status,
    card_id: lastTransaction?.card?.id,
    card_last_digits: lastTransaction?.card?.last_four_digits,
    card_brand: lastTransaction?.card?.brand,
    raw_response: result,
    error_code: isApproved ? undefined : 'CARD_DECLINED',
    error_message: isApproved ? undefined : `Pagamento ${result.status || charge?.status}`,
  };
}

async function createPagarmeBoletoV5(
  baseUrl: string,
  secretKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const phone = formatPhoneV5(request.customer.phone);
  
  // Calculate expiration (3 days from now)
  const expirationDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  
  const payload = {
    customer: {
      name: request.customer.name,
      email: request.customer.email,
      type: 'individual',
      document: request.customer.document?.replace(/\D/g, '') || '00000000000',
      phones: {
        mobile_phone: phone,
      },
    },
    items: [
      {
        amount: request.amount_cents,
        description: `Pedido ${request.sale_id}`,
        quantity: 1,
        code: request.sale_id,
      },
    ],
    payments: [
      {
        payment_method: 'boleto',
        boleto: {
          bank: '237', // Bradesco default
          instructions: 'Pagar até a data de vencimento',
          due_at: expirationDate.toISOString(),
        },
      },
    ],
    metadata: { sale_id: request.sale_id },
  };

  console.log('[Pagarme V5] Creating boleto order:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: getAuthHeaders(secretKey),
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  console.log('[Pagarme V5] Boleto response status:', response.status);
  console.log('[Pagarme V5] Boleto response:', JSON.stringify(result, null, 2));

  if (!response.ok || result.message) {
    return {
      success: false,
      error_code: result.type || 'PAGARME_ERROR',
      error_message: result.message || result.errors?.[0]?.message || 'Erro ao gerar boleto',
      raw_response: result,
    };
  }

  const charge = result.charges?.[0];
  const lastTransaction = charge?.last_transaction;

  return {
    success: true,
    transaction_id: result.id || charge?.id,
    payment_url: lastTransaction?.pdf || lastTransaction?.url,
    boleto_barcode: lastTransaction?.line,
    boleto_expiration: lastTransaction?.due_at,
    status: result.status,
    raw_response: result,
  };
}

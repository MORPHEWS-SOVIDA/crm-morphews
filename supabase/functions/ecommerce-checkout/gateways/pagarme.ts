// Pagarme Gateway Implementation
import { GatewayResponse, PaymentRequest, GatewayConfig } from "../types.ts";

export async function processPagarmePayment(
  config: GatewayConfig,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const apiKey = config.api_key_encrypted;
  const baseUrl = config.is_sandbox
    ? 'https://api.pagar.me/1'
    : 'https://api.pagar.me/1';

  try {
    if (request.payment_method === 'pix') {
      return await createPagarmePix(baseUrl, apiKey, request);
    } else if (request.payment_method === 'credit_card') {
      return await createPagarmeCard(baseUrl, apiKey, request);
    } else if (request.payment_method === 'boleto') {
      return await createPagarmeBoleto(baseUrl, apiKey, request);
    }
    
    throw new Error('Método de pagamento não suportado');
  } catch (error) {
    console.error('Pagarme error:', error);
    return {
      success: false,
      error_code: 'GATEWAY_ERROR',
      error_message: error instanceof Error ? error.message : 'Erro no Pagarme',
    };
  }
}

async function createPagarmePix(
  baseUrl: string,
  apiKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const response = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      amount: request.amount_cents,
      payment_method: 'pix',
      pix_expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      customer: {
        external_id: request.sale_id,
        name: request.customer.name,
        email: request.customer.email,
        type: 'individual',
        country: 'br',
        phone_numbers: [`+55${request.customer.phone}`],
        documents: request.customer.document ? [{
          type: 'cpf',
          number: request.customer.document.replace(/\D/g, ''),
        }] : undefined,
      },
      postback_url: request.postback_url,
      metadata: { sale_id: request.sale_id },
    }),
  });

  const result = await response.json();
  
  if (!response.ok || result.errors) {
    return {
      success: false,
      error_code: result.errors?.[0]?.type || 'PAGARME_ERROR',
      error_message: result.errors?.[0]?.message || 'Erro ao processar PIX',
    };
  }

  return {
    success: true,
    transaction_id: String(result.id),
    payment_url: result.pix_qr_code,
    pix_code: result.pix_qr_code,
    pix_expiration: result.pix_expiration_date,
    status: result.status,
    raw_response: result,
  };
}

async function createPagarmeCard(
  baseUrl: string,
  apiKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const body: Record<string, unknown> = {
    api_key: apiKey,
    amount: request.amount_cents,
    payment_method: 'credit_card',
    installments: request.installments || 1,
    customer: {
      external_id: request.sale_id,
      name: request.customer.name,
      email: request.customer.email,
      type: 'individual',
      country: 'br',
      phone_numbers: [`+55${request.customer.phone}`],
    },
    postback_url: request.postback_url,
    metadata: { sale_id: request.sale_id },
  };

  // If we have a saved card token, use it
  if (request.card_token) {
    body.card_id = request.card_token;
  } else if (request.card_hash) {
    body.card_hash = request.card_hash;
  }

  const response = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || result.errors) {
    return {
      success: false,
      error_code: result.errors?.[0]?.type || 'PAGARME_ERROR',
      error_message: result.errors?.[0]?.message || 'Erro ao processar cartão',
    };
  }

  return {
    success: true,
    transaction_id: String(result.id),
    payment_url: result.checkout_url || '',
    status: result.status,
    card_id: result.card?.id,
    card_last_digits: result.card?.last_digits,
    card_brand: result.card?.brand,
    raw_response: result,
  };
}

async function createPagarmeBoleto(
  baseUrl: string,
  apiKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const response = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      amount: request.amount_cents,
      payment_method: 'boleto',
      boleto_expiration_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      customer: {
        external_id: request.sale_id,
        name: request.customer.name,
        email: request.customer.email,
        type: 'individual',
        country: 'br',
        phone_numbers: [`+55${request.customer.phone}`],
      },
      postback_url: request.postback_url,
      metadata: { sale_id: request.sale_id },
    }),
  });

  const result = await response.json();

  if (!response.ok || result.errors) {
    return {
      success: false,
      error_code: result.errors?.[0]?.type || 'PAGARME_ERROR',
      error_message: result.errors?.[0]?.message || 'Erro ao gerar boleto',
    };
  }

  return {
    success: true,
    transaction_id: String(result.id),
    payment_url: result.boleto_url,
    boleto_barcode: result.boleto_barcode,
    boleto_expiration: result.boleto_expiration_date,
    status: result.status,
    raw_response: result,
  };
}

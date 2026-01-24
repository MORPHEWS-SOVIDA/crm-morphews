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
    capture: true,
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
    billing: request.customer.document ? {
      name: request.customer.name,
      address: {
        country: 'br',
        state: 'sp',
        city: 'São Paulo',
        street: 'Não informado',
        street_number: '0',
        zipcode: '01000000',
      },
    } : undefined,
    postback_url: request.postback_url,
    metadata: { sale_id: request.sale_id },
  };

  // Priority: saved card > card_hash > card_data (raw card)
  if (request.card_token) {
    // Using saved card
    body.card_id = request.card_token;
  } else if (request.card_hash) {
    // Using card hash from JS SDK
    body.card_hash = request.card_hash;
  } else if (request.card_data) {
    // Using raw card data - must be encrypted in transmission
    body.card_number = request.card_data.number;
    body.card_holder_name = request.card_data.holder_name;
    body.card_expiration_date = `${request.card_data.exp_month}${request.card_data.exp_year.slice(-2)}`;
    body.card_cvv = request.card_data.cvv;
  } else {
    return {
      success: false,
      error_code: 'MISSING_CARD_DATA',
      error_message: 'Dados do cartão não informados',
    };
  }

  console.log('[Pagarme] Creating card transaction with:', {
    amount: body.amount,
    installments: body.installments,
    hasCardId: !!body.card_id,
    hasCardHash: !!body.card_hash,
    hasRawCard: !!body.card_number,
  });

  const response = await fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || result.errors) {
    console.error('[Pagarme] Card transaction failed:', result);
    
    // Map common Pagarme errors to our error codes
    const pagarmeError = result.errors?.[0]?.type || 'PAGARME_ERROR';
    const errorMapping: Record<string, string> = {
      'refused': 'CARD_DECLINED',
      'antifraud': 'FRAUD_SUSPECTED',
      'internal_error': 'GATEWAY_ERROR',
      'invalid_parameter': 'INVALID_DATA',
    };
    
    return {
      success: false,
      error_code: errorMapping[pagarmeError] || pagarmeError,
      error_message: result.errors?.[0]?.message || 'Erro ao processar cartão',
      raw_response: result,
    };
  }

  // Check transaction status
  const isApproved = result.status === 'paid' || result.status === 'authorized';
  
  return {
    success: isApproved,
    transaction_id: String(result.id),
    payment_url: result.checkout_url || '',
    status: result.status,
    card_id: result.card?.id,
    card_last_digits: result.card?.last_digits,
    card_brand: result.card?.brand,
    raw_response: result,
    error_code: isApproved ? undefined : 'CARD_DECLINED',
    error_message: isApproved ? undefined : `Pagamento ${result.status}`,
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

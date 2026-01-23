// Asaas Gateway Implementation
import { GatewayResponse, PaymentRequest, GatewayConfig } from "../types.ts";

export async function processAsaasPayment(
  config: GatewayConfig,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const apiKey = config.api_key_encrypted;
  const baseUrl = config.is_sandbox
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/api/v3';

  try {
    // First, get or create customer
    const customerId = await getOrCreateAsaasCustomer(baseUrl, apiKey, request);

    if (request.payment_method === 'pix') {
      return await createAsaasPix(baseUrl, apiKey, customerId, request);
    } else if (request.payment_method === 'credit_card') {
      return await createAsaasCard(baseUrl, apiKey, customerId, request);
    } else if (request.payment_method === 'boleto') {
      return await createAsaasBoleto(baseUrl, apiKey, customerId, request);
    }

    throw new Error('Método de pagamento não suportado');
  } catch (error) {
    console.error('Asaas error:', error);
    return {
      success: false,
      error_code: 'GATEWAY_ERROR',
      error_message: error instanceof Error ? error.message : 'Erro no Asaas',
    };
  }
}

async function getOrCreateAsaasCustomer(
  baseUrl: string,
  apiKey: string,
  request: PaymentRequest
): Promise<string> {
  const cpfCnpj = request.customer.document?.replace(/\D/g, '') || '';

  // Search existing customer
  if (cpfCnpj) {
    const searchResponse = await fetch(
      `${baseUrl}/customers?cpfCnpj=${cpfCnpj}`,
      {
        headers: {
          'access_token': apiKey,
        },
      }
    );

    const searchResult = await searchResponse.json();
    if (searchResult.data?.length > 0) {
      return searchResult.data[0].id;
    }
  }

  // Create new customer
  const createResponse = await fetch(`${baseUrl}/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    },
    body: JSON.stringify({
      name: request.customer.name,
      email: request.customer.email,
      phone: request.customer.phone,
      cpfCnpj,
      externalReference: request.sale_id,
    }),
  });

  const createResult = await createResponse.json();
  
  if (!createResponse.ok || createResult.errors) {
    throw new Error(createResult.errors?.[0]?.description || 'Erro ao criar cliente');
  }

  return createResult.id;
}

async function createAsaasPix(
  baseUrl: string,
  apiKey: string,
  customerId: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const dueDate = new Date(Date.now() + 30 * 60 * 1000);
  
  const response = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: request.amount_cents / 100,
      dueDate: dueDate.toISOString().split('T')[0],
      externalReference: request.sale_id,
      description: `Pedido ${request.sale_id}`,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.errors) {
    return {
      success: false,
      error_code: result.errors?.[0]?.code || 'ASAAS_PIX_ERROR',
      error_message: result.errors?.[0]?.description || 'Erro ao gerar PIX',
    };
  }

  // Get PIX QR Code
  const pixResponse = await fetch(`${baseUrl}/payments/${result.id}/pixQrCode`, {
    headers: { 'access_token': apiKey },
  });
  const pixData = await pixResponse.json();

  return {
    success: true,
    transaction_id: result.id,
    payment_url: pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : '',
    pix_code: pixData.payload,
    pix_expiration: pixData.expirationDate,
    status: mapAsaasStatus(result.status),
    raw_response: { ...result, pix: pixData },
  };
}

async function createAsaasCard(
  baseUrl: string,
  apiKey: string,
  customerId: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const body: Record<string, unknown> = {
    customer: customerId,
    billingType: 'CREDIT_CARD',
    value: request.amount_cents / 100,
    dueDate: new Date().toISOString().split('T')[0],
    externalReference: request.sale_id,
    description: `Pedido ${request.sale_id}`,
    installmentCount: request.installments || 1,
  };

  // If we have a saved card token
  if (request.card_token) {
    body.creditCardToken = request.card_token;
  }

  const response = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || result.errors) {
    return {
      success: false,
      error_code: result.errors?.[0]?.code || 'ASAAS_CARD_ERROR',
      error_message: result.errors?.[0]?.description || 'Erro ao processar cartão',
    };
  }

  return {
    success: true,
    transaction_id: result.id,
    payment_url: result.invoiceUrl || '',
    status: mapAsaasStatus(result.status),
    card_last_digits: result.creditCard?.creditCardNumber?.slice(-4),
    card_brand: result.creditCard?.creditCardBrand,
    raw_response: result,
  };
}

async function createAsaasBoleto(
  baseUrl: string,
  apiKey: string,
  customerId: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const response = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: 'BOLETO',
      value: request.amount_cents / 100,
      dueDate: dueDate.toISOString().split('T')[0],
      externalReference: request.sale_id,
      description: `Pedido ${request.sale_id}`,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.errors) {
    return {
      success: false,
      error_code: result.errors?.[0]?.code || 'ASAAS_BOLETO_ERROR',
      error_message: result.errors?.[0]?.description || 'Erro ao gerar boleto',
    };
  }

  return {
    success: true,
    transaction_id: result.id,
    payment_url: result.bankSlipUrl,
    boleto_barcode: result.identificationField,
    boleto_expiration: result.dueDate,
    status: mapAsaasStatus(result.status),
    raw_response: result,
  };
}

function mapAsaasStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'PENDING': 'pending',
    'RECEIVED': 'paid',
    'CONFIRMED': 'paid',
    'OVERDUE': 'overdue',
    'REFUNDED': 'refunded',
    'RECEIVED_IN_CASH': 'paid',
    'REFUND_REQUESTED': 'refund_pending',
    'CHARGEBACK_REQUESTED': 'chargeback',
    'CHARGEBACK_DISPUTE': 'chargeback',
    'AWAITING_CHARGEBACK_REVERSAL': 'chargeback',
    'DUNNING_RECEIVED': 'paid',
    'DUNNING_REQUESTED': 'pending',
    'AWAITING_RISK_ANALYSIS': 'analyzing',
  };
  return statusMap[status] || status.toLowerCase();
}

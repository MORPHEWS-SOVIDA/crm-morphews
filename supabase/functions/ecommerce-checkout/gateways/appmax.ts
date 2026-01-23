// Appmax Gateway Implementation
import { GatewayResponse, PaymentRequest, GatewayConfig } from "../types.ts";

export async function processAppmaxPayment(
  config: GatewayConfig,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const apiKey = config.api_key_encrypted;
  const baseUrl = config.is_sandbox
    ? 'https://sandbox.appmax.com.br/api/v3'
    : 'https://admin.appmax.com.br/api/v3';

  try {
    // Create order first
    const orderResult = await createAppmaxOrder(baseUrl, apiKey, request);
    
    if (!orderResult.success) {
      return orderResult;
    }

    const orderId = orderResult.order_id!;

    // Process payment based on method
    if (request.payment_method === 'pix') {
      return await createAppmaxPix(baseUrl, apiKey, orderId);
    } else if (request.payment_method === 'credit_card') {
      return await createAppmaxCard(baseUrl, apiKey, orderId, request);
    } else if (request.payment_method === 'boleto') {
      return await createAppmaxBoleto(baseUrl, apiKey, orderId);
    }

    throw new Error('Método de pagamento não suportado');
  } catch (error) {
    console.error('Appmax error:', error);
    return {
      success: false,
      error_code: 'GATEWAY_ERROR',
      error_message: error instanceof Error ? error.message : 'Erro no Appmax',
    };
  }
}

async function createAppmaxOrder(
  baseUrl: string,
  apiKey: string,
  request: PaymentRequest
): Promise<GatewayResponse & { order_id?: string }> {
  const response = await fetch(`${baseUrl}/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      external_id: request.sale_id,
      customer: {
        firstname: request.customer.name.split(' ')[0],
        lastname: request.customer.name.split(' ').slice(1).join(' ') || '-',
        email: request.customer.email,
        telephone: request.customer.phone,
        cpf: request.customer.document?.replace(/\D/g, '') || '',
      },
      products: [{
        sku: 'CHECKOUT',
        name: 'Compra Online',
        qty: 1,
        price: request.amount_cents / 100,
      }],
      postback_url: request.postback_url,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.data?.id) {
    return {
      success: false,
      error_code: 'APPMAX_ORDER_ERROR',
      error_message: result.message || 'Erro ao criar pedido na Appmax',
    };
  }

  return {
    success: true,
    order_id: result.data.id,
    transaction_id: result.data.id,
  };
}

async function createAppmaxPix(
  baseUrl: string,
  apiKey: string,
  orderId: string
): Promise<GatewayResponse> {
  const response = await fetch(`${baseUrl}/pix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error_code: 'APPMAX_PIX_ERROR',
      error_message: result.message || 'Erro ao gerar PIX',
    };
  }

  return {
    success: true,
    transaction_id: orderId,
    payment_url: result.data?.pix_qrcode || '',
    pix_code: result.data?.pix_code,
    status: result.data?.status || 'pending',
    raw_response: result,
  };
}

async function createAppmaxCard(
  baseUrl: string,
  apiKey: string,
  orderId: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const body: Record<string, unknown> = {
    order_id: orderId,
    installments: request.installments || 1,
  };

  if (request.card_token) {
    body.card_token = request.card_token;
  }

  const response = await fetch(`${baseUrl}/payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error_code: 'APPMAX_CARD_ERROR',
      error_message: result.message || 'Erro ao processar cartão',
    };
  }

  return {
    success: true,
    transaction_id: orderId,
    payment_url: result.data?.payment_url || '',
    status: result.data?.status || 'pending',
    raw_response: result,
  };
}

async function createAppmaxBoleto(
  baseUrl: string,
  apiKey: string,
  orderId: string
): Promise<GatewayResponse> {
  const response = await fetch(`${baseUrl}/boleto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error_code: 'APPMAX_BOLETO_ERROR',
      error_message: result.message || 'Erro ao gerar boleto',
    };
  }

  return {
    success: true,
    transaction_id: orderId,
    payment_url: result.data?.boleto_url || '',
    boleto_barcode: result.data?.boleto_barcode,
    status: result.data?.status || 'pending',
    raw_response: result,
  };
}

// Stripe Gateway Implementation
import { GatewayResponse, PaymentRequest, GatewayConfig } from "../types.ts";

export async function processStripePayment(
  config: GatewayConfig,
  request: PaymentRequest
): Promise<GatewayResponse> {
  const apiKey = config.api_key_encrypted;

  try {
    // Stripe only supports card payments in this flow
    if (request.payment_method !== 'credit_card') {
      return {
        success: false,
        error_code: 'UNSUPPORTED_METHOD',
        error_message: 'Stripe suporta apenas cartão de crédito',
      };
    }

    return await createStripePaymentIntent(apiKey, request);
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      success: false,
      error_code: 'GATEWAY_ERROR',
      error_message: error instanceof Error ? error.message : 'Erro no Stripe',
    };
  }
}

async function createStripePaymentIntent(
  apiKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  // First, get or create customer
  const customerId = await getOrCreateStripeCustomer(apiKey, request);

  const params = new URLSearchParams();
  params.append('amount', String(request.amount_cents));
  params.append('currency', 'brl');
  params.append('customer', customerId);
  params.append('metadata[sale_id]', request.sale_id);
  params.append('metadata[organization_id]', request.organization_id || '');
  
  // If we have a saved payment method, use it
  if (request.card_token) {
    params.append('payment_method', request.card_token);
    params.append('confirm', 'true');
    params.append('off_session', 'true');
  } else {
    params.append('payment_method_types[]', 'card');
  }

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    return {
      success: false,
      error_code: result.error?.code || 'STRIPE_ERROR',
      error_message: result.error?.message || 'Erro ao processar pagamento',
    };
  }

  return {
    success: true,
    transaction_id: result.id,
    payment_url: result.next_action?.redirect_to_url?.url || '',
    status: mapStripeStatus(result.status),
    client_secret: result.client_secret,
    raw_response: result,
  };
}

async function getOrCreateStripeCustomer(
  apiKey: string,
  request: PaymentRequest
): Promise<string> {
  // Search for existing customer by email
  const searchParams = new URLSearchParams();
  searchParams.append('email', request.customer.email);
  searchParams.append('limit', '1');

  const searchResponse = await fetch(
    `https://api.stripe.com/v1/customers?${searchParams.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  const searchResult = await searchResponse.json();

  if (searchResult.data?.length > 0) {
    return searchResult.data[0].id;
  }

  // Create new customer
  const createParams = new URLSearchParams();
  createParams.append('email', request.customer.email);
  createParams.append('name', request.customer.name);
  createParams.append('phone', request.customer.phone);
  createParams.append('metadata[organization_id]', request.organization_id || '');

  const createResponse = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: createParams.toString(),
  });

  const createResult = await createResponse.json();
  return createResult.id;
}

function mapStripeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'requires_payment_method': 'pending',
    'requires_confirmation': 'pending',
    'requires_action': 'pending',
    'processing': 'processing',
    'requires_capture': 'authorized',
    'canceled': 'canceled',
    'succeeded': 'paid',
  };
  return statusMap[status] || status;
}

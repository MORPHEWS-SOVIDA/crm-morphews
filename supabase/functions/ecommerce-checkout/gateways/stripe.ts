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

    // Use Stripe Checkout Session for better UX and security
    return await createStripeCheckoutSession(apiKey, request);
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      success: false,
      error_code: 'GATEWAY_ERROR',
      error_message: error instanceof Error ? error.message : 'Erro no Stripe',
    };
  }
}

async function createStripeCheckoutSession(
  apiKey: string,
  request: PaymentRequest
): Promise<GatewayResponse> {
  // First, get or create customer
  const customerId = await getOrCreateStripeCustomer(apiKey, request);

  // Build line items for checkout
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('customer', customerId);
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', 'brl');
  params.append('line_items[0][price_data][unit_amount]', String(request.amount_cents));
  params.append('line_items[0][price_data][product_data][name]', 'Pedido #' + request.sale_id.slice(0, 8));
  
  // Success and cancel URLs
  const baseUrl = Deno.env.get('SITE_URL') || 'https://sales.morphews.com';
  params.append('success_url', `${baseUrl}/pagamento-sucesso?sale=${request.sale_id}&session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${baseUrl}/pagamento-cancelado?sale=${request.sale_id}`);
  
  // Metadata for tracking
  params.append('metadata[sale_id]', request.sale_id);
  params.append('metadata[organization_id]', request.organization_id || '');
  params.append('payment_intent_data[metadata][sale_id]', request.sale_id);
  params.append('payment_intent_data[metadata][organization_id]', request.organization_id || '');

  // Phone number collection
  params.append('phone_number_collection[enabled]', 'false');

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    console.error('Stripe checkout error:', result);
    return {
      success: false,
      error_code: result.error?.code || 'STRIPE_ERROR',
      error_message: result.error?.message || 'Erro ao criar sessão de pagamento',
    };
  }

  console.log('Stripe Checkout Session created:', result.id);

  return {
    success: true,
    transaction_id: result.id,
    payment_url: result.url, // This is the checkout URL
    status: 'pending',
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
  if (request.customer.phone) {
    createParams.append('phone', request.customer.phone);
  }
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
  
  if (!createResponse.ok || createResult.error) {
    console.error('Stripe customer creation error:', createResult);
    throw new Error(createResult.error?.message || 'Erro ao criar cliente');
  }
  
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
    'complete': 'paid',
    'expired': 'expired',
  };
  return statusMap[status] || status;
}

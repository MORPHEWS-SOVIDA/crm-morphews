// Pagar.me V5 Subscription Gateway Implementation
// Handles recurring billing for implementer checkout and future subscription products

export interface SubscriptionRequest {
  plan_id?: string; // Pagar.me plan ID (if already exists)
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  payment_method: 'credit_card';
  card_data?: {
    number: string;
    holder_name: string;
    exp_month: string;
    exp_year: string;
    cvv: string;
  };
  card_token?: string;
  // Plan details (used to create plan if not exists)
  plan_name?: string;
  plan_interval?: 'month' | 'year';
  plan_amount_cents?: number;
  // One-time setup fee (e.g., implementation fee)
  setup_fee_cents?: number;
  // Metadata
  metadata?: Record<string, string>;
}

export interface SubscriptionResponse {
  success: boolean;
  subscription_id?: string;
  plan_id?: string;
  customer_id?: string;
  status?: string;
  current_period_end?: string;
  error_code?: string;
  error_message?: string;
  raw_response?: Record<string, unknown>;
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
  if (cleaned.length >= 10) {
    return {
      country_code: '55',
      area_code: cleaned.slice(0, 2),
      number: cleaned.slice(2),
    };
  }
  return { country_code: '55', area_code: '11', number: cleaned };
}

/**
 * Create or get a Pagar.me plan for recurring billing
 */
export async function getOrCreatePagarmePlan(
  secretKey: string,
  planName: string,
  amountCents: number,
  interval: 'month' | 'year' = 'month'
): Promise<{ planId: string | null; error?: string }> {
  const baseUrl = 'https://api.pagar.me/core/v5';

  // Create new plan
  const payload = {
    name: planName,
    currency: 'BRL',
    interval,
    interval_count: 1,
    billing_type: 'prepaid',
    minimum_price: amountCents,
    payment_methods: ['credit_card'],
    items: [
      {
        name: planName,
        quantity: 1,
        pricing_scheme: {
          scheme_type: 'unit',
          price: amountCents,
        },
      },
    ],
  };

  console.log('[PagarmeSubscription] Creating plan:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${baseUrl}/plans`, {
      method: 'POST',
      headers: getAuthHeaders(secretKey),
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('[PagarmeSubscription] Plan response:', response.status, JSON.stringify(result, null, 2));

    if (!response.ok || result.message) {
      return {
        planId: null,
        error: result.message || result.errors?.[0]?.message || 'Erro ao criar plano',
      };
    }

    return { planId: result.id };
  } catch (error) {
    console.error('[PagarmeSubscription] Plan creation error:', error);
    return {
      planId: null,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Create or get a Pagar.me customer
 */
export async function getOrCreatePagarmeCustomer(
  secretKey: string,
  customer: SubscriptionRequest['customer']
): Promise<{ customerId: string | null; error?: string }> {
  const baseUrl = 'https://api.pagar.me/core/v5';
  const phone = formatPhoneV5(customer.phone);
  const docDigits = customer.document.replace(/\D/g, '');
  const docType = docDigits.length === 14 ? 'company' : 'individual';

  // Search for existing customer by email
  try {
    const searchResponse = await fetch(
      `${baseUrl}/customers?email=${encodeURIComponent(customer.email)}`,
      { headers: getAuthHeaders(secretKey) }
    );
    const searchResult = await searchResponse.json();

    if (searchResult.data?.length > 0) {
      console.log('[PagarmeSubscription] Found existing customer:', searchResult.data[0].id);
      return { customerId: searchResult.data[0].id };
    }
  } catch (e) {
    console.log('[PagarmeSubscription] Customer search failed, creating new');
  }

  // Create new customer
  const payload = {
    name: customer.name,
    email: customer.email,
    type: docType,
    document: docDigits,
    phones: {
      mobile_phone: phone,
    },
  };

  console.log('[PagarmeSubscription] Creating customer:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: getAuthHeaders(secretKey),
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('[PagarmeSubscription] Customer response:', response.status);

    if (!response.ok || result.message) {
      return {
        customerId: null,
        error: result.message || result.errors?.[0]?.message || 'Erro ao criar cliente',
      };
    }

    return { customerId: result.id };
  } catch (error) {
    console.error('[PagarmeSubscription] Customer creation error:', error);
    return {
      customerId: null,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Create a Pagar.me subscription with optional setup fee
 */
export async function createPagarmeSubscription(
  secretKey: string,
  request: SubscriptionRequest
): Promise<SubscriptionResponse> {
  const baseUrl = 'https://api.pagar.me/core/v5';

  try {
    // 1. Get or create customer
    const { customerId, error: customerError } = await getOrCreatePagarmeCustomer(
      secretKey,
      request.customer
    );

    if (!customerId) {
      return {
        success: false,
        error_code: 'CUSTOMER_ERROR',
        error_message: customerError || 'Erro ao criar cliente',
      };
    }

    // 2. Ensure we have a plan
    let planId = request.plan_id;
    if (!planId && request.plan_name && request.plan_amount_cents) {
      const { planId: newPlanId, error: planError } = await getOrCreatePagarmePlan(
        secretKey,
        request.plan_name,
        request.plan_amount_cents,
        request.plan_interval || 'month'
      );

      if (!newPlanId) {
        return {
          success: false,
          error_code: 'PLAN_ERROR',
          error_message: planError || 'Erro ao criar plano',
        };
      }
      planId = newPlanId;
    }

    if (!planId) {
      return {
        success: false,
        error_code: 'MISSING_PLAN',
        error_message: 'Plano não informado',
      };
    }

    // 3. Build card payment
    let cardPayment: Record<string, unknown> = {};

    if (request.card_token) {
      cardPayment = { card_id: request.card_token };
    } else if (request.card_data) {
      cardPayment = {
        card: {
          number: request.card_data.number.replace(/\D/g, ''),
          holder_name: request.card_data.holder_name.toUpperCase(),
          exp_month: parseInt(request.card_data.exp_month, 10),
          exp_year: parseInt(request.card_data.exp_year, 10),
          cvv: request.card_data.cvv,
          billing_address: {
            line_1: '0, Não informado',
            zip_code: '01000000',
            city: 'São Paulo',
            state: 'SP',
            country: 'BR',
          },
        },
      };
    } else {
      return {
        success: false,
        error_code: 'MISSING_CARD',
        error_message: 'Dados do cartão não informados',
      };
    }

    // 4. Create subscription payload
    const subscriptionPayload: Record<string, unknown> = {
      plan_id: planId,
      customer_id: customerId,
      payment_method: 'credit_card',
      card: cardPayment.card || undefined,
      card_id: cardPayment.card_id || undefined,
      metadata: request.metadata || {},
    };

    // Add setup fee if present (one-time charge on first invoice)
    if (request.setup_fee_cents && request.setup_fee_cents > 0) {
      subscriptionPayload.setup = {
        amount: request.setup_fee_cents,
        description: 'Taxa de Implementação',
      };
    }

    console.log('[PagarmeSubscription] Creating subscription:', JSON.stringify({
      ...subscriptionPayload,
      card: subscriptionPayload.card ? '***REDACTED***' : undefined,
    }, null, 2));

    const response = await fetch(`${baseUrl}/subscriptions`, {
      method: 'POST',
      headers: getAuthHeaders(secretKey),
      body: JSON.stringify(subscriptionPayload),
    });

    const result = await response.json();
    console.log('[PagarmeSubscription] Subscription response:', response.status, JSON.stringify(result, null, 2));

    if (!response.ok || result.message) {
      return {
        success: false,
        error_code: result.type || 'SUBSCRIPTION_ERROR',
        error_message: result.message || result.errors?.[0]?.message || 'Erro ao criar assinatura',
        raw_response: result,
      };
    }

    // Check if first charge was successful
    const currentCycle = result.current_cycle;
    const isActive = result.status === 'active';

    return {
      success: isActive,
      subscription_id: result.id,
      plan_id: planId,
      customer_id: customerId,
      status: result.status,
      current_period_end: currentCycle?.end_at,
      raw_response: result,
      error_code: isActive ? undefined : 'CHARGE_FAILED',
      error_message: isActive ? undefined : `Assinatura ${result.status}`,
    };
  } catch (error) {
    console.error('[PagarmeSubscription] Error:', error);
    return {
      success: false,
      error_code: 'GATEWAY_ERROR',
      error_message: error instanceof Error ? error.message : 'Erro no gateway',
    };
  }
}

/**
 * Cancel a Pagar.me subscription
 */
export async function cancelPagarmeSubscription(
  secretKey: string,
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = 'https://api.pagar.me/core/v5';

  try {
    const response = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(secretKey),
    });

    if (!response.ok) {
      const result = await response.json();
      return {
        success: false,
        error: result.message || 'Erro ao cancelar assinatura',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

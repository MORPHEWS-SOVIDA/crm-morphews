import { supabase } from '@/integrations/supabase/client';

export type CheckoutEventType =
  | 'cart_loaded'
  | 'form_filled'
  | 'checkout_started'
  | 'payment_started'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_error'
  | 'abandoned';

interface LogEventParams {
  organizationId: string;
  cartId?: string | null;
  sessionId?: string;
  eventType: CheckoutEventType;
  eventData?: Record<string, unknown>;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  sourceUrl?: string;
  sourceType?: string;
  sourceId?: string;
  errorMessage?: string;
}

export async function logCheckoutEvent(params: LogEventParams): Promise<void> {
  try {
    await supabase.from('checkout_events').insert({
      organization_id: params.organizationId,
      cart_id: params.cartId || null,
      session_id: params.sessionId || null,
      event_type: params.eventType,
      event_data: params.eventData || {},
      customer_name: params.customerName || null,
      customer_email: params.customerEmail || null,
      customer_phone: params.customerPhone || null,
      source_url: params.sourceUrl || null,
      source_type: params.sourceType || null,
      source_id: params.sourceId || null,
      error_message: params.errorMessage || null,
      ip_address: null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    } as any);
  } catch (err) {
    console.warn('[CheckoutEvents] Failed to log event:', err);
  }
}
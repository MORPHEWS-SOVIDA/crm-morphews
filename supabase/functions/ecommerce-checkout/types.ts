// Checkout Engine Types

export type GatewayType = 'pagarme' | 'appmax' | 'stripe' | 'asaas';
export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';

export interface GatewayConfig {
  id: string;
  gateway_type: GatewayType;
  api_key_encrypted: string;
  api_secret_encrypted?: string;
  webhook_secret_encrypted?: string;
  is_sandbox: boolean;
  is_active: boolean;
  priority: number;
}

export interface GatewayFallbackConfig {
  payment_method: PaymentMethod;
  primary_gateway: GatewayType;
  fallback_gateways: GatewayType[]; // DB uses 'fallback_gateways' not 'fallback_sequence'
  fallback_enabled: boolean; // DB uses 'fallback_enabled' not 'is_active'
  max_fallback_attempts: number; // DB uses 'max_fallback_attempts' not 'max_retries'
}

export interface CardData {
  number: string;
  holder_name: string;
  exp_month: string;
  exp_year: string;
  cvv: string;
}

export interface PaymentRequest {
  sale_id: string;
  organization_id?: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  installments?: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    document?: string;
    address?: {
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zip_code?: string;
    };
  };
  postback_url: string;
  card_token?: string;
  card_hash?: string;
  card_data?: CardData;
  save_card?: boolean;
}

export interface GatewayResponse {
  success: boolean;
  transaction_id?: string;
  payment_url?: string;
  pix_code?: string;
  pix_expiration?: string;
  boleto_barcode?: string;
  boleto_expiration?: string;
  status?: string;
  error_code?: string;
  error_message?: string;
  client_secret?: string;
  card_id?: string;
  card_last_digits?: string;
  card_brand?: string;
  raw_response?: Record<string, unknown>;
}

export interface UtmData {
  src?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  first_touch_url?: string;
  first_touch_referrer?: string;
  first_touch_at?: string;
}

export interface CheckoutRequest {
  cart_id?: string;
  storefront_id?: string;
  landing_page_id?: string;
  standalone_checkout_id?: string;
  offer_id?: string;
  items?: { product_id: string; quantity: number; price_cents: number }[];
  customer: {
    name: string;
    email: string;
    phone: string;
    document?: string;
  };
  // Shipping cost must be sent from frontend; backend cannot calculate yet.
  // This is critical so PIX/BOLETO totals match what the user sees.
  shipping_cost_cents?: number;
  // Total with interest for credit card installment payments
  total_with_interest_cents?: number;
  shipping?: {
    address: string;
    number?: string;
    neighborhood?: string;
    city: string;
    state: string;
    zip: string;
    complement?: string;
  };
  payment_method: PaymentMethod;
  installments?: number;
  affiliate_code?: string;
  card_token?: string;
  card_hash?: string;
  card_data?: CardData;
  save_card?: boolean;
  // Attribution data
  utm?: UtmData;
}

export interface PaymentAttemptRecord {
  sale_id: string;
  gateway_type: GatewayType;
  payment_method: PaymentMethod;
  amount_cents: number;
  status: 'pending' | 'success' | 'failed' | 'processing';
  gateway_transaction_id?: string;
  error_code?: string;
  error_message?: string;
  is_fallback: boolean;
  fallback_from_gateway?: GatewayType;
  attempt_number: number;
  response_data?: Record<string, unknown>;
}

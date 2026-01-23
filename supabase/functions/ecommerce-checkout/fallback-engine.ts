// Fallback Engine - Automatic gateway retry logic
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  GatewayType, 
  GatewayConfig, 
  GatewayFallbackConfig, 
  PaymentRequest, 
  GatewayResponse,
  PaymentAttemptRecord 
} from "./types.ts";
import { processPagarmePayment } from "./gateways/pagarme.ts";
import { processAppmaxPayment } from "./gateways/appmax.ts";
import { processStripePayment } from "./gateways/stripe.ts";
import { processAsaasPayment } from "./gateways/asaas.ts";

export class FallbackEngine {
  private supabase: SupabaseClient;
  private gateways: Map<GatewayType, GatewayConfig> = new Map();
  private fallbackConfig: GatewayFallbackConfig | null = null;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async initialize(paymentMethod: string): Promise<void> {
    // Load active gateways
    const { data: gateways } = await this.supabase
      .from('platform_gateway_config')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (gateways && Array.isArray(gateways)) {
      for (const gw of gateways) {
        const gateway = gw as Record<string, unknown>;
        this.gateways.set(gateway.gateway_type as GatewayType, gateway as unknown as GatewayConfig);
      }
    }

    // Load fallback config for this payment method
    const { data: fallback } = await this.supabase
      .from('gateway_fallback_config')
      .select('*')
      .eq('payment_method', paymentMethod)
      .eq('is_active', true)
      .maybeSingle();

    this.fallbackConfig = fallback as GatewayFallbackConfig | null;
  }

  async processWithFallback(request: PaymentRequest): Promise<{
    response: GatewayResponse;
    usedGateway: GatewayType;
    attempts: PaymentAttemptRecord[];
  }> {
    const attempts: PaymentAttemptRecord[] = [];
    let attemptNumber = 0;

    // Determine gateway sequence
    const sequence = this.getGatewaySequence(request.payment_method);
    const maxRetries = this.fallbackConfig?.max_retries || sequence.length;
    const retryDelay = this.fallbackConfig?.retry_delay_ms || 1000;

    let lastError: GatewayResponse | null = null;
    let previousGateway: GatewayType | undefined;

    for (const gatewayType of sequence) {
      if (attemptNumber >= maxRetries) break;

      const config = this.gateways.get(gatewayType);
      if (!config) continue;

      attemptNumber++;
      const isFallback = attemptNumber > 1;

      console.log(`[FallbackEngine] Attempt ${attemptNumber}: ${gatewayType} (fallback: ${isFallback})`);

      // Create attempt record
      const attemptRecord: PaymentAttemptRecord = {
        sale_id: request.sale_id,
        gateway_type: gatewayType,
        payment_method: request.payment_method,
        amount_cents: request.amount_cents,
        status: 'pending',
        is_fallback: isFallback,
        fallback_from_gateway: isFallback ? previousGateway : undefined,
        attempt_number: attemptNumber,
      };

      try {
        const response = await this.processPayment(gatewayType, config, request);

        attemptRecord.status = response.success ? 'success' : 'failed';
        attemptRecord.gateway_transaction_id = response.transaction_id;
        attemptRecord.error_code = response.error_code;
        attemptRecord.error_message = response.error_message;
        attemptRecord.response_data = response.raw_response;

        // Save attempt to database
        await this.saveAttempt(attemptRecord);
        attempts.push(attemptRecord);

        if (response.success) {
          return {
            response,
            usedGateway: gatewayType,
            attempts,
          };
        }

        // Check if error is retryable
        if (!this.isRetryableError(response)) {
          console.log(`[FallbackEngine] Non-retryable error: ${response.error_code}`);
          return {
            response,
            usedGateway: gatewayType,
            attempts,
          };
        }

        lastError = response;
        previousGateway = gatewayType;

        // Wait before retry
        if (attemptNumber < sequence.length) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(`[FallbackEngine] Gateway ${gatewayType} threw exception:`, error);
        
        attemptRecord.status = 'failed';
        attemptRecord.error_code = 'EXCEPTION';
        attemptRecord.error_message = error instanceof Error ? error.message : 'Unknown error';
        
        await this.saveAttempt(attemptRecord);
        attempts.push(attemptRecord);

        lastError = {
          success: false,
          error_code: 'EXCEPTION',
          error_message: attemptRecord.error_message,
        };

        previousGateway = gatewayType;
      }
    }

    // All gateways failed
    return {
      response: lastError || {
        success: false,
        error_code: 'NO_GATEWAY',
        error_message: 'Nenhum gateway disponível para processar o pagamento',
      },
      usedGateway: previousGateway || sequence[0],
      attempts,
    };
  }

  private getGatewaySequence(paymentMethod: string): GatewayType[] {
    if (this.fallbackConfig) {
      return [
        this.fallbackConfig.primary_gateway,
        ...(this.fallbackConfig.fallback_sequence || []),
      ];
    }

    // Default: use gateways by priority
    return Array.from(this.gateways.keys());
  }

  private async processPayment(
    gatewayType: GatewayType,
    config: GatewayConfig,
    request: PaymentRequest
  ): Promise<GatewayResponse> {
    switch (gatewayType) {
      case 'pagarme':
        return processPagarmePayment(config, request);
      case 'appmax':
        return processAppmaxPayment(config, request);
      case 'stripe':
        return processStripePayment(config, request);
      case 'asaas':
        return processAsaasPayment(config, request);
      default:
        return {
          success: false,
          error_code: 'UNSUPPORTED_GATEWAY',
          error_message: `Gateway ${gatewayType} não suportado`,
        };
    }
  }

  private isRetryableError(response: GatewayResponse): boolean {
    // Non-retryable errors (business logic failures)
    const nonRetryable = [
      'INSUFFICIENT_FUNDS',
      'CARD_DECLINED',
      'INVALID_CARD',
      'EXPIRED_CARD',
      'FRAUD_SUSPECTED',
      'INVALID_CPF',
      'INVALID_DATA',
    ];

    if (response.error_code && nonRetryable.includes(response.error_code)) {
      return false;
    }

    // Retryable errors (technical failures)
    const retryable = [
      'GATEWAY_ERROR',
      'TIMEOUT',
      'CONNECTION_ERROR',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      'EXCEPTION',
    ];

    return response.error_code ? retryable.includes(response.error_code) : true;
  }

  private async saveAttempt(attempt: PaymentAttemptRecord): Promise<void> {
    try {
      const insertData: Record<string, unknown> = {
        sale_id: attempt.sale_id,
        gateway_type: attempt.gateway_type,
        payment_method: attempt.payment_method,
        amount_cents: attempt.amount_cents,
        status: attempt.status,
        gateway_transaction_id: attempt.gateway_transaction_id,
        error_code: attempt.error_code,
        error_message: attempt.error_message,
        is_fallback: attempt.is_fallback,
        fallback_from_gateway: attempt.fallback_from_gateway,
        attempt_number: attempt.attempt_number,
        response_data: attempt.response_data,
      };

      await this.supabase
        .from('payment_attempts')
        .insert(insertData);
    } catch (error) {
      console.error('[FallbackEngine] Failed to save attempt:', error);
    }
  }
}

# Memory: features/ecommerce/checkout-events-tracking-v1
Updated: just now

## Sistema de Rastreabilidade de Checkouts

### Tabela `checkout_events`
Registra cada etapa do funil de checkout com dados completos:
- `event_type`: cart_loaded, form_filled, checkout_started, payment_started, payment_success, payment_failed, payment_error, abandoned
- `customer_name/email/phone`: dados do cliente capturados em cada evento
- `source_url`: URL completa que trouxe o cliente (com Base64 do carrinho)
- `source_type`: storefront, standalone_checkout, landing_page
- `event_data`: JSON com detalhes específicos (items_count, payment_method, total_cents, etc.)
- `error_message`: mensagem de erro quando aplicável
- `user_agent`: navegador do cliente

### Campos adicionados ao `ecommerce_carts`
- `source_url`, `source_type`, `device_info`
- `checkout_started_at`, `payment_attempted_at`
- `last_error`, `last_error_at`, `payment_method`
- `events_count`

### Integração no Frontend
- `src/hooks/ecommerce/useCheckoutEvents.ts` - função `logCheckoutEvent()` fire-and-forget
- `StorefrontCart.tsx` - loga `cart_loaded` quando URL externa é decodificada
- `StorefrontCheckout.tsx` - loga `cart_loaded`, `checkout_started`, `payment_success`, `payment_failed`, `payment_error`

### Página Admin
- Rota: `/ecommerce/checkout-logs`
- Nav: "Logs" no menu do E-commerce
- Cards de stats: Carrinhos, Checkouts, Aprovados, Recusados, Taxa de Conversão, Taxa de Desistência
- Tabela com busca e filtro por tipo de evento
- Dialog com detalhes completos (cliente, origem, URL, user agent, erro, event_data)
- Auto-refresh a cada 30s + realtime habilitado

### RLS
- INSERT: anon + authenticated (checkout público precisa inserir)
- SELECT: apenas membros da organização
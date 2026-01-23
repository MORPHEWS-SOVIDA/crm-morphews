# Memory: features/ecommerce/roadmap-v2-technical-strategy
Updated: just now

Roadmap de E-commerce Multi-tenant: O sistema evoluirá para suportar Storefronts (lojas completas) e Landing Pages VSL (ofertas de 1, 3, 5 unidades) operando em paralelo. A infraestrutura suportará subdomínios (tenant.morphews.shop) e domínios customizados. O fluxo inclui checkout universal integrado ao CRM, recuperação de carrinhos, multi-gateway (Pagarme, Appmax, Stripe) e sistema de split de pagamentos multi-nível para afiliados e coprodutores. As vendas geradas serão processadas diretamente pelo fluxo de expedição e notas fiscais existente.

## Modelo de Gateway Centralizado
- 100% do pagamento entra na conta Morphews (não há split automático via gateway)
- Sistema credita nas contas virtuais internas (tenant, afiliado, coprodutor, plataforma)
- Prazo de liberação configurável (14 dias padrão) para proteção antifraude
- Usuário solicita saque → Super Admin aprova → Pix/TED para conta bancária
- Taxas da plataforma descontadas automaticamente (5% padrão)

## Tabelas Implementadas (Migration)
- storefront_templates, tenant_storefronts, storefront_domains, storefront_products
- landing_pages, landing_offers
- ecommerce_carts, ecommerce_cart_items
- virtual_accounts, virtual_account_bank_data, virtual_transactions
- withdrawal_requests, affiliates, coproducers, sale_splits
- payment_gateways, platform_settings

## Próximos Passos
1. Hooks para gerenciamento de storefronts/landing pages
2. Componentes de admin para configuração
3. Edge functions para checkout e webhooks de gateways
4. Frontend público para lojas e landing pages
5. Sistema de recuperação de carrinhos abandonados

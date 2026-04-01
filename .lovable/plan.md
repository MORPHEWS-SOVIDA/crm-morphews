
## Arquitetura: Afiliados para Sites Externos + Cupons como Double-Check

### Contexto
Sites externos (besnutrition.com.br, etc.) são projetos Lovable separados. O Atomic Sales (atomic.ia.br) é o backend/ERP. Afiliados precisam funcionar nos sites externos com rastreamento completo.

---

### 1. Cupons vinculados a Afiliados (DB + Backend)
- Adicionar coluna `affiliate_id` na tabela `coupons` (nullable) — vincula cupom a um afiliado
- No checkout (`ecommerce-checkout`), quando um cupom é usado:
  - Aplica o desconto normalmente
  - Se o cupom tem `affiliate_id`, usa como atribuição (mesmo sem `?ref=`)
  - Prioridade: `?ref=` > cupom com afiliado (se ambos existirem, usa o `?ref=`)
- O cupom é validado e preenchido **somente no checkout** do Atomic

### 2. Formato do Link de Afiliado
- `?ref=CODIGO` no site externo (ex: `besnutrition.com.br/?ref=cami1255`)
- O site externo (outro projeto Lovable) precisa:
  1. Capturar `?ref=` da URL e salvar em `localStorage`
  2. Ao montar a URL do checkout, incluir `&ref=CODIGO` no link para o Atomic
- **Instruções para o projeto externo** (vou documentar exatamente o código necessário)

### 3. Cadastro de Afiliados (Páginas Públicas)
- Criar rota `/cadastro-afiliado/:storefrontSlug` (uma página genérica que detecta a loja pelo slug)
  - Ex: `/cadastro-afiliado-bes`, `/cadastro-afiliado-vvero`, etc.
- Formulário: nome, email, telefone, CPF, como pretende divulgar
- Cria conta (auth.signUp) + registro em `organization_affiliates` com `is_active: false`
- Admin aprova em `/ecommerce → Afiliados` (já existe)

### 4. Dashboard do Afiliado (Novas Páginas)
- **`/ecommerce/afiliado-vendas`** — Vendas atribuídas ao afiliado (via `affiliate_attributions`)
  - Mostra: data, produto, valor, comissão, status
- **`/ecommerce/afiliado-links`** — Links de divulgação
  - Para cada loja/checkout que o afiliado está vinculado, mostra o link **do site externo** (não do Atomic)
  - Ex: `besnutrition.com.br/?ref=AFF8AE0DF`
  - Precisa de um campo na storefront: `external_site_url` para montar os links corretos
- **`/ecommerce/carteira`** — Já existe (VirtualAccountPanel)

### 5. Split Engine — Nova Ordem de Cálculo
Atualizar a hierarquia para incluir afiliado ANTES do co-produtor:

```
1. Juros de Parcelamento (Pagarme)
2. Taxa de Plataforma (4.99% + R$1.00 → Morphews)
3. Imposto (12%)
4. Frete + Picking (Correio)
5. Custo de Produção (Farmácia)
6. *** Comissão Afiliado (% sobre subtotal) *** ← NOVO na ordem
7. *** Comissão Gerente de Afiliados (% sobre subtotal) *** ← NOVO na ordem
8. Co-produtor (50% do lucro líquido RESTANTE)
9. Tenant (restante)
```

### 6. Storefront — Campo `external_site_url`
- Adicionar coluna `external_site_url` em `tenant_storefronts`
- Ex: `https://besnutrition.com.br` para a loja BES
- Usado para montar os links de afiliado corretos no dashboard

### 7. Instruções para Site Externo (besnutrition.com.br)
Vou documentar o código exato que o outro projeto Lovable precisa:
```js
// 1. Na inicialização do app, capturar ref
const ref = new URLSearchParams(window.location.search).get('ref');
if (ref) localStorage.setItem('affiliate_ref', ref);

// 2. Ao redirecionar para checkout do Atomic
const affiliateRef = localStorage.getItem('affiliate_ref');
const checkoutUrl = `https://atomic.ia.br/loja/bes/checkout?cart=${cartBase64}`;
if (affiliateRef) checkoutUrl += `&ref=${affiliateRef}`;
```

### Resumo de Mudanças
| Área | O que muda |
|------|-----------|
| DB Migration | `coupons.affiliate_id`, `tenant_storefronts.external_site_url` |
| Edge Function | `ecommerce-checkout` — atribuição por cupom |
| Novas Páginas | `/cadastro-afiliado/:slug`, `/ecommerce/afiliado-vendas`, `/ecommerce/afiliado-links` |
| Split Engine | Afiliado + Gerente antes do Co-produtor |
| Externo | Instruções para captura de `?ref=` no localStorage |

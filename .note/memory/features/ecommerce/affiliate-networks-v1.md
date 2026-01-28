# Memory: features/ecommerce/affiliate-networks-v1
Updated: just now

## Sistema de Redes de Afiliados

### Conceito
Redes de afiliados permitem organizar afiliados em grupos com checkouts específicos vinculados. Afiliados só podem entrar via link de convite da rede, não por convite manual.

### Estrutura de Banco de Dados

**`affiliate_networks`**
- Tabela principal com id, organization_id, name, description, photo_url, invite_code (auto-gerado), is_active
- RLS: Admins da org podem gerenciar, anon/authenticated podem visualizar redes ativas

**`affiliate_network_members`**
- Membros da rede: network_id, user_id, affiliate_id, role (affiliate/manager), commission_type, commission_value
- Gerentes podem ver membros da rede, membros podem ver próprio registro

**`affiliate_network_checkouts`**
- Vínculos rede ↔ checkout: network_id, checkout_id
- Afiliados só podem vender checkouts vinculados à sua rede

### Função RPC
`join_affiliate_network(p_invite_code, p_email, p_name)`:
- Usuário autenticado entra na rede pelo código
- Cria afiliado em `organization_affiliates` se não existir
- Adiciona como membro da rede
- Retorna JSON com success/error

### UI
- **AffiliateNetworksTab**: Lista redes com cards visuais
- **NetworkCreateDialog**: Modal para criar nova rede
- **NetworkDetailSheet**: Sheet lateral para gerenciar rede (checkouts, membros)
- **NetworkInviteAccept**: Página pública `/rede/:inviteCode` para aceitar convite
- **PartnerLinksPage**: Exibe automaticamente todos os checkouts das redes do afiliado com links já com código embutido

### Fluxo de Convite
1. Admin cria rede e vincula checkouts
2. Admin copia link de convite
3. Afiliado acessa link → se não logado, redireciona para login/registro
4. Após login, chama RPC para entrar na rede
5. Afiliado pode ver apenas checkouts da rede em "Meus Links"

### Fluxo de Venda com Split Automático
1. Cliente acessa link com `?ref=CODIGO_AFILIADO`
2. Checkout busca comissão em `affiliate_network_members` (novo) ou `partner_associations` (legado)
3. Atribuição é salva em `affiliate_attributions` com `attribution_type: 'network'`
4. Webhook de pagamento dispara `processSaleSplitsV3`
5. Split Engine identifica afiliado pelo código, busca comissão da rede
6. Cria/obtém `virtual_accounts` para o afiliado e credita automaticamente

### Regras de Negócio
- Não é possível adicionar afiliados manualmente - apenas via link
- Gerentes podem ser promovidos/rebaixados pelo admin
- Comissão individual pode ser alterada por membro
- Rede pode ser desativada (is_active = false)
- Split de pagamento é 100% automático no momento da confirmação do pagamento

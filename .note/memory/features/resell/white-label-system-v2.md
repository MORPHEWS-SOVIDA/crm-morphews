# Memory: features/resell/white-label-system-v2
Updated: just now

## Sistema White Label para Implementadores (v2 - Sub-franquia)

### Modelo de Negócio (Híbrido → Sub-franquia)
- **Plano Implementador White Label**: R$ 497/mês
- **Comissões mantidas**: 40% na 1ª mensalidade, 10% recorrente
- **NOVO**: Painel administrativo completo para gestão independente

### Painel White Admin (/white-admin)
Painel exclusivo para implementadores White Label gerenciarem seus clientes de forma autônoma.

#### Módulos Implementados:
1. **Dashboard** - KPIs (clientes, receita, planos, comissões)
2. **Organizações** - CRUD de clientes, status (ativo/suspenso/cancelado)
3. **Planos** - Criação livre de planos com preços e features customizados
4. **Branding** - Logo, cores, domínios, e-mail, suporte
5. **Financeiro** - Em desenvolvimento
6. **Configurações** - Em desenvolvimento

### Tabelas Novas
- `white_label_plans` - Planos customizados do WL (preço livre, features, limites)
- `white_label_customers` - Clientes do WL (org, plano, status, valores)

### Colunas Adicionadas em white_label_configs
- `app_domain` - Domínio do painel (ex: app.atomicsales.com.br)
- `checkout_domain` - Domínio do checkout
- `support_phone` - Telefone de suporte
- `terms_url`, `privacy_url` - Links legais
- `login_background_url` - Imagem de fundo do login
- `dashboard_welcome_message` - Mensagem de boas-vindas

### Funções SQL
- `is_white_label_owner(_user_id)` - Verifica se usuário é dono de WL
- `get_my_white_label_config()` - Retorna config do WL logado

### Rotas
- `/white-admin` - Dashboard principal
- `/white-admin/organizacoes` - Gestão de clientes
- `/white-admin/usuarios` - Gestão de usuários (placeholder)
- `/white-admin/planos` - Gestão de planos
- `/white-admin/branding` - Configuração de marca
- `/white-admin/financeiro` - Financeiro (placeholder)
- `/white-admin/configuracoes` - Configurações (placeholder)

### Componentes
- `WhiteAdminLayout.tsx` - Layout com sidebar, header com logo dinâmico
- `WhiteAdminDashboard.tsx` - Cards de stats + ações rápidas + clientes recentes
- `WhiteAdminOrganizations.tsx` - Lista/busca/CRUD de clientes
- `WhiteAdminPlans.tsx` - Criação/edição de planos com features toggle
- `WhiteAdminBranding.tsx` - Formulário completo de personalização

### Hooks
- `useWhiteAdmin.ts` - Hooks para WL admin (plans, customers, stats, mutations)
- `useIsWhiteLabelOwner()` - Verifica status WL
- `useMyWhiteLabelConfig()` - Busca config completa
- `useWhiteLabelPlans()` - Lista planos
- `useWhiteLabelCustomers()` - Lista clientes
- `useWhiteAdminStats()` - Estatísticas do dashboard

### Acesso
- Implementadores WL têm botão "White Admin" no header do /implementador
- Layout usa cor primária do WL dinamicamente
- Redireciona para /dashboard se não for WL owner

### Ambiente de Teste
- **AtomicSales**: Primeira sub-franquia de teste
- Usuário: vinithi@sonatura.com.br
- Código: IMP-ATOMIC01

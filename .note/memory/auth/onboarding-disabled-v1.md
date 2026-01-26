# Memory: auth/onboarding-disabled-v1
Updated: 2026-01-26

## Onboarding Obrigatório DESATIVADO

O fluxo de onboarding obrigatório foi **completamente removido** após múltiplos problemas com usuários ficando travados na página `/onboarding`.

### Mudanças realizadas:

1. **Home.tsx**: Removido toda a lógica de verificação de onboarding. Agora:
   - Usuário logado → Dashboard direto
   - Usuário não logado → Página de Planos

2. **Onboarding.tsx**: Qualquer acesso a `/onboarding` redireciona imediatamente para `/`

### Motivo:
- Usuários novos estavam ficando travados na página de onboarding
- A verificação via RPC `has_onboarding_completed` estava falhando ou retornando valores incorretos
- O bypass via localStorage não era suficiente para resolver o problema

### Alternativa futura:
Se precisar coletar essas informações, fazer via:
- Banner/card no Dashboard
- Modal opcional no primeiro acesso
- Formulário nas configurações da organização

### Dados coletados anteriormente (tabela onboarding_data):
- CNPJ
- Site da empresa
- Intenção de uso do CRM
- Descrição do negócio

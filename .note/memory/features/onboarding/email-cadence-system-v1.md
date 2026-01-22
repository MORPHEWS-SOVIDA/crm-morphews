# Memory: features/onboarding/email-cadence-system-v1
Updated: 2026-01-22

Sistema de cadência de emails de onboarding implementado com:

## Tabelas
- `onboarding_email_templates`: Templates editáveis no Super Admin
- `onboarding_email_queue`: Fila de emails a serem enviados

## Cadência Padrão (14 emails)
- Dia 0 (0h): Boas-vindas
- Dia 0 (2h): Primeiro lead - Como cadastrar
- Dia 0 (6h): Funil de vendas
- Dia 1: WhatsApp
- Dia 2: Follow-ups
- Dia 3: Produtos
- Dia 5: Equipe
- Dia 7: Relatórios
- Dia 10: Robôs de IA
- Dia 14: Integrações
- Dia 17: Pós-venda
- Dia 20: Dicas avançadas
- Dia 25: Configurações
- Dia 30: Feedback 1 mês

## Edge Function
- `process-onboarding-emails`: Processa a fila e envia via Resend
- Cron job configurado para rodar a cada 10 minutos

## Integração
- `create-org-user` e `manual-user-provision` chamam a RPC `enqueue_onboarding_emails` ao criar novos usuários

## Super Admin
- Aba "Emails Onboarding" para gerenciar templates
- Preview de emails
- Toggle ativo/inativo
- Estatísticas de envio

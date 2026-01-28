# Memory: features/whatsapp/send-permission-enforcement-v1
Updated: 2026-01-28

## Problema Corrigido
Múltiplos atendentes podiam enviar mensagens na mesma conversa simultaneamente, mesmo quando a conversa estava atribuída a apenas um deles. Isso ocorria porque:
1. A RLS permitia SELECT para todos os membros da organização
2. A filtragem de visibilidade era feita apenas no frontend
3. A edge function `whatsapp-send-message` não verificava permissões de envio

## Solução Implementada
Adicionada verificação de permissão na edge function `whatsapp-send-message`:
- Se a conversa está com status `assigned` e `assigned_user_id` é de outro usuário → bloqueia envio
- Se a conversa está com status `autodistributed` e `designated_user_id` é de outro usuário → bloqueia envio
- Admins de instância (`is_instance_admin = true`) mantêm permissão de enviar em qualquer conversa

## Mensagens de Erro
- "Esta conversa está sendo atendida por outro vendedor. Você não pode enviar mensagens."
- "Esta conversa foi designada para outro vendedor. Você não pode enviar mensagens."

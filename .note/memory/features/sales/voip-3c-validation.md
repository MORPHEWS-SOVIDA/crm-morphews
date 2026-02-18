# Memory: features/sales/voip-3c-validation
Updated: now

A ferramenta de auditoria 'VoIP 3C+ Validation' (/gerencia-receptivo/3c) cruza chamadas externas com registros do CRM. As ações de lead (Voip3cLeadActions) utilizam o componente 'WhatsAppButton' para abrir o chat interno do Morphews em vez de links externos wa.me, garantindo que o atendimento e o histórico de mensagens permaneçam centralizados na plataforma.

## Log de Ações (voip_3c_action_logs)

Cada ação realizada a partir de um relatório 3C+ é registrada na tabela `voip_3c_action_logs`:
- **action_type**: 'whatsapp_sent', 'stage_changed', 'assigned_seller', 'followup_created'
- **action_details**: JSON com detalhes (etapa anterior/nova, nome do vendedor, data do follow-up)
- **validation_id**: Vincula ao relatório que originou a ação
- **user_id**: Quem executou a ação

### Funcionalidades:
1. Histórico de relatórios salvos com nome do arquivo, quem fez upload e métricas
2. Ao carregar um relatório anterior, exibe o log de todas as ações realizadas
3. Gerência pode acompanhar o que cada vendedor fez com cada lead do relatório
4. Cada novo upload gera automaticamente um ID de validação para rastrear ações

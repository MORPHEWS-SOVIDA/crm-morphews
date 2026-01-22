# Memory: billing/energy-pricing-and-costs-v1
Updated: 2026-01-22

## Sistema de Energia e Custos de IA

### Estrutura de Tabelas

1. **`ai_model_costs`**: Custos por modelo de IA
   - `model_key`: Identificador do modelo (ex: `google/gemini-2.5-flash`)
   - `input_cost_per_million_tokens`: Custo real de input em USD
   - `output_cost_per_million_tokens`: Custo real de output em USD
   - `energy_per_1000_tokens`: Energia cobrada do tenant por 1k tokens
   - `margin_multiplier`: Multiplicador de margem (default 5 = 500%)

2. **`ai_action_costs`**: Custos fixos por tipo de ação
   - `action_key`: Identificador da ação (ex: `audio_transcription`)
   - `base_energy_cost`: Energia fixa cobrada
   - `estimated_real_cost_usd`: Custo real estimado em USD

### Modelo de Precificação (Margem 500%)

**Fórmula base:**
- Se 10.000 energia = R$50 (~$10 USD)
- Custo real médio por 10k energia: ~$2 USD
- Margem: 80% (5x sobre custo)

### Custos por Ação (energia fixa)

| Ação | Energia | Custo Real USD | Modelo |
|------|---------|----------------|--------|
| Geração de Avatar | 200 | $0.04 | gemini-2.5-flash-image |
| Leitura Receita PDF | 150 | $0.02 | gemini-2.5-pro |
| Leitura Doc / Memória Lead | 100 | $0.01 | gemini-2.5-flash |
| Análise Receita Foto | 50 | $0.008 | gemini-2.5-pro |
| Transcrição Áudio | 50 | $0.006 | whisper |
| Análise Imagem | 30 | $0.003 | gemini-2.5-flash |
| Resposta Bot (variável) | ~10/resposta | $0.0005 | gemini-3-flash |

### Consumo de Energia por Modelo (por 1k tokens)

| Modelo | Energia/1k | Custo Real/1M |
|--------|------------|---------------|
| gemini-3-flash-preview | 5 | $0.075 in / $0.30 out |
| gemini-2.5-flash | 5 | $0.075 in / $0.30 out |
| gemini-2.5-pro | 15 | $1.25 in / $5.00 out |
| gpt-5.2 | 30 | $6.00 in / $18.00 out |
| whisper | 50 fixo | ~$0.006/chamada |

### Função RPC Atualizada

`consume_energy(p_organization_id, p_bot_id, p_conversation_id, p_action_type, p_energy_amount, p_tokens_used, p_details, p_model_used, p_real_cost_usd)`

Agora registra:
- Modelo usado (`model_used`)
- Custo real estimado em USD (`real_cost_usd`)

### Super Admin

Nova aba "Custos IA" (`/super-admin` > Custos IA) permite:
- Visualizar todos os modelos e custos
- Ajustar energia por modelo/ação
- Ver margem real calculada
- Monitorar uso por tipo de ação nos últimos 30 dias

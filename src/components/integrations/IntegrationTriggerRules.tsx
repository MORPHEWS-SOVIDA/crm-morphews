import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Clock, ShoppingCart, Link2, AlertTriangle } from 'lucide-react';

export interface TriggerRule {
  id: string;
  type: 'time_since_webhook' | 'has_active_sale' | 'source_match' | 'source_exclude';
  operator?: 'less_than' | 'greater_than' | 'equals' | 'not_equals';
  value?: string | number;
  integration_ids?: string[];
}

interface IntegrationTriggerRulesProps {
  rules: TriggerRule[];
  rulesLogic: 'AND' | 'OR';
  onRulesChange: (rules: TriggerRule[]) => void;
  onRulesLogicChange: (logic: 'AND' | 'OR') => void;
  integrations?: { id: string; name: string }[];
}

const RULE_TYPES = [
  { 
    value: 'time_since_webhook', 
    label: 'Tempo desde último webhook', 
    icon: Clock,
    description: 'Verifica se passou X horas desde o último webhook recebido para este lead'
  },
  { 
    value: 'has_active_sale', 
    label: 'Status de venda ativa', 
    icon: ShoppingCart,
    description: 'Verifica se o lead já tem uma venda pendente ou aprovada'
  },
  { 
    value: 'source_match', 
    label: 'Origem específica (incluir)', 
    icon: Link2,
    description: 'Só dispara se o lead veio de integrações específicas'
  },
  { 
    value: 'source_exclude', 
    label: 'Origem específica (excluir)', 
    icon: AlertTriangle,
    description: 'Não dispara se o lead veio de integrações específicas'
  },
];

export function IntegrationTriggerRules({
  rules,
  rulesLogic,
  onRulesChange,
  onRulesLogicChange,
  integrations = [],
}: IntegrationTriggerRulesProps) {
  const addRule = () => {
    const newRule: TriggerRule = {
      id: `rule-${Date.now()}`,
      type: 'time_since_webhook',
      operator: 'less_than',
      value: 24,
    };
    onRulesChange([...rules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<TriggerRule>) => {
    onRulesChange(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    onRulesChange(rules.filter(r => r.id !== id));
  };

  const getRuleTypeConfig = (type: TriggerRule['type']) => {
    return RULE_TYPES.find(t => t.value === type);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Regras de Disparo
        </CardTitle>
        <CardDescription>
          Configure condições para evitar disparos duplicados ou indesejados de follow-ups e mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logic selector */}
        {rules.length > 1 && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Label className="text-sm">Quando houver múltiplas regras:</Label>
            <Select value={rulesLogic} onValueChange={(v) => onRulesLogicChange(v as 'AND' | 'OR')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">
                  <span className="font-medium">TODAS</span> devem ser verdadeiras
                </SelectItem>
                <SelectItem value="OR">
                  <span className="font-medium">QUALQUER</span> uma verdadeira
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Rules list */}
        {rules.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma regra configurada</p>
            <p className="text-sm">Adicione regras para controlar quando os follow-ups são disparados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule, index) => {
              const typeConfig = getRuleTypeConfig(rule.type);
              const Icon = typeConfig?.icon || Clock;
              
              return (
                <div key={rule.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{typeConfig?.label}</p>
                        <p className="text-xs text-muted-foreground">{typeConfig?.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Rule type selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo de Regra</Label>
                      <Select 
                        value={rule.type} 
                        onValueChange={(v) => updateRule(rule.id, { 
                          type: v as TriggerRule['type'],
                          // Reset values when changing type
                          value: v === 'time_since_webhook' ? 24 : undefined,
                          operator: v === 'time_since_webhook' ? 'less_than' : undefined,
                          integration_ids: v.startsWith('source_') ? [] : undefined,
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Time-based rule config */}
                    {rule.type === 'time_since_webhook' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Condição</Label>
                          <Select 
                            value={rule.operator || 'less_than'} 
                            onValueChange={(v) => updateRule(rule.id, { operator: v as TriggerRule['operator'] })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="less_than">NÃO disparar se {"<"} X horas</SelectItem>
                              <SelectItem value="greater_than">Só disparar se {">"} X horas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">Horas</Label>
                          <Input
                            type="number"
                            min={1}
                            max={720}
                            value={rule.value || 24}
                            onChange={(e) => updateRule(rule.id, { value: parseInt(e.target.value) || 24 })}
                            placeholder="24"
                          />
                          <p className="text-xs text-muted-foreground">
                            {rule.operator === 'less_than' 
                              ? `Se o lead recebeu webhook nas últimas ${rule.value || 24}h, NÃO dispara`
                              : `Só dispara se passaram mais de ${rule.value || 24}h desde o último webhook`
                            }
                          </p>
                        </div>
                      </>
                    )}

                    {/* Active sale rule config */}
                    {rule.type === 'has_active_sale' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Condição</Label>
                        <Select 
                          value={rule.operator || 'equals'} 
                          onValueChange={(v) => updateRule(rule.id, { operator: v as TriggerRule['operator'] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">NÃO disparar se TEM venda ativa</SelectItem>
                            <SelectItem value="not_equals">Só disparar se TEM venda ativa</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {rule.operator === 'not_equals'
                            ? 'Só dispara para leads que já compraram'
                            : 'Evita follow-up de carrinho abandonado para quem já comprou'
                          }
                        </p>
                      </div>
                    )}

                    {/* Source match/exclude rule config */}
                    {(rule.type === 'source_match' || rule.type === 'source_exclude') && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Integrações</Label>
                        <div className="flex flex-wrap gap-2 p-2 border rounded-lg min-h-[60px]">
                          {integrations.map(int => {
                            const isSelected = rule.integration_ids?.includes(int.id);
                            return (
                              <Badge
                                key={int.id}
                                variant={isSelected ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => {
                                  const currentIds = rule.integration_ids || [];
                                  const newIds = isSelected
                                    ? currentIds.filter(id => id !== int.id)
                                    : [...currentIds, int.id];
                                  updateRule(rule.id, { integration_ids: newIds });
                                }}
                              >
                                {int.name}
                              </Badge>
                            );
                          })}
                          {integrations.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Nenhuma outra integração disponível
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rule.type === 'source_match'
                            ? 'Só dispara se o lead veio de uma destas integrações'
                            : 'NÃO dispara se o lead veio de uma destas integrações'
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Rule index indicator for multiple rules */}
                  {rules.length > 1 && index < rules.length - 1 && (
                    <div className="flex items-center justify-center pt-2">
                      <Badge variant="secondary" className="text-xs">
                        {rulesLogic === 'AND' ? 'E' : 'OU'}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add rule button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={addRule}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Regra
        </Button>

        {/* Summary */}
        {rules.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              📋 Resumo das Regras
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {rules.length} regra{rules.length > 1 ? 's' : ''} configurada{rules.length > 1 ? 's' : ''}.
              {rules.length > 1 && (
                <> {rulesLogic === 'AND' ? 'TODAS' : 'QUALQUER UMA'} deve ser verdadeira para o follow-up ser criado.</>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

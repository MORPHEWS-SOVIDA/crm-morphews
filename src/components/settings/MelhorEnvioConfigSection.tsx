import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMelhorEnvioConfig, useSaveMelhorEnvioConfig } from '@/hooks/useMelhorEnvio';

export function MelhorEnvioConfigSection() {
  const { data: config, isLoading } = useMelhorEnvioConfig();
  const saveConfig = useSaveMelhorEnvioConfig();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = config?.sender_name && config?.sender_cep;
  const isProduction = config?.ambiente === 'production';

  const handleToggleEnvironment = async () => {
    await saveConfig.mutateAsync({
      ambiente: isProduction ? 'sandbox' : 'production',
    });
  };

  const handleToggleActive = async () => {
    await saveConfig.mutateAsync({
      is_active: !config?.is_active,
    });
  };

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          {config?.is_active ? (
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle className="w-3 h-3 mr-1" />
              Ativo
            </Badge>
          ) : (
            <Badge variant="secondary">Inativo</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ambiente:</span>
          <Badge variant={isProduction ? 'default' : 'outline'}>
            {isProduction ? 'Produção' : 'Sandbox (Teste)'}
          </Badge>
        </div>
      </div>

      {/* Configuration Status */}
      {!isConfigured && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              Configuração Incompleta
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-500">
              Configure os dados do remetente (CNPJ, endereço) na tabela melhor_envio_config ou solicite suporte.
            </p>
          </div>
        </div>
      )}

      {isConfigured && (
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <p><strong>Remetente:</strong> {config?.sender_name}</p>
          <p><strong>Endereço:</strong> {config?.sender_street}, {config?.sender_number} - {config?.sender_city}/{config?.sender_state}</p>
          <p><strong>CEP:</strong> {config?.sender_cep}</p>
          {config?.sender_cpf_cnpj && (
            <p><strong>CPF/CNPJ:</strong> {config?.sender_cpf_cnpj}</p>
          )}
        </div>
      )}

      <Separator />

      {/* Controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Integração Ativa</Label>
            <p className="text-xs text-muted-foreground">
              Habilitar cotação e etiquetas
            </p>
          </div>
          <Switch
            checked={config?.is_active ?? false}
            onCheckedChange={handleToggleActive}
            disabled={saveConfig.isPending}
          />
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <Label className="font-medium">Ambiente Produção</Label>
            <p className="text-xs text-muted-foreground">
              Sandbox = testes, Produção = real
            </p>
          </div>
          <Switch
            checked={isProduction}
            onCheckedChange={handleToggleEnvironment}
            disabled={saveConfig.isPending}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="w-3 h-3" />
        <span>
          Para gerar o token, acesse{' '}
          <a 
            href="https://melhorenvio.com.br/painel/integracoes/tokens" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Melhor Envio → Integrações → Permissões de Acesso
          </a>
        </span>
      </div>
    </div>
  );
}

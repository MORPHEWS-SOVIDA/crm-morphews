import { useEffect, useState } from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { useMelhorEnvioBalance, useMelhorEnvioConfig } from '@/hooks/useMelhorEnvio';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';

const BALANCE_THRESHOLD_CENTS = 20000; // R$ 200,00
const DISMISS_KEY = 'melhor_envio_balance_dismissed';

export function MelhorEnvioBalanceAlert() {
  const { isAdmin, isOwner } = useTenant();
  const { data: config } = useMelhorEnvioConfig();
  const { data: balance } = useMelhorEnvioBalance();
  const [dismissed, setDismissed] = useState(false);

  // Verificar se já foi dismissado na sessão
  useEffect(() => {
    const dismissedAt = sessionStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      // Reexibir após 2 horas
      if (Date.now() - dismissedTime < 2 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  // Só mostrar para admins/owners
  const canSeeAlert = isAdmin || isOwner;
  
  // Só mostrar se Melhor Envio está ativo
  const isActive = config?.is_active;
  
  // Só mostrar se saldo abaixo do limite
  const lowBalance = balance && balance.balance_cents < BALANCE_THRESHOLD_CENTS;

  if (!canSeeAlert || !isActive || !lowBalance || dismissed) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mx-4 mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            Saldo baixo no Melhor Envio: {balance.balance_formatted}
          </span>
          <span className="text-muted-foreground ml-1">
            — Recarregue para evitar falhas na geração de etiquetas.
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
          onClick={() => window.open('https://melhorenvio.com.br/painel/carteira', '_blank')}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Recarregar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

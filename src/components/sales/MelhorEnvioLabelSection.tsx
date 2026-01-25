import { useState } from 'react';
import { Tag, Download, Printer, ExternalLink, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useMelhorEnvioConfig, useSaleMelhorEnvioLabel } from '@/hooks/useMelhorEnvio';
import { MelhorEnvioLabelGenerator } from '@/components/melhorenvio/MelhorEnvioLabelGenerator';
import { formatCurrency } from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MelhorEnvioLabelSectionProps {
  sale: any;
  isCancelled?: boolean;
}

export function MelhorEnvioLabelSection({ sale, isCancelled }: MelhorEnvioLabelSectionProps) {
  const { data: config, isLoading: configLoading } = useMelhorEnvioConfig();
  const { data: label, isLoading: labelLoading } = useSaleMelhorEnvioLabel(sale?.id);
  const [showGenerator, setShowGenerator] = useState(false);

  // Only show for carrier delivery type
  if (sale?.delivery_type !== 'carrier') return null;

  const isConfigured = config?.is_active;

  if (configLoading || labelLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg animate-pulse">
        <div className="h-20" />
      </div>
    );
  }

  // If label exists, show label info
  if (label) {
    return (
      <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">
              Etiqueta Gerada
            </span>
          </div>
          <Badge className="bg-green-100 text-green-700 border-green-300">
            {label.company_name} - {label.service_name}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Rastreio:</span>
            <p className="font-mono font-medium">{label.tracking_code}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Gerada em:</span>
            <p>{format(new Date(label.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
          </div>
          {label.declared_value_cents && label.declared_value_cents > 0 && (
            <div>
              <span className="text-muted-foreground">Valor declarado:</span>
              <p>{formatCurrency(label.declared_value_cents)}</p>
            </div>
          )}
          {label.weight_grams && (
            <div>
              <span className="text-muted-foreground">Peso:</span>
              <p>{label.weight_grams}g</p>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex gap-2">
          {label.label_pdf_url && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => window.open(label.label_pdf_url!, '_blank')}
              >
                <Printer className="w-4 h-4 mr-1" />
                Imprimir
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = label.label_pdf_url!;
                  link.download = `etiqueta-${label.tracking_code}.pdf`;
                  link.click();
                }}
              >
                <Download className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`https://www.melhorrastreio.com.br/rastreio/${label.tracking_code}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // No label yet - show generate button
  return (
    <>
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Etiqueta de Envio
          </span>
        </div>

        {!isConfigured ? (
          <p className="text-sm text-muted-foreground mb-3">
            Configure a integração com o Melhor Envio para gerar etiquetas.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-3">
            Gere a etiqueta de envio para esta venda.
          </p>
        )}

        <Button
          size="sm"
          onClick={() => setShowGenerator(true)}
          disabled={!isConfigured || isCancelled}
          className="w-full"
        >
          <Tag className="w-4 h-4 mr-2" />
          Gerar Etiqueta
        </Button>
      </div>

      {/* Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Gerar Etiqueta - Melhor Envio
            </DialogTitle>
          </DialogHeader>
          <MelhorEnvioLabelGenerator
            sale={sale}
            onSuccess={() => setShowGenerator(false)}
            onCancel={() => setShowGenerator(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

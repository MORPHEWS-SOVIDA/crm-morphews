import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle2, Package } from 'lucide-react';
import { useSale, formatCurrency } from '@/hooks/useSales';
import { SaleScanValidation } from '@/components/serial-labels/SaleScanValidation';
import { useToggleSaleCheckpoint, useSaleCheckpoints, getCheckpointStatus } from '@/hooks/useSaleCheckpoints';
import { toast } from 'sonner';
import { useState } from 'react';

export default function ExpeditionValidatePage() {
  const { saleId } = useParams<{ saleId: string }>();
  const navigate = useNavigate();
  const { data: sale, isLoading } = useSale(saleId);
  const { data: checkpoints = [] } = useSaleCheckpoints(saleId || '');
  const toggleMutation = useToggleSaleCheckpoint();
  const [scanComplete, setScanComplete] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center">
        <p className="text-muted-foreground">Venda não encontrada</p>
        <Button onClick={() => navigate('/expedicao')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const saleItems = (sale.items || []).map(item => ({
    id: item.id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    requisition_number: item.requisition_number || null,
  }));

  const totalUnits = saleItems.reduce((sum, item) => sum + item.quantity, 0);
  const printedStatus = getCheckpointStatus(checkpoints, 'printed');
  const separatedStatus = getCheckpointStatus(checkpoints, 'pending_expedition');

  const handleScanComplete = async () => {
    setScanComplete(true);

    // Auto-mark as separated (pending_expedition)
    if (!separatedStatus.isCompleted) {
      try {
        await toggleMutation.mutateAsync({
          saleId: sale.id,
          checkpointType: 'pending_expedition',
          complete: true,
          notes: 'Validado via scan de etiquetas seriais (mobile)',
        });
        toast.success('✅ Pedido validado e marcado como SEPARADO!');
      } catch {
        toast.error('Erro ao marcar como separado');
      }
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/expedicao')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Validar Expedição</h1>
          <p className="text-sm text-muted-foreground">Romaneio #{sale.romaneio_number}</p>
        </div>
      </div>

      {/* Sale summary card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{sale.lead?.name}</span>
            <Badge variant={separatedStatus.isCompleted ? 'default' : 'outline'}>
              {separatedStatus.isCompleted ? '✅ Separado' : '⏳ Pendente'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {saleItems.length} produto(s), {totalUnits} unidade(s)
            </span>
            <span className="font-semibold text-foreground">
              {formatCurrency(sale.total_cents)}
            </span>
          </div>
          {/* List products */}
          <div className="mt-3 space-y-1">
            {saleItems.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.product_name}</span>
                <span className="font-medium">{item.quantity}x</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scan validation */}
      {scanComplete ? (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold text-green-700">Pedido Validado!</h2>
            <p className="text-sm text-muted-foreground">
              Todos os {totalUnits} itens foram conferidos com sucesso.
            </p>
            <Button onClick={() => navigate('/expedicao')} className="w-full mt-4">
              Voltar para Expedição
            </Button>
          </CardContent>
        </Card>
      ) : (
        <SaleScanValidation
          saleId={sale.id}
          saleNumber={sale.romaneio_number}
          saleItems={saleItems}
          mode="separation"
          onComplete={handleScanComplete}
        />
      )}
    </div>
  );
}

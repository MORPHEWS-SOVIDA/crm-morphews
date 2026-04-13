import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { QRScanner } from '@/components/serial-labels/QRScanner';
import { useReturnSerial } from '@/hooks/useSerialLabels';
import { useCreateStockMovement } from '@/hooks/useStock';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RotateCcw, ScanLine, Search, CheckCircle2, Package, AlertTriangle } from 'lucide-react';

interface ReturnedItem {
  code: string;
  productName: string;
  productId: string;
  saleId: string | null;
}

async function resetSaleToDraft(saleId: string) {
  // 1. Clear all checkpoints
  await supabase
    .from('sale_checkpoints')
    .update({
      completed_at: null,
      completed_by: null,
    })
    .eq('sale_id', saleId);

  // 2. Clear expedition markers
  await supabase
    .from('sales')
    .update({
      status: 'draft',
      expedition_validated_at: null,
      expedition_validated_by: null,
      separated_at: null,
      separated_by: null,
      printed_at: null,
      printed_by: null,
      dispatched_at: null,
      dispatched_by: null,
      delivered_at: null,
      assigned_delivery_user_id: null,
      carrier_tracking_status: null,
      motoboy_tracking_status: null,
    } as any)
    .eq('id', saleId);
}

export function ReturnScanPanel() {
  const { data: orgId } = useCurrentTenantId();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [reason, setReason] = useState('');
  const [returnedItems, setReturnedItems] = useState<ReturnedItem[]>([]);
  const [resetSaleIds, setResetSaleIds] = useState<Set<string>>(new Set());

  const returnMutation = useReturnSerial();
  const stockMutation = useCreateStockMovement();

  const handleScan = useCallback(async (code: string) => {
    if (!orgId) return;

    if (navigator.vibrate) navigator.vibrate(100);

    // Check if already returned in this session
    if (returnedItems.some(r => r.code === code.toUpperCase())) {
      toast.warning(`${code} já foi devolvido nesta sessão`);
      return;
    }

    try {
      // Lookup label
      const { data: label, error } = await supabase
        .from('product_serial_labels')
        .select('*, lead_products:product_id(name)')
        .eq('organization_id', orgId)
        .eq('serial_code', code.toUpperCase())
        .maybeSingle();

      if (error) throw error;
      if (!label) {
        toast.error(`Etiqueta ${code} não encontrada`);
        return;
      }

      if (!['assigned', 'shipped'].includes(label.status as string)) {
        toast.error(`Etiqueta ${code} não está em trânsito/atribuída (status: ${label.status})`);
        return;
      }

      const capturedSaleId = label.sale_id;

      // Return the serial
      await returnMutation.mutateAsync({ serialCode: code, reason });

      // Create stock return movement
      if (label.product_id) {
        await stockMutation.mutateAsync({
          product_id: label.product_id,
          movement_type: 'return',
          quantity: 1,
          notes: `Devolução serial: ${code}. ${reason || ''}`.trim(),
        });
      }

      const productName = (label.lead_products as any)?.name || label.product_name || 'Desconhecido';

      setReturnedItems(prev => [{
        code: code.toUpperCase(),
        productName,
        productId: label.product_id || '',
        saleId: capturedSaleId,
      }, ...prev]);

      // Auto-reset the sale to draft if it hasn't been reset yet
      if (capturedSaleId && !resetSaleIds.has(capturedSaleId)) {
        try {
          await resetSaleToDraft(capturedSaleId);
          setResetSaleIds(prev => new Set(prev).add(capturedSaleId));
          queryClient.invalidateQueries({ queryKey: ['sale'] });
          queryClient.invalidateQueries({ queryKey: ['sale-checkpoints'] });
          queryClient.invalidateQueries({ queryKey: ['sales'] });
          toast.info(`📋 Pedido da venda foi resetado para Rascunho — pronto para re-expedição`);
        } catch (resetErr) {
          console.error('Error resetting sale:', resetErr);
          toast.warning('Produto devolvido, mas não foi possível resetar o pedido automaticamente');
        }
      }

      toast.success(`✅ ${code} devolvido — ${productName}`);

    } catch (err: any) {
      toast.error(err.message);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, [orgId, returnedItems, returnMutation, stockMutation, reason, resetSaleIds, queryClient]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode('');
    }
  };

  // Group returned items by sale
  const affectedSales = [...resetSaleIds];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-purple-600" />
            Devolução ao Estoque
          </CardTitle>
          <CardDescription>
            Escaneie os produtos devolvidos para retornar ao estoque automaticamente.
            O pedido será resetado para Rascunho e precisará ser re-expedido com novos QR codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Textarea
              placeholder="Motivo da devolução (opcional)..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
            />
          </div>

          <QRScanner onScan={handleScan} scanning={scanning} />

          {!scanning ? (
            <Button className="w-full" onClick={() => setScanning(true)}>
              <ScanLine className="h-4 w-4 mr-2" /> Iniciar Scanner de Devoluções
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
              Parar Scanner
            </Button>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Código manual..."
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
            />
            <Button variant="outline" onClick={handleManualSubmit}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info about affected sales */}
      {affectedSales.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {affectedSales.length} pedido(s) resetado(s) para Rascunho
                </p>
                <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                  Os vendedores podem remarcar nova data e a expedição precisará escanear novos QR codes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Returned items */}
      {returnedItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Devolvidos nesta sessão ({returnedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {returnedItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-mono text-xs">{item.code}</span>
                  <span className="text-muted-foreground">— {item.productName}</span>
                  {item.saleId && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      Pedido resetado
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

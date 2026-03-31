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
import { toast } from 'sonner';
import { RotateCcw, ScanLine, Search, CheckCircle2, Package } from 'lucide-react';

interface ReturnedItem {
  code: string;
  productName: string;
  productId: string;
  saleId: string | null;
}

export function ReturnScanPanel() {
  const { data: orgId } = useCurrentTenantId();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [reason, setReason] = useState('');
  const [returnedItems, setReturnedItems] = useState<ReturnedItem[]>([]);

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
        saleId: label.sale_id,
      }, ...prev]);

      toast.success(`✅ ${code} devolvido — ${productName}`);

    } catch (err: any) {
      toast.error(err.message);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, [orgId, returnedItems, returnMutation, stockMutation, reason]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-purple-600" />
            Devolução ao Estoque
          </CardTitle>
          <CardDescription>
            Escaneie os produtos devolvidos para retornar ao estoque automaticamente
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
                      Venda vinculada
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

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { QRScanner } from '@/components/serial-labels/QRScanner';
import { useAssignSerialsToSale, useShipSerials, useSaleSerials } from '@/hooks/useSerialLabels';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { 
  ScanLine, CheckCircle2, XCircle, AlertTriangle, Package, 
  Truck, Search, RotateCcw
} from 'lucide-react';

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  requisition_number?: string | null;
}

interface ScanResult {
  code: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  productName?: string;
}

interface SaleScanValidationProps {
  saleId: string;
  saleNumber?: string | number;
  saleItems: SaleItem[];
  mode: 'separation' | 'expedition' | 'return';
  onComplete?: () => void;
}

export function SaleScanValidation({ 
  saleId, 
  saleNumber, 
  saleItems, 
  mode,
  onComplete 
}: SaleScanValidationProps) {
  const { data: orgId } = useCurrentTenantId();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [confirmedManipulados, setConfirmedManipulados] = useState<Set<string>>(new Set());

  const assignMutation = useAssignSerialsToSale();
  const shipMutation = useShipSerials();
  const { data: assignedSerials = [], refetch: refetchSerials } = useSaleSerials(saleId);

  // Separate manipulado items from serial items
  const manipuladoItems = useMemo(() => 
    saleItems.filter(item => !!item.requisition_number), [saleItems]);
  const serialItems = useMemo(() => 
    saleItems.filter(item => !item.requisition_number), [saleItems]);

  // Calculate progress per product (only serial items)
  const progressByProduct = useMemo(() => {
    const map: Record<string, { needed: number; scanned: number; productName: string }> = {};
    
    serialItems.forEach(item => {
      map[item.product_id] = {
        needed: item.quantity,
        scanned: 0,
        productName: item.product_name,
      };
    });

    assignedSerials.forEach(serial => {
      if (serial.product_id && map[serial.product_id]) {
        map[serial.product_id].scanned++;
      }
    });

    return map;
  }, [serialItems, assignedSerials]);

  const totalSerialNeeded = serialItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalSerialScanned = assignedSerials.length;
  const totalManipulados = manipuladoItems.length;
  const totalManipuladosConfirmed = confirmedManipulados.size;
  
  const totalNeeded = totalSerialNeeded + totalManipulados;
  const totalDone = totalSerialScanned + totalManipuladosConfirmed;
  const progressPercent = totalNeeded > 0 ? Math.min(100, (totalDone / totalNeeded) * 100) : 0;
  const isComplete = totalDone >= totalNeeded;

  const handleScan = useCallback(async (code: string) => {
    if (!orgId) return;

    // Vibrate for feedback
    if (navigator.vibrate) navigator.vibrate(100);

    // Check for duplicate in this sale
    const alreadyScanned = assignedSerials.find(s => s.serial_code === code.toUpperCase());
    if (alreadyScanned) {
      setScanResults(prev => [{
        code,
        status: 'warning',
        message: 'Já escaneado neste pedido',
        productName: alreadyScanned.product_name || undefined,
      }, ...prev]);
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      toast.warning(`${code} já foi escaneado neste pedido`);
      return;
    }

    if (mode === 'separation') {
      try {
        // Look up what product this serial belongs to
        const { data: label, error } = await supabase
          .from('product_serial_labels')
          .select('*, lead_products:product_id(name)')
          .eq('organization_id', orgId)
          .eq('serial_code', code.toUpperCase())
          .maybeSingle();

        if (error) throw error;

        if (!label) {
          setScanResults(prev => [{ code, status: 'error', message: 'Etiqueta não encontrada no sistema' }, ...prev]);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          toast.error(`${code} não encontrado`);
          return;
        }

        if (label.status !== 'in_stock') {
          setScanResults(prev => [{ code, status: 'error', message: `Status inválido: ${label.status}` }, ...prev]);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          toast.error(`${code} não está em estoque`);
          return;
        }

        // Check if product matches any sale item
        const matchingItem = saleItems.find(item => item.product_id === label.product_id);
        if (!matchingItem) {
          const productName = (label.lead_products as any)?.name || label.product_name || 'Desconhecido';
          setScanResults(prev => [{
            code,
            status: 'error',
            message: `Produto "${productName}" não faz parte deste pedido`,
            productName,
          }, ...prev]);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          toast.error(`${code} é ${productName} — não faz parte deste pedido!`);
          return;
        }

        // Check if already have enough of this product
        const prog = progressByProduct[label.product_id!];
        if (prog && prog.scanned >= prog.needed) {
          setScanResults(prev => [{
            code,
            status: 'warning',
            message: `Já tem ${prog.needed} unid. de ${matchingItem.product_name} escaneadas`,
            productName: matchingItem.product_name,
          }, ...prev]);
          toast.warning(`Já tem a quantidade necessária de ${matchingItem.product_name}`);
          return;
        }

        // Assign to sale
        await assignMutation.mutateAsync({
          serialCode: code,
          saleId,
          saleItemId: matchingItem.id,
        });

        setScanResults(prev => [{
          code,
          status: 'success',
          message: 'Conferido!',
          productName: matchingItem.product_name,
        }, ...prev]);
        
        await refetchSerials();
        toast.success(`✅ ${code} — ${matchingItem.product_name}`);

      } catch (err: any) {
        setScanResults(prev => [{ code, status: 'error', message: err.message }, ...prev]);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }
  }, [orgId, assignedSerials, saleItems, mode, saleId, assignMutation, progressByProduct, refetchSerials]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode('');
    }
  };

  const handleFinishExpedition = async () => {
    if (!isComplete) {
      toast.error('Escaneie todos os itens antes de finalizar');
      return;
    }

    const codes = assignedSerials.map(s => s.serial_code);
    await shipMutation.mutateAsync({ serialCodes: codes });
    onComplete?.();
  };

  const modeConfig = {
    separation: { title: 'Conferência de Separação', icon: Package, color: 'text-blue-600' },
    expedition: { title: 'Confirmar Expedição', icon: Truck, color: 'text-orange-600' },
    return: { title: 'Registrar Devolução', icon: RotateCcw, color: 'text-purple-600' },
  };

  const config = modeConfig[mode];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <config.icon className={`h-5 w-5 ${config.color}`} />
            {config.title}
          </CardTitle>
          {saleNumber && (
            <CardDescription>Venda #{saleNumber}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso: {totalDone}/{totalNeeded} itens</span>
              <span className="font-semibold">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Manipulados section */}
          {manipuladoItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">Manipulados (confirmação manual):</p>
              {manipuladoItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm p-2 rounded border border-amber-200 bg-amber-50/50">
                  <input
                    type="checkbox"
                    checked={confirmedManipulados.has(item.id)}
                    onChange={(e) => {
                      const next = new Set(confirmedManipulados);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      setConfirmedManipulados(next);
                    }}
                    className="h-4 w-4 rounded border-amber-400"
                  />
                  <span className={confirmedManipulados.has(item.id) ? 'line-through text-muted-foreground' : ''}>
                    {item.product_name} — {item.quantity}x
                  </span>
                  {item.requisition_number && (
                    <Badge variant="outline" className="ml-auto text-xs font-mono border-amber-300">
                      Req: {item.requisition_number}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Per-product progress (serial items only) */}
          {serialItems.length > 0 && (
            <div className="space-y-1">
              {manipuladoItems.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">Produtos com etiqueta serial:</p>
              )}
              {Object.entries(progressByProduct).map(([productId, prog]) => (
                <div key={productId} className="flex items-center justify-between text-sm">
                  <span className={prog.scanned >= prog.needed ? 'text-green-600 line-through' : ''}>
                    {prog.productName}
                  </span>
                  <Badge variant={prog.scanned >= prog.needed ? 'default' : 'outline'}>
                    {prog.scanned}/{prog.needed}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <QRScanner
            onScan={handleScan}
            scanning={scanning}
          />

          {!scanning ? (
            <Button className="w-full" onClick={() => setScanning(true)} disabled={isComplete}>
              <ScanLine className="h-4 w-4 mr-2" /> 
              {isComplete ? 'Todos os itens escaneados!' : 'Iniciar Scanner'}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
              Parar Scanner
            </Button>
          )}

          {/* Manual input */}
          <div className="flex gap-2">
            <Input
              placeholder="Digitar código manual..."
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

      {/* Scan results log */}
      {scanResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico de Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {scanResults.map((result, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                  {result.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                  {result.status === 'error' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  {result.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />}
                  <span className="font-mono text-xs">{result.code}</span>
                  {result.productName && (
                    <span className="text-muted-foreground">— {result.productName}</span>
                  )}
                  <span className={`ml-auto text-xs ${
                    result.status === 'success' ? 'text-green-600' :
                    result.status === 'error' ? 'text-destructive' : 'text-yellow-600'
                  }`}>
                    {result.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish button */}
      {mode === 'separation' && isComplete && (
        <Button 
          className="w-full" 
          size="lg"
          onClick={handleFinishExpedition}
          disabled={shipMutation.isPending}
        >
          <Truck className="h-5 w-5 mr-2" />
          {shipMutation.isPending ? 'Finalizando...' : 'Confirmar Separação e Enviar'}
        </Button>
      )}
    </div>
  );
}

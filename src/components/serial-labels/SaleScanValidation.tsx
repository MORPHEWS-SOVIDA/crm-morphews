import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { LinkAvailableSerialDialog, type PendingProductOption } from './LinkAvailableSerialDialog';

// Categories that skip QR serial scanning (manual confirmation only)
const NO_SCAN_CATEGORIES = ['manipulado', 'servico'];

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
  const [productCategories, setProductCategories] = useState<Record<string, string>>({});
  const [linkDialog, setLinkDialog] = useState<{
    open: boolean;
    serialCode: string;
    pending: PendingProductOption[];
  }>({ open: false, serialCode: '', pending: [] });

  const assignMutation = useAssignSerialsToSale();
  const shipMutation = useShipSerials();
  const { data: assignedSerials = [], refetch: refetchSerials } = useSaleSerials(saleId);

  // ===== Anti-race / anti-pistola dupla =====
  // Lock para impedir reentrância enquanto um bipe ainda está sendo gravado
  const processingRef = useRef(false);
  // Contador otimista por produto (incrementa antes do refetch concluir)
  const optimisticByProductRef = useRef<Record<string, number>>({});
  // Códigos vistos recentemente — bloqueia dupla leitura da pistola
  const recentCodesRef = useRef<Map<string, number>>(new Map());
  const DUPLICATE_WINDOW_MS = 1500;

  // Fetch product categories to determine which items need scanning
  useEffect(() => {
    if (!orgId || saleItems.length === 0) return;
    const productIds = [...new Set(saleItems.map(i => i.product_id))];
    supabase
      .from('lead_products')
      .select('id, category')
      .in('id', productIds)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach(p => { map[p.id] = p.category; });
          setProductCategories(map);
        }
      });
  }, [orgId, saleItems]);

  // An item skips QR scanning if it has requisition_number OR its category is manipulado/servico
  const isManualItem = useCallback((item: SaleItem) => {
    if (item.requisition_number) return true;
    const cat = productCategories[item.product_id];
    return cat ? NO_SCAN_CATEGORIES.includes(cat) : false;
  }, [productCategories]);

  // Separate manual-confirmation items from serial items
  const manipuladoItems = useMemo(() => 
    saleItems.filter(item => isManualItem(item)), [saleItems, isManualItem]);
  const serialItems = useMemo(() => 
    saleItems.filter(item => !isManualItem(item)), [saleItems, isManualItem]);

  // Calculate progress per product (only serial items)
  const progressByProduct = useMemo(() => {
    const map: Record<string, { needed: number; scanned: number; productName: string }> = {};
    
    serialItems.forEach(item => {
      // Sum quantities when multiple sale_items share the same product_id
      // (e.g. produto + "produto (Cópia)" cadastrado como mesmo product_id)
      if (map[item.product_id]) {
        map[item.product_id].needed += item.quantity;
      } else {
        map[item.product_id] = {
          needed: item.quantity,
          scanned: 0,
          productName: item.product_name,
        };
      }
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

  const handleScan = useCallback(async (rawCode: string) => {
    if (!orgId) return;
    const code = (rawCode || '').trim().toUpperCase();
    if (!code) return;

    // ---- Anti-pistola dupla: ignora releituras do mesmo código em < 1.5s ----
    const now = Date.now();
    const lastSeen = recentCodesRef.current.get(code);
    if (lastSeen && now - lastSeen < DUPLICATE_WINDOW_MS) {
      return; // silenciosamente ignora (pistola disparou 2x)
    }
    recentCodesRef.current.set(code, now);
    // limpa entradas antigas
    if (recentCodesRef.current.size > 200) {
      for (const [k, t] of recentCodesRef.current) {
        if (now - t > 10_000) recentCodesRef.current.delete(k);
      }
    }

    // ---- Lock global: só processa um bipe por vez ----
    if (processingRef.current) {
      toast.warning('Aguarde, processando bipe anterior...');
      return;
    }
    processingRef.current = true;

    // Vibrate for feedback
    if (navigator.vibrate) navigator.vibrate(60);

    try {
      // Já escaneado neste pedido?
      const alreadyScanned = assignedSerials.find(s => s.serial_code === code);
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

      if (mode !== 'separation') return;

      // Look up what product this serial belongs to
      const { data: label, error } = await supabase
        .from('product_serial_labels')
        .select('*, lead_products:product_id(name)')
        .eq('organization_id', orgId)
        .eq('serial_code', code)
        .maybeSingle();

      if (error) throw error;

      if (!label) {
        setScanResults(prev => [{ code, status: 'error', message: 'Etiqueta não encontrada no sistema' }, ...prev]);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        toast.error(`${code} não encontrado`);
        return;
      }

      // ===== Etiqueta CRUA (available, sem produto): vincular na hora =====
      if (label.status === 'available' && !label.product_id) {
        // Calcula produtos pendentes (que ainda precisam de bipes)
        const pendingByProduct = new Map<string, PendingProductOption>();
        for (const item of serialItems) {
          const prog = progressByProduct[item.product_id];
          const optimistic = optimisticByProductRef.current[item.product_id] || 0;
          const pendingQty = (prog?.needed || item.quantity) - (prog?.scanned || 0) - optimistic;
          if (pendingQty <= 0) continue;
          // Se houver vários sale_items pro mesmo produto, fica com o primeiro com pendência
          if (!pendingByProduct.has(item.product_id)) {
            pendingByProduct.set(item.product_id, {
              product_id: item.product_id,
              product_name: item.product_name,
              sale_item_id: item.id,
              pending: pendingQty,
            });
          }
        }
        const pending = Array.from(pendingByProduct.values());

        if (pending.length === 0) {
          setScanResults(prev => [{
            code,
            status: 'warning',
            message: 'Todos os produtos do pedido já estão completos',
          }, ...prev]);
          toast.warning('Todos os produtos rastreáveis já foram bipados');
          return;
        }

        if (pending.length === 1) {
          // Auto-vincula sem perguntar
          const choice = pending[0];
          optimisticByProductRef.current[choice.product_id] =
            (optimisticByProductRef.current[choice.product_id] || 0) + 1;
          try {
            const { error: rpcErr } = await supabase.rpc('link_and_assign_serial_to_sale', {
              p_serial_code: code,
              p_product_id: choice.product_id,
              p_sale_id: saleId,
              p_sale_item_id: choice.sale_item_id,
            });
            if (rpcErr) throw rpcErr;
            setScanResults(prev => [{
              code,
              status: 'success',
              message: `Vinculado e bipado em ${choice.product_name}`,
              productName: choice.product_name,
            }, ...prev]);
            toast.success(`✅ ${code} → ${choice.product_name}`);
            await refetchSerials();
            optimisticByProductRef.current[choice.product_id] = 0;
          } catch (e: any) {
            optimisticByProductRef.current[choice.product_id] =
              Math.max(0, (optimisticByProductRef.current[choice.product_id] || 1) - 1);
            setScanResults(prev => [{
              code,
              status: 'error',
              message: e.message || 'Falha ao vincular etiqueta',
            }, ...prev]);
            toast.error(e.message || 'Falha ao vincular etiqueta');
          }
          return;
        }

        // 2+ produtos pendentes — abre diálogo
        setLinkDialog({ open: true, serialCode: code, pending });
        return;
      }

      if (label.status !== 'in_stock') {
        setScanResults(prev => [{ code, status: 'error', message: `Status inválido: ${label.status}` }, ...prev]);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        toast.error(`${code} não está em estoque (${label.status})`);
        return;
      }

      // Produto faz parte do pedido?
      const matchingItem = serialItems.find(item => item.product_id === label.product_id);
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

      // Cap com contador OTIMISTA (cobre race entre bipes rápidos antes do refetch)
      const prog = progressByProduct[label.product_id!];
      const optimistic = optimisticByProductRef.current[label.product_id!] || 0;
      const effectiveScanned = (prog?.scanned || 0) + optimistic;
      if (prog && effectiveScanned >= prog.needed) {
        setScanResults(prev => [{
          code,
          status: 'warning',
          message: `Já tem ${prog.needed} unid. de ${matchingItem.product_name} escaneadas`,
          productName: matchingItem.product_name,
        }, ...prev]);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        toast.warning(`Já tem a quantidade necessária de ${matchingItem.product_name}`);
        return;
      }

      // Reserva otimista ANTES do await
      optimisticByProductRef.current[label.product_id!] = optimistic + 1;

      try {
        await assignMutation.mutateAsync({
          serialCode: code,
          saleId,
          saleItemId: matchingItem.id,
        });
      } catch (e: any) {
        // rollback otimista
        optimisticByProductRef.current[label.product_id!] = optimistic;
        // Trata erro do trigger anti-overscan do banco
        const msg = String(e?.message || '');
        if (msg.includes('Excesso de bipes') || e?.code === '23514') {
          setScanResults(prev => [{
            code,
            status: 'error',
            message: `Excesso bloqueado pelo sistema: ${matchingItem.product_name}`,
            productName: matchingItem.product_name,
          }, ...prev]);
          if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
          toast.error(`🚫 Excesso bloqueado: ${matchingItem.product_name}`);
          return;
        }
        throw e;
      }

      setScanResults(prev => [{
        code,
        status: 'success',
        message: 'Conferido!',
        productName: matchingItem.product_name,
      }, ...prev]);

      await refetchSerials();
      // Após refetch, zera o otimista (já refletiu na contagem real)
      optimisticByProductRef.current[label.product_id!] = 0;
      toast.success(`✅ ${code} — ${matchingItem.product_name}`);

    } catch (err: any) {
      setScanResults(prev => [{ code, status: 'error', message: err.message }, ...prev]);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      toast.error(err.message || 'Erro ao processar bipe');
    } finally {
      processingRef.current = false;
    }
  }, [orgId, assignedSerials, serialItems, mode, saleId, assignMutation, progressByProduct, refetchSerials]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
      setManualCode('');
    }
  };

  const handleFinishExpedition = async () => {
    if (!isComplete) {
      toast.error('Confirme todos os itens antes de finalizar');
      return;
    }

    // Only ship serials if there are any
    const codes = assignedSerials.map(s => s.serial_code);
    if (codes.length > 0) {
      await shipMutation.mutateAsync({ serialCodes: codes });
    }
    onComplete?.();
  };

  const modeConfig = {
    separation: { title: 'Conferência de Separação', icon: Package, color: 'text-blue-600' },
    expedition: { title: 'Confirmar Expedição', icon: Truck, color: 'text-orange-600' },
    return: { title: 'Registrar Devolução', icon: RotateCcw, color: 'text-purple-600' },
  };

  const config = modeConfig[mode];

  const handleLinkConfirm = useCallback(async (input: {
    productId: string;
    saleItemId: string;
    productName: string;
    lote: string;
    validade: string;
  }) => {
    const code = linkDialog.serialCode;
    optimisticByProductRef.current[input.productId] =
      (optimisticByProductRef.current[input.productId] || 0) + 1;
    try {
      const { error: rpcErr } = await supabase.rpc('link_and_assign_serial_to_sale', {
        p_serial_code: code,
        p_product_id: input.productId,
        p_sale_id: saleId,
        p_sale_item_id: input.saleItemId,
        p_lote: input.lote || null,
        p_validade: input.validade || null,
      });
      if (rpcErr) throw rpcErr;
      setScanResults(prev => [{
        code,
        status: 'success',
        message: `Vinculado e bipado em ${input.productName}`,
        productName: input.productName,
      }, ...prev]);
      toast.success(`✅ ${code} → ${input.productName}`);
      await refetchSerials();
      optimisticByProductRef.current[input.productId] = 0;
      setLinkDialog({ open: false, serialCode: '', pending: [] });
    } catch (e: any) {
      optimisticByProductRef.current[input.productId] =
        Math.max(0, (optimisticByProductRef.current[input.productId] || 1) - 1);
      toast.error(e.message || 'Falha ao vincular etiqueta');
    }
  }, [linkDialog.serialCode, saleId, refetchSerials]);

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
              <p className="text-xs font-medium text-amber-700">Manipulados / Serviços (confirmação manual):</p>
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

      {/* Scanner - only show if there are serial items to scan */}
      {serialItems.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <QRScanner
              onScan={handleScan}
              scanning={scanning}
            />

            {!scanning ? (
              <Button className="w-full" onClick={() => setScanning(true)} disabled={isComplete}>
                <ScanLine className="h-4 w-4 mr-2" /> 
                {isComplete ? 'Todos os itens conferidos!' : 'Iniciar Scanner'}
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
      )}

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

      {/* Diálogo de vínculo de etiqueta crua */}
      <LinkAvailableSerialDialog
        open={linkDialog.open}
        serialCode={linkDialog.serialCode}
        pendingProducts={linkDialog.pending}
        onCancel={() => setLinkDialog({ open: false, serialCode: '', pending: [] })}
        onConfirm={handleLinkConfirm}
      />
    </div>
  );
}

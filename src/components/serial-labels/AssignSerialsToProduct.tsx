import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useAssignSerialsToProduct } from '@/hooks/useSerialLabels';
import { useStockLocations } from '@/hooks/useStockLocations';
import { useCreateStockMovement } from '@/hooks/useStock';
import { useAuth } from '@/hooks/useAuth';
import { logSerialAction } from '@/hooks/useSerialLabelLogs';
import { QRScanner } from '@/components/serial-labels/QRScanner';
import { Package, Tag, ArrowRight, CheckCircle2, ScanLine, Hash, X } from 'lucide-react';
import { toast } from 'sonner';

const MONTHS = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
];

export function AssignSerialsToProduct() {
  const { data: orgId } = useCurrentTenantId();
  const { user } = useAuth();
  const assignMutation = useAssignSerialsToProduct();
  const stockMutation = useCreateStockMovement();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [lote, setLote] = useState('');
  const [validadeMes, setValidadeMes] = useState('');
  const [validadeAno, setValidadeAno] = useState(String(new Date().getFullYear() + 1));
  const [stockLocationId, setStockLocationId] = useState<string>('');

  const { data: stockLocations = [] } = useStockLocations();

  useEffect(() => {
    if (!stockLocationId && stockLocations.length > 0) {
      const def = stockLocations.find(l => l.is_default) || stockLocations[0];
      if (def) setStockLocationId(def.id);
    }
  }, [stockLocations, stockLocationId]);

  // Range mode
  const [prefix, setPrefix] = useState('VIDA');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Scan mode
  const [scanMode, setScanMode] = useState<'single' | 'multiple' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);

  const [lastResult, setLastResult] = useState<{ count: number; product: string } | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ['products-for-serial', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('lead_products')
        .select('id, name')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const start = parseInt(rangeStart) || 0;
  const end = parseInt(rangeEnd) || 0;
  const rangeQuantity = end >= start ? end - start + 1 : 0;
  const validade = validadeMes && validadeAno ? `${validadeMes}/${validadeAno}` : '';

  const baseValidations = (): string | null => {
    if (!selectedProductId || !selectedProduct) return 'Selecione um produto';
    if (!lote.trim()) return 'Informe o Lote';
    if (!validade) return 'Informe Mês/Ano de validade';
    return null;
  };

  const handleScannedCode = (code: string) => {
    const norm = code.trim().toUpperCase();
    if (!norm) return;
    if (scanMode === 'single') {
      setScannedCodes([norm]);
      setScanning(false);
      toast.success(`Lido: ${norm}`);
    } else {
      setScannedCodes(prev => {
        if (prev.includes(norm)) {
          toast.info(`${norm} já lido`);
          return prev;
        }
        toast.success(`Lido: ${norm}`);
        return [...prev, norm];
      });
    }
  };

  const handleAssignRange = async () => {
    const baseErr = baseValidations();
    if (baseErr) { toast.error(baseErr); return; }
    if (start <= 0 || end <= 0 || end < start) {
      toast.error('Faixa numérica inválida');
      return;
    }
    if (rangeQuantity > 5000) {
      toast.error('Máximo de 5.000 etiquetas por associação');
      return;
    }

    try {
      const codesToCheck = [start, end];
      if (rangeQuantity > 2) codesToCheck.push(Math.floor((start + end) / 2));
      const sampleCodes = codesToCheck.map(n => `${prefix}${String(n).padStart(5, '0')}`);

      const { data: existingLabels, error: checkError } = await supabase
        .from('product_serial_labels')
        .select('serial_code')
        .eq('organization_id', orgId!)
        .in('serial_code', sampleCodes);
      if (checkError) throw checkError;

      const existingCodes = new Set((existingLabels || []).map((l: any) => l.serial_code));
      const missing = sampleCodes.filter(c => !existingCodes.has(c));
      if (missing.length > 0) {
        toast.error(`Etiquetas não encontradas: ${missing.join(', ')}. Verifique prefixo/faixa.`);
        return;
      }

      const result = await assignMutation.mutateAsync({
        productId: selectedProductId,
        productName: selectedProduct!.name,
        serialStart: start,
        serialEnd: end,
        prefix,
        lote: lote.trim(),
        validade,
      });

      await stockMutation.mutateAsync({
        product_id: selectedProductId,
        movement_type: 'entry',
        quantity: rangeQuantity,
        notes: `Entrada via serialização: ${prefix}${String(start).padStart(5, '0')} a ${prefix}${String(end).padStart(5, '0')} | Lote ${lote} | Val ${validade}`,
      });

      if (orgId) {
        logSerialAction({
          organization_id: orgId,
          action: 'assign_product',
          user_id: user?.id,
          success: true,
          details: {
            mode: 'range',
            product_id: selectedProductId,
            product_name: selectedProduct!.name,
            prefix, range_start: start, range_end: end,
            count: result.updated, lote, validade,
          },
        });
      }

      setLastResult({ count: result.updated, product: selectedProduct!.name });
      setRangeStart(''); setRangeEnd('');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao associar etiquetas');
    }
  };

  const handleAssignScanned = async () => {
    const baseErr = baseValidations();
    if (baseErr) { toast.error(baseErr); return; }
    if (scannedCodes.length === 0) {
      toast.error('Nenhum QR Code lido');
      return;
    }

    try {
      const result = await assignMutation.mutateAsync({
        productId: selectedProductId,
        productName: selectedProduct!.name,
        explicitCodes: scannedCodes,
        lote: lote.trim(),
        validade,
      });

      await stockMutation.mutateAsync({
        product_id: selectedProductId,
        movement_type: 'entry',
        quantity: result.updated,
        notes: `Entrada via QR scan (${result.updated} unid) | Lote ${lote} | Val ${validade}`,
      });

      if (orgId) {
        logSerialAction({
          organization_id: orgId,
          action: 'assign_product',
          user_id: user?.id,
          success: true,
          details: {
            mode: 'scan',
            product_id: selectedProductId,
            product_name: selectedProduct!.name,
            count: result.updated,
            scanned_codes: scannedCodes,
            lote, validade,
          },
        });
      }

      setLastResult({ count: result.updated, product: selectedProduct!.name });
      setScannedCodes([]);
      setScanMode(null);
      setScanning(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao associar etiquetas');
    }
  };

  const removeCode = (code: string) => {
    setScannedCodes(prev => prev.filter(c => c !== code));
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => String(currentYear + i));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Associar Etiquetas ao Produto
        </CardTitle>
        <CardDescription>
          Vincule etiquetas a um produto, com Lote e Validade para rastreabilidade
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product */}
        <div>
          <Label>Produto</Label>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lote + Validade */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Lote</Label>
            <Input
              value={lote}
              onChange={e => setLote(e.target.value)}
              placeholder="Ex: L2026A"
              maxLength={50}
            />
          </div>
          <div>
            <Label>Validade — Mês</Label>
            <Select value={validadeMes} onValueChange={setValidadeMes}>
              <SelectTrigger><SelectValue placeholder="MM" /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Validade — Ano</Label>
            <Select value={validadeAno} onValueChange={setValidadeAno}>
              <SelectTrigger><SelectValue placeholder="AAAA" /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mode tabs */}
        <Tabs defaultValue="range" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="range"><Hash className="h-4 w-4 mr-1" /> Por Faixa Numérica</TabsTrigger>
            <TabsTrigger value="scan"><ScanLine className="h-4 w-4 mr-1" /> Ler QR Code</TabsTrigger>
          </TabsList>

          {/* RANGE */}
          <TabsContent value="range" className="space-y-4 pt-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Prefixo</Label>
                <Input value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} maxLength={4} placeholder="VIDA" />
              </div>
              <div>
                <Label>De</Label>
                <Input type="number" value={rangeStart} onChange={e => setRangeStart(e.target.value)} placeholder="10001" min={1} />
              </div>
              <div>
                <Label>Até</Label>
                <Input type="number" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} placeholder="10200" min={1} />
              </div>
            </div>

            {rangeQuantity > 0 && selectedProduct && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="font-mono">{prefix}{String(start).padStart(5, '0')}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{prefix}{String(end).padStart(5, '0')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  <strong>{rangeQuantity.toLocaleString()}</strong> etiquetas → <strong>{selectedProduct.name}</strong>
                  {lote && validade && <> · Lote <strong>{lote}</strong> · Val <strong>{validade}</strong></>}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleAssignRange}
              disabled={assignMutation.isPending || stockMutation.isPending || !selectedProductId || rangeQuantity <= 0}
            >
              {assignMutation.isPending || stockMutation.isPending
                ? 'Associando...'
                : `Associar ${rangeQuantity > 0 ? rangeQuantity.toLocaleString() : 0} Etiquetas e Dar Entrada`}
            </Button>
          </TabsContent>

          {/* SCAN */}
          <TabsContent value="scan" className="space-y-4 pt-4">
            {scanMode === null && (
              <div className="space-y-3">
                <Label>Você vai ler 1 único QR Code, ou vários do mesmo produto?</Label>
                <RadioGroup
                  value=""
                  onValueChange={(v) => {
                    setScanMode(v as 'single' | 'multiple');
                    setScannedCodes([]);
                    setScanning(true);
                  }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <label className="flex items-center gap-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="single" />
                    <div>
                      <p className="font-medium">1 único QR Code</p>
                      <p className="text-xs text-muted-foreground">Ler e associar uma só etiqueta</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="multiple" />
                    <div>
                      <p className="font-medium">Vários QR Codes</p>
                      <p className="text-xs text-muted-foreground">Ler em sequência, todas do mesmo produto/lote</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            {scanMode !== null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Modo: <strong>{scanMode === 'single' ? '1 único QR' : 'Vários QR'}</strong>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setScanMode(null); setScanning(false); setScannedCodes([]); }}
                  >
                    Trocar modo
                  </Button>
                </div>

                <QRScanner onScan={handleScannedCode} scanning={scanning} />

                {scannedCodes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Lidos ({scannedCodes.length}):</p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {scannedCodes.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 bg-muted text-xs font-mono px-2 py-1 rounded">
                          {c}
                          <button onClick={() => removeCode(c)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleAssignScanned}
                  disabled={assignMutation.isPending || stockMutation.isPending || !selectedProductId || scannedCodes.length === 0}
                >
                  {assignMutation.isPending || stockMutation.isPending
                    ? 'Associando...'
                    : `Associar ${scannedCodes.length} Etiqueta(s) Lida(s)`}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Last result */}
        {lastResult && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {lastResult.count} etiquetas associadas a <strong>{lastResult.product}</strong> com entrada registrada!
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

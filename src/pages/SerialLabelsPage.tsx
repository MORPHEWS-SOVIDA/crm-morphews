import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QRScanner } from '@/components/serial-labels/QRScanner';
import { AssignSerialsToProduct } from '@/components/serial-labels/AssignSerialsToProduct';
import { SaleScanValidation } from '@/components/serial-labels/SaleScanValidation';
import { ReturnScanPanel } from '@/components/serial-labels/ReturnScanPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { 
  QrCode, Package, Search, ScanLine, Upload, 
  Tag, RotateCcw, Truck, ClipboardList
} from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Disponível', variant: 'outline' },
  in_stock: { label: 'Em Estoque', variant: 'default' },
  assigned: { label: 'Atribuído', variant: 'secondary' },
  shipped: { label: 'Enviado', variant: 'secondary' },
  delivered: { label: 'Entregue', variant: 'default' },
  returned: { label: 'Devolvido', variant: 'destructive' },
};

export default function SerialLabelsPage() {
  const { profile } = useAuth();
  const { data: currentOrganizationId } = useCurrentTenantId();
  const [activeTab, setActiveTab] = useState('associate');

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [scannedLabel, setScannedLabel] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Bulk register state
  const [bulkPrefix, setBulkPrefix] = useState('VIDA');
  const [bulkStart, setBulkStart] = useState(1);
  const [bulkEnd, setBulkEnd] = useState(5000);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Sale scan state
  const [saleIdInput, setSaleIdInput] = useState('');
  const [saleData, setSaleData] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loadingSale, setLoadingSale] = useState(false);

  const lookupCode = async (code: string) => {
    if (!code || !currentOrganizationId) return;
    setScanLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('*, lead_products:product_id(name)')
        .eq('organization_id', currentOrganizationId)
        .eq('serial_code', code.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setScannedLabel(data);
        setScannedCode(code);
        toast.success(`Etiqueta encontrada: ${code}`);
      } else {
        setScannedLabel(null);
        setScannedCode(code);
        toast.info(`Etiqueta ${code} não registrada no sistema`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar etiqueta');
    } finally {
      setScanLoading(false);
    }
  };

  const handleScan = (code: string) => {
    lookupCode(code);
    if (navigator.vibrate) navigator.vibrate(100);
  };

  const handleSearch = async () => {
    if (!searchQuery || !currentOrganizationId) return;
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('*, lead_products:product_id(name)')
        .eq('organization_id', currentOrganizationId)
        .ilike('serial_code', `%${searchQuery.trim()}%`)
        .order('serial_code')
        .limit(50);

      if (error) throw error;
      setSearchResults(data || []);
      if (!data?.length) toast.info('Nenhuma etiqueta encontrada');
    } catch (err) {
      console.error(err);
      toast.error('Erro na busca');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleBulkRegister = async () => {
    if (!currentOrganizationId) return;
    if (bulkEnd - bulkStart + 1 > 10000) {
      toast.error('Máximo de 10.000 etiquetas por lote');
      return;
    }

    setBulkLoading(true);
    try {
      const batchLabel = `${bulkPrefix}${String(bulkStart).padStart(5, '0')}-${bulkPrefix}${String(bulkEnd).padStart(5, '0')}`;
      const BATCH_SIZE = 500;
      let totalInserted = 0;

      for (let i = bulkStart; i <= bulkEnd; i += BATCH_SIZE) {
        const end = Math.min(i + BATCH_SIZE - 1, bulkEnd);
        const rows = [];
        for (let j = i; j <= end; j++) {
          rows.push({
            organization_id: currentOrganizationId,
            serial_code: `${bulkPrefix}${String(j).padStart(5, '0')}`,
            status: 'available' as const,
            batch_label: batchLabel,
          });
        }

        const { error } = await supabase
          .from('product_serial_labels')
          .upsert(rows, { onConflict: 'organization_id,serial_code', ignoreDuplicates: true });

        if (error) throw error;
        totalInserted += rows.length;
        toast.info(`Registrando... ${totalInserted}/${bulkEnd - bulkStart + 1}`);
      }

      toast.success(`${totalInserted} etiquetas registradas com sucesso!`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao registrar: ${err.message}`);
    } finally {
      setBulkLoading(false);
    }
  };

  const loadSale = async () => {
    if (!saleIdInput || !currentOrganizationId) return;
    setLoadingSale(true);
    try {
      // Try to find sale by number or ID
      let query = supabase
        .from('sales')
        .select('id, romaneio_number, lead_id')
        .eq('organization_id', currentOrganizationId);
      
      // If it looks like a number, search by romaneio_number
      if (/^\d+$/.test(saleIdInput.trim())) {
        query = query.eq('romaneio_number', parseInt(saleIdInput.trim()));
      } else {
        query = query.eq('id', saleIdInput.trim());
      }

      const { data: sale, error: saleErr } = await query.maybeSingle();
      if (saleErr) throw saleErr;
      if (!sale) {
        toast.error('Venda não encontrada');
        setLoadingSale(false);
        return;
      }

      // Load sale items
      const { data: items, error: itemsErr } = await supabase
        .from('sale_items')
        .select('id, product_id, product_name, quantity')
        .eq('sale_id', sale.id);

      if (itemsErr) throw itemsErr;

      setSaleData(sale);
      setSaleItems(items || []);
      toast.success(`Venda #${sale.romaneio_number} carregada`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar venda');
    } finally {
      setLoadingSale(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <QrCode className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Etiquetas Seriais</h1>
          <p className="text-sm text-muted-foreground">Rastreabilidade unitária de produtos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="associate" className="gap-1 text-xs">
            <Tag className="h-3.5 w-3.5" /> Associar
          </TabsTrigger>
          <TabsTrigger value="separation" className="gap-1 text-xs">
            <ClipboardList className="h-3.5 w-3.5" /> Separação
          </TabsTrigger>
          <TabsTrigger value="return" className="gap-1 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Devolver
          </TabsTrigger>
          <TabsTrigger value="scanner" className="gap-1 text-xs">
            <ScanLine className="h-3.5 w-3.5" /> Scanner
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1 text-xs">
            <Search className="h-3.5 w-3.5" /> Buscar
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-1 text-xs">
            <Upload className="h-3.5 w-3.5" /> Lote
          </TabsTrigger>
        </TabsList>

        {/* Associate Tab - Link serials to products on stock entry */}
        <TabsContent value="associate" className="space-y-4">
          <AssignSerialsToProduct />
        </TabsContent>

        {/* Separation Tab - Scan to validate order */}
        <TabsContent value="separation" className="space-y-4">
          {!saleData ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Conferência de Separação
                </CardTitle>
                <CardDescription>
                  Digite o número da venda para iniciar a conferência
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Número da venda (ex: 12500)..."
                    value={saleIdInput}
                    onChange={e => setSaleIdInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadSale()}
                  />
                  <Button onClick={loadSale} disabled={loadingSale}>
                    {loadingSale ? 'Carregando...' : 'Carregar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Venda #{saleData.sale_number}</h3>
                  {saleData.client_name && (
                    <p className="text-sm text-muted-foreground">{saleData.client_name}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSaleData(null); setSaleItems([]); }}>
                  Trocar Venda
                </Button>
              </div>
              <SaleScanValidation
                saleId={saleData.id}
                saleNumber={saleData.sale_number}
                saleItems={saleItems}
                mode="separation"
                onComplete={() => {
                  toast.success('Separação finalizada!');
                  setSaleData(null);
                  setSaleItems([]);
                }}
              />
            </>
          )}
        </TabsContent>

        {/* Return Tab */}
        <TabsContent value="return" className="space-y-4">
          <ReturnScanPanel />
        </TabsContent>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Consultar Etiqueta</CardTitle>
              <CardDescription>Aponte a câmera ou digite o código para consultar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <QRScanner
                onScan={handleScan}
                scanning={scanning && activeTab === 'scanner'}
              />

              {!scanning && (
                <Button className="w-full" onClick={() => setScanning(true)}>
                  <ScanLine className="h-4 w-4 mr-2" /> Iniciar Scanner
                </Button>
              )}
              {scanning && (
                <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
                  Parar Scanner
                </Button>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Ou digite o código manualmente..."
                  value={scannedCode}
                  onChange={e => setScannedCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && lookupCode(scannedCode)}
                />
                <Button variant="outline" onClick={() => lookupCode(scannedCode)} disabled={scanLoading}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {scannedLabel && (
                <Card className="border-primary">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-lg">{scannedLabel.serial_code}</span>
                      <Badge variant={STATUS_LABELS[scannedLabel.status]?.variant || 'outline'}>
                        {STATUS_LABELS[scannedLabel.status]?.label || scannedLabel.status}
                      </Badge>
                    </div>
                    {(scannedLabel.lead_products?.name || scannedLabel.product_name) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{scannedLabel.lead_products?.name || scannedLabel.product_name}</span>
                      </div>
                    )}
                    {scannedLabel.sale_id && (
                      <a
                        href={`/vendas/${scannedLabel.sale_id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Ver venda vinculada →
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {scannedCode && !scannedLabel && !scanLoading && (
                <p className="text-sm text-muted-foreground text-center">
                  Código <strong>{scannedCode}</strong> não encontrado no sistema
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Buscar Etiquetas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Código da etiqueta (ex: VIDA10001)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searchLoading}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {searchResults.map(label => (
                    <div key={label.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-mono font-semibold">{label.serial_code}</span>
                        {label.lead_products?.name && (
                          <span className="text-sm text-muted-foreground ml-2">
                            — {label.lead_products.name}
                          </span>
                        )}
                      </div>
                      <Badge variant={STATUS_LABELS[label.status]?.variant || 'outline'}>
                        {STATUS_LABELS[label.status]?.label || label.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Register Tab */}
        <TabsContent value="register" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registrar Lote de Etiquetas</CardTitle>
              <CardDescription>
                Cadastre um lote de etiquetas no sistema para poder rastrear
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Prefixo</Label>
                  <Input value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value.toUpperCase())} maxLength={4} />
                </div>
                <div>
                  <Label>Início</Label>
                  <Input type="number" value={bulkStart} onChange={e => setBulkStart(Number(e.target.value))} min={1} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="number" value={bulkEnd} onChange={e => setBulkEnd(Number(e.target.value))} min={1} />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                Serão registradas <strong>{Math.max(0, bulkEnd - bulkStart + 1).toLocaleString()}</strong> etiquetas:
                {' '}<span className="font-mono">{bulkPrefix}{String(bulkStart).padStart(5, '0')}</span>
                {' '}até{' '}
                <span className="font-mono">{bulkPrefix}{String(bulkEnd).padStart(5, '0')}</span>
              </div>

              <Button
                className="w-full"
                onClick={handleBulkRegister}
                disabled={bulkLoading || !currentOrganizationId}
              >
                {bulkLoading ? 'Registrando...' : `Registrar ${Math.max(0, bulkEnd - bulkStart + 1).toLocaleString()} Etiquetas`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

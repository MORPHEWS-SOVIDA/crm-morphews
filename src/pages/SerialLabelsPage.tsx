import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QRScanner } from '@/components/serial-labels/QRScanner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { QrCode, Package, Search, ScanLine, Upload } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('scanner');
  
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
  const [bulkPrefix, setBulkPrefix] = useState('ATMC');
  const [bulkStart, setBulkStart] = useState(1);
  const [bulkEnd, setBulkEnd] = useState(5000);
  const [bulkLoading, setBulkLoading] = useState(false);

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
    // Vibrate on scan for feedback
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scanner" className="gap-1">
            <ScanLine className="h-4 w-4" /> Scanner
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1">
            <Search className="h-4 w-4" /> Buscar
          </TabsTrigger>
          <TabsTrigger value="register" className="gap-1">
            <Upload className="h-4 w-4" /> Registrar Lote
          </TabsTrigger>
        </TabsList>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Escanear Etiqueta</CardTitle>
              <CardDescription>Aponte a câmera para o QR Code da etiqueta</CardDescription>
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

              {/* Manual input */}
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

              {/* Result */}
              {scannedLabel && (
                <Card className="border-primary">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-lg">{scannedLabel.serial_code}</span>
                      <Badge variant={STATUS_LABELS[scannedLabel.status]?.variant || 'outline'}>
                        {STATUS_LABELS[scannedLabel.status]?.label || scannedLabel.status}
                      </Badge>
                    </div>
                    {scannedLabel.lead_products?.name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{scannedLabel.lead_products.name}</span>
                      </div>
                    )}
                    {scannedLabel.product_name && !scannedLabel.lead_products?.name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{scannedLabel.product_name}</span>
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
                  placeholder="Código da etiqueta (ex: ATMC00123)..."
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

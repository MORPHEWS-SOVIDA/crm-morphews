import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QRScanner } from '@/components/serial-labels/QRScanner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { ArrowLeft, ScanLine, Search, Package } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Disponível', variant: 'outline' },
  in_stock: { label: 'Em Estoque', variant: 'default' },
  assigned: { label: 'Atribuído', variant: 'secondary' },
  shipped: { label: 'Enviado', variant: 'secondary' },
  delivered: { label: 'Entregue', variant: 'default' },
  returned: { label: 'Devolvido', variant: 'destructive' },
};

export default function SerialScannerPage() {
  const { data: orgId } = useCurrentTenantId();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const lookupCode = async (c: string) => {
    if (!c || !orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('*, lead_products:product_id(name)')
        .eq('organization_id', orgId)
        .eq('serial_code', c.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setLabel(data);
        setCode(c);
        toast.success(`Etiqueta encontrada: ${c}`);
      } else {
        setLabel(null);
        setCode(c);
        toast.info(`Etiqueta ${c} não registrada no sistema`);
      }
    } catch {
      toast.error('Erro ao buscar etiqueta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <ScanLine className="h-5 w-5 text-orange-600" />
        <h1 className="text-xl font-bold">Scanner / Consulta</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consultar Etiqueta</CardTitle>
          <CardDescription>Aponte a câmera ou digite o código para consultar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <QRScanner
            onScan={(c) => { lookupCode(c); if (navigator.vibrate) navigator.vibrate(100); }}
            scanning={scanning}
          />

          {!scanning ? (
            <Button className="w-full" onClick={() => setScanning(true)}>
              <ScanLine className="h-4 w-4 mr-2" /> Iniciar Scanner
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
              Parar Scanner
            </Button>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Ou digite o código manualmente..."
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && lookupCode(code)}
            />
            <Button variant="outline" onClick={() => lookupCode(code)} disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {label && (
            <Card className="border-primary">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-lg">{label.serial_code}</span>
                  <Badge variant={STATUS_LABELS[label.status]?.variant || 'outline'}>
                    {STATUS_LABELS[label.status]?.label || label.status}
                  </Badge>
                </div>
                {(label.lead_products?.name || label.product_name) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{label.lead_products?.name || label.product_name}</span>
                  </div>
                )}
                {label.sale_id && (
                  <a href={`/vendas/${label.sale_id}`} className="text-sm text-primary hover:underline">
                    Ver venda vinculada →
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {code && !label && !loading && (
            <p className="text-sm text-muted-foreground text-center">
              Código <strong>{code}</strong> não encontrado no sistema
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

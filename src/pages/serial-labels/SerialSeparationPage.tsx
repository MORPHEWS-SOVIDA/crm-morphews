import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SaleScanValidation } from '@/components/serial-labels/SaleScanValidation';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useToggleSaleCheckpoint } from '@/hooks/useSaleCheckpoints';
import { toast } from 'sonner';
import { ArrowLeft, ClipboardList } from 'lucide-react';

export default function SerialSeparationPage() {
  const { data: orgId } = useCurrentTenantId();
  const toggleCheckpoint = useToggleSaleCheckpoint();
  const [saleIdInput, setSaleIdInput] = useState('');
  const [saleData, setSaleData] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSale = async () => {
    if (!saleIdInput || !orgId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('sales')
        .select('id, romaneio_number, lead_id')
        .eq('organization_id', orgId);

      if (/^\d+$/.test(saleIdInput.trim())) {
        query = query.eq('romaneio_number', parseInt(saleIdInput.trim()));
      } else {
        query = query.eq('id', saleIdInput.trim());
      }

      const { data: sale, error } = await query.maybeSingle();
      if (error) throw error;
      if (!sale) {
        toast.error('Venda não encontrada');
        setLoading(false);
        return;
      }

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
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <ClipboardList className="h-5 w-5 text-blue-600" />
        <h1 className="text-xl font-bold">Separação de Pedido</h1>
      </div>

      {!saleData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conferência de Separação</CardTitle>
            <CardDescription>Digite o número da venda para iniciar a conferência</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Número da venda (ex: 12500)..."
                value={saleIdInput}
                onChange={e => setSaleIdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadSale()}
              />
              <Button onClick={loadSale} disabled={loading}>
                {loading ? 'Carregando...' : 'Carregar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Venda #{saleData.romaneio_number}</h3>
            <Button variant="outline" size="sm" onClick={() => { setSaleData(null); setSaleItems([]); }}>
              Trocar Venda
            </Button>
          </div>
          <SaleScanValidation
            saleId={saleData.id}
            saleNumber={saleData.romaneio_number}
            saleItems={saleItems}
            mode="separation"
            onComplete={async () => {
              // Auto-mark pending_expedition checkpoint
              try {
                await toggleCheckpoint.mutateAsync({
                  saleId: saleData.id,
                  checkpointType: 'pending_expedition',
                  complete: true,
                  notes: 'Validado via scan de etiquetas seriais (separação mobile)',
                });
                toast.success('✅ Separação finalizada e pedido marcado como SEPARADO!');
              } catch {
                toast.success('Separação finalizada!');
                toast.error('Erro ao marcar como separado automaticamente');
              }
              setSaleData(null);
              setSaleItems([]);
            }}
          />
        </>
      )}
    </div>
  );
}

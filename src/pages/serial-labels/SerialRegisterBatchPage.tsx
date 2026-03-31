import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { ArrowLeft, Upload } from 'lucide-react';

export default function SerialRegisterBatchPage() {
  const { data: orgId } = useCurrentTenantId();
  const [prefix, setPrefix] = useState('VIDA');
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(5000);
  const [loading, setLoading] = useState(false);

  const quantity = Math.max(0, end - start + 1);

  const handleRegister = async () => {
    if (!orgId) return;
    if (quantity > 10000) {
      toast.error('Máximo de 10.000 etiquetas por lote');
      return;
    }

    setLoading(true);
    try {
      const batchLabel = `${prefix}${String(start).padStart(5, '0')}-${prefix}${String(end).padStart(5, '0')}`;
      const BATCH_SIZE = 500;
      let totalInserted = 0;

      for (let i = start; i <= end; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE - 1, end);
        const rows = [];
        for (let j = i; j <= batchEnd; j++) {
          rows.push({
            organization_id: orgId,
            serial_code: `${prefix}${String(j).padStart(5, '0')}`,
            status: 'available' as const,
            batch_label: batchLabel,
          });
        }

        const { error } = await supabase
          .from('product_serial_labels')
          .upsert(rows, { onConflict: 'organization_id,serial_code', ignoreDuplicates: true });

        if (error) throw error;
        totalInserted += rows.length;
        toast.info(`Registrando... ${totalInserted}/${quantity}`);
      }

      toast.success(`${totalInserted} etiquetas registradas com sucesso!`);
    } catch (err: any) {
      toast.error(`Erro ao registrar: ${err.message}`);
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
        <Upload className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Registrar Lote de Etiquetas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cadastrar Lote</CardTitle>
          <CardDescription>Cadastre um lote de etiquetas no sistema para poder rastrear</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Prefixo</Label>
              <Input value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} maxLength={4} />
            </div>
            <div>
              <Label>Início</Label>
              <Input type="number" value={start} onChange={e => setStart(Number(e.target.value))} min={1} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="number" value={end} onChange={e => setEnd(Number(e.target.value))} min={1} />
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Serão registradas <strong>{quantity.toLocaleString()}</strong> etiquetas:{' '}
            <span className="font-mono">{prefix}{String(start).padStart(5, '0')}</span> até{' '}
            <span className="font-mono">{prefix}{String(end).padStart(5, '0')}</span>
          </div>

          <Button className="w-full" onClick={handleRegister} disabled={loading || !orgId}>
            {loading ? 'Registrando...' : `Registrar ${quantity.toLocaleString()} Etiquetas`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

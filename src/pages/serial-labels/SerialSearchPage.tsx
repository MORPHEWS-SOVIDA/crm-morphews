import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { ArrowLeft, Search } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  available: { label: 'Disponível', variant: 'outline' },
  in_stock: { label: 'Em Estoque', variant: 'default' },
  assigned: { label: 'Atribuído', variant: 'secondary' },
  shipped: { label: 'Enviado', variant: 'secondary' },
  delivered: { label: 'Entregue', variant: 'default' },
  returned: { label: 'Devolvido', variant: 'destructive' },
};

export default function SerialSearchPage() {
  const { data: orgId } = useCurrentTenantId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query || !orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('*, lead_products:product_id(name)')
        .eq('organization_id', orgId)
        .ilike('serial_code', `%${query.trim()}%`)
        .order('serial_code')
        .limit(50);

      if (error) throw error;
      setResults(data || []);
      if (!data?.length) toast.info('Nenhuma etiqueta encontrada');
    } catch {
      toast.error('Erro na busca');
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
        <Search className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold">Buscar Etiquetas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pesquisar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Código da etiqueta (ex: VIDA10001)..."
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {results.map(label => (
                <div key={label.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-mono font-semibold">{label.serial_code}</span>
                    {label.lead_products?.name && (
                      <span className="text-sm text-muted-foreground ml-2">— {label.lead_products.name}</span>
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
    </div>
  );
}

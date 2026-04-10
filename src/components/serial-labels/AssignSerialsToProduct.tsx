import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { useAssignSerialsToProduct } from '@/hooks/useSerialLabels';
import { useCreateStockMovement } from '@/hooks/useStock';
import { useAuth } from '@/hooks/useAuth';
import { logSerialAction } from '@/hooks/useSerialLabelLogs';
import { Package, Tag, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function AssignSerialsToProduct() {
  const { data: orgId } = useCurrentTenantId();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [prefix, setPrefix] = useState('VIDA');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [lastResult, setLastResult] = useState<{ count: number; product: string } | null>(null);

  const { user } = useAuth();
  const assignMutation = useAssignSerialsToProduct();
  const stockMutation = useCreateStockMovement();

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
  const quantity = end >= start ? end - start + 1 : 0;

  const handleAssign = async () => {
    if (!selectedProductId || !selectedProduct || start <= 0 || end <= 0 || end < start) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    if (quantity > 5000) {
      toast.error('Máximo de 5.000 etiquetas por associação');
      return;
    }

    try {
      const batchLabel = `${prefix}${String(start).padStart(5, '0')} → ${prefix}${String(end).padStart(5, '0')}`;
      
      // 1. Assign serial labels to product
      await assignMutation.mutateAsync({
        productId: selectedProductId,
        productName: selectedProduct.name,
        serialStart: start,
        serialEnd: end,
        prefix,
      });

      // 2. Create stock entry movement
      await stockMutation.mutateAsync({
        product_id: selectedProductId,
        movement_type: 'entry',
        quantity,
        notes: `Entrada via serialização: ${prefix}${String(start).padStart(5, '0')} a ${prefix}${String(end).padStart(5, '0')}`,
      });

      // 3. Log success
      if (orgId) {
        logSerialAction({
          organization_id: orgId,
          action: 'assign_product',
          user_id: user?.id,
          success: true,
          details: {
            product_id: selectedProductId,
            product_name: selectedProduct.name,
            prefix,
            range_start: start,
            range_end: end,
            count: quantity,
            batch_label: batchLabel,
          },
        });
      }

      setLastResult({ count: quantity, product: selectedProduct.name });
      setRangeStart('');
      setRangeEnd('');
    } catch (err: any) {
      // Log error
      if (orgId) {
        logSerialAction({
          organization_id: orgId,
          action: 'assign_product',
          user_id: user?.id,
          success: false,
          error_message: err?.message || 'Erro ao associar etiquetas',
          details: {
            product_id: selectedProductId,
            prefix,
            range_start: start,
            range_end: end,
            count: quantity,
          },
        });
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Associar Etiquetas ao Produto
        </CardTitle>
        <CardDescription>
          Vincule uma faixa de etiquetas a um produto e registre a entrada no estoque
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product selector */}
        <div>
          <Label>Produto</Label>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o produto..." />
            </SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Serial range */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Prefixo</Label>
            <Input 
              value={prefix} 
              onChange={e => setPrefix(e.target.value.toUpperCase())} 
              maxLength={4}
              placeholder="VIDA"
            />
          </div>
          <div>
            <Label>De (número)</Label>
            <Input 
              type="number" 
              value={rangeStart} 
              onChange={e => setRangeStart(e.target.value)}
              placeholder="10001"
              min={1}
            />
          </div>
          <div>
            <Label>Até (número)</Label>
            <Input 
              type="number" 
              value={rangeEnd} 
              onChange={e => setRangeEnd(e.target.value)}
              placeholder="10200"
              min={1}
            />
          </div>
        </div>

        {/* Preview */}
        {quantity > 0 && selectedProduct && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Tag className="h-4 w-4 text-primary" />
              <span className="font-mono">{prefix}{String(start).padStart(5, '0')}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono">{prefix}{String(end).padStart(5, '0')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{quantity.toLocaleString()}</strong> etiquetas → <strong>{selectedProduct.name}</strong>
            </p>
          </div>
        )}

        <Button 
          className="w-full" 
          onClick={handleAssign}
          disabled={assignMutation.isPending || stockMutation.isPending || !selectedProductId || quantity <= 0}
        >
          {assignMutation.isPending || stockMutation.isPending 
            ? 'Associando...' 
            : `Associar ${quantity > 0 ? quantity.toLocaleString() : 0} Etiquetas e Dar Entrada`
          }
        </Button>

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

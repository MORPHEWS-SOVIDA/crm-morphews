import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Package, ScanLine } from 'lucide-react';

export interface PendingProductOption {
  product_id: string;
  product_name: string;
  sale_item_id: string;
  pending: number;
}

interface LinkAvailableSerialDialogProps {
  open: boolean;
  serialCode: string;
  pendingProducts: PendingProductOption[];
  onCancel: () => void;
  onConfirm: (input: {
    productId: string;
    saleItemId: string;
    productName: string;
    lote: string;
    validade: string;
  }) => Promise<void> | void;
}

export function LinkAvailableSerialDialog({
  open,
  serialCode,
  pendingProducts,
  onCancel,
  onConfirm,
}: LinkAvailableSerialDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [lote, setLote] = useState('');
  const [validade, setValidade] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  // Pré-seleciona o primeiro quando abre
  useEffect(() => {
    if (open && pendingProducts.length > 0 && !selectedProductId) {
      setSelectedProductId(pendingProducts[0].product_id);
    }
    if (!open) {
      setSelectedProductId('');
      setLote('');
      setValidade('');
    }
  }, [open, pendingProducts]);

  // Auto-busca último lote/validade quando produto muda
  useEffect(() => {
    if (!selectedProductId) return;
    let cancelled = false;
    setLoadingDefaults(true);
    supabase
      .rpc('get_last_lote_validade_for_product', { p_product_id: selectedProductId })
      .then(({ data }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : null;
        setLote(row?.lote ?? '');
        setValidade(row?.validade ?? '');
      })
      .finally(() => !cancelled && setLoadingDefaults(false));
    return () => {
      cancelled = true;
    };
  }, [selectedProductId]);

  const selected = pendingProducts.find((p) => p.product_id === selectedProductId);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onConfirm({
        productId: selected.product_id,
        saleItemId: selected.sale_item_id,
        productName: selected.product_name,
        lote: lote.trim(),
        validade: validade.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Vincular etiqueta ao produto
          </DialogTitle>
          <DialogDescription>
            A etiqueta <span className="font-mono font-semibold">{serialCode}</span> ainda não tem
            produto. Escolha qual produto deste pedido você está colando ela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">
              Produtos pendentes neste pedido
            </Label>
            <RadioGroup value={selectedProductId} onValueChange={setSelectedProductId}>
              {pendingProducts.map((p) => (
                <label
                  key={p.product_id}
                  htmlFor={`prod-${p.product_id}`}
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <RadioGroupItem value={p.product_id} id={`prod-${p.product_id}`} />
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{p.product_name}</span>
                  <span className="text-xs text-muted-foreground">
                    faltam {p.pending}
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lote" className="text-xs">
                Lote {loadingDefaults && <Loader2 className="inline h-3 w-3 animate-spin" />}
              </Label>
              <Input
                id="lote"
                placeholder="Ex: A025"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validade" className="text-xs">
                Validade
              </Label>
              <Input
                id="validade"
                placeholder="MM/AAAA"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          {(lote || validade) && (
            <p className="text-xs text-muted-foreground">
              Pré-preenchido com o último lote/validade usado para este produto. Você pode alterar.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Vinculando...
              </>
            ) : (
              <>Vincular e bipar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

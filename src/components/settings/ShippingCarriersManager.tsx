import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Loader2, Truck, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  useShippingCarriers,
  useCreateShippingCarrier,
  useUpdateShippingCarrier,
  useDeleteShippingCarrier,
  ShippingCarrier,
} from '@/hooks/useDeliveryConfig';
import { formatCurrency } from '@/hooks/useSales';
import { CORREIOS_SERVICES } from '@/hooks/useShippingQuote';

export function ShippingCarriersManager() {
  const { data: carriers = [], isLoading } = useShippingCarriers();
  const createCarrier = useCreateShippingCarrier();
  const updateCarrier = useUpdateShippingCarrier();
  const deleteCarrier = useDeleteShippingCarrier();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<ShippingCarrier | null>(null);
  const [name, setName] = useState('');
  const [costCents, setCostCents] = useState(0);
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [correiosServiceCode, setCorreiosServiceCode] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingCarrier(null);
    setName('');
    setCostCents(0);
    setEstimatedDays(1);
    setCorreiosServiceCode(null);
    setDialogOpen(true);
  };

  const openEditDialog = (carrier: ShippingCarrier) => {
    setEditingCarrier(carrier);
    setName(carrier.name);
    setCostCents(carrier.cost_cents);
    setEstimatedDays(carrier.estimated_days);
    setCorreiosServiceCode(carrier.correios_service_code);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    if (editingCarrier) {
      await updateCarrier.mutateAsync({
        id: editingCarrier.id,
        name: name.trim(),
        cost_cents: costCents,
        estimated_days: estimatedDays,
        correios_service_code: correiosServiceCode,
      });
    } else {
      await createCarrier.mutateAsync({
        name: name.trim(),
        cost_cents: costCents,
        estimated_days: estimatedDays,
        correios_service_code: correiosServiceCode,
      });
    }

    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover esta transportadora?')) {
      await deleteCarrier.mutateAsync(id);
    }
  };

  const handleToggleActive = async (carrier: ShippingCarrier) => {
    await updateCarrier.mutateAsync({
      id: carrier.id,
      is_active: !carrier.is_active,
    });
  };

  const getCorreiosServiceName = (code: string | null) => {
    if (!code) return null;
    const service = CORREIOS_SERVICES.find(s => s.code === code);
    return service?.name || code;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure as transportadoras disponíveis
        </p>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Transportadora
        </Button>
      </div>

      {carriers.length === 0 ? (
        <div className="text-center p-8 border rounded-lg border-dashed">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma transportadora cadastrada</p>
          <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar primeira transportadora
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Serviço Correios</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium">{carrier.name}</TableCell>
                  <TableCell>
                    {carrier.correios_service_code ? (
                      <Badge variant="outline" className="gap-1">
                        <Package className="w-3 h-3" />
                        {getCorreiosServiceName(carrier.correios_service_code)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(carrier.cost_cents)}</TableCell>
                  <TableCell>
                    {carrier.estimated_days} dia{carrier.estimated_days !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={carrier.is_active ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(carrier)}
                    >
                      {carrier.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(carrier)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(carrier.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCarrier ? 'Editar Transportadora' : 'Nova Transportadora'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: SEDEX, PAC, Jadlog..."
                className="mt-1"
              />
            </div>

            <div>
              <Label>Serviço Correios (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Vincule a um serviço para pré-selecionar ao gerar etiquetas
              </p>
              <Select
                value={correiosServiceCode || 'none'}
                onValueChange={(value) => setCorreiosServiceCode(value === 'none' ? null : value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Nenhum vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum vínculo</SelectItem>
                  {CORREIOS_SERVICES.map((service) => (
                    <SelectItem key={service.code} value={service.code}>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span>{service.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Custo de Envio</Label>
              <CurrencyInput
                value={costCents}
                onChange={setCostCents}
                placeholder="Custo padrão"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Prazo de Entrega (dias)</Label>
              <Input
                type="number"
                min={1}
                value={estimatedDays}
                onChange={(e) => setEstimatedDays(parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!name.trim() || createCarrier.isPending || updateCarrier.isPending}
            >
              {(createCarrier.isPending || updateCarrier.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingCarrier ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

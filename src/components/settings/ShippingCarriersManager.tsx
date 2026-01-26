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
  DialogDescription,
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
import { Plus, Pencil, Trash2, Loader2, Truck, Package, Zap, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  useShippingCarriers,
  useCreateShippingCarrier,
  useUpdateShippingCarrier,
  useDeleteShippingCarrier,
  ShippingCarrier,
} from '@/hooks/useDeliveryConfig';
import { formatCurrency } from '@/hooks/useSales';
import { MELHOR_ENVIO_SERVICES } from '@/hooks/useShippingQuote';
import { useMelhorEnvioConfig } from '@/hooks/useMelhorEnvio';

export function ShippingCarriersManager() {
  const { data: carriers = [], isLoading } = useShippingCarriers();
  const { data: melhorEnvioConfig } = useMelhorEnvioConfig();
  const createCarrier = useCreateShippingCarrier();
  const updateCarrier = useUpdateShippingCarrier();
  const deleteCarrier = useDeleteShippingCarrier();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<ShippingCarrier | null>(null);
  const [name, setName] = useState('');
  const [costCents, setCostCents] = useState(0);
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [melhorEnvioServiceId, setMelhorEnvioServiceId] = useState<number | null>(null);
  const [isIntegrated, setIsIntegrated] = useState(false);

  const isMelhorEnvioActive = melhorEnvioConfig?.is_active;

  const openCreateDialog = () => {
    setEditingCarrier(null);
    setName('');
    setCostCents(0);
    setEstimatedDays(1);
    setMelhorEnvioServiceId(null);
    setIsIntegrated(false);
    setDialogOpen(true);
  };

  const openEditDialog = (carrier: ShippingCarrier) => {
    setEditingCarrier(carrier);
    setName(carrier.name);
    setCostCents(carrier.cost_cents);
    setEstimatedDays(carrier.estimated_days);
    // Check if it has a Melhor Envio service linked
    const serviceId = carrier.correios_service_code ? parseInt(carrier.correios_service_code) : null;
    setMelhorEnvioServiceId(serviceId);
    setIsIntegrated(!!serviceId);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const serviceCode = isIntegrated && melhorEnvioServiceId ? String(melhorEnvioServiceId) : null;

    if (editingCarrier) {
      await updateCarrier.mutateAsync({
        id: editingCarrier.id,
        name: name.trim(),
        cost_cents: isIntegrated ? 0 : costCents, // Integrated carriers use API pricing
        estimated_days: isIntegrated ? 0 : estimatedDays, // Integrated carriers use API timing
        correios_service_code: serviceCode,
      });
    } else {
      await createCarrier.mutateAsync({
        name: name.trim(),
        cost_cents: isIntegrated ? 0 : costCents,
        estimated_days: isIntegrated ? 0 : estimatedDays,
        correios_service_code: serviceCode,
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

  const getServiceInfo = (code: string | null) => {
    if (!code) return null;
    const serviceId = parseInt(code);
    return MELHOR_ENVIO_SERVICES.find(s => s.id === serviceId);
  };

  const isCarrierIntegrated = (carrier: ShippingCarrier) => {
    return !!carrier.correios_service_code;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const integratedCarriers = carriers.filter(isCarrierIntegrated);
  const manualCarriers = carriers.filter(c => !isCarrierIntegrated(c));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Configure as transportadoras disponíveis para vendas
          </p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Transportadora
        </Button>
      </div>

      {!isMelhorEnvioActive && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Melhor Envio não configurado.</strong> Para usar transportadoras integradas com geração automática de etiquetas, 
            configure o Melhor Envio em Configurações → Entregas.
          </AlertDescription>
        </Alert>
      )}

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
        <div className="space-y-6">
          {/* Integrated Carriers Section */}
          {integratedCarriers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                <h4 className="font-medium text-sm">Transportadoras Integradas</h4>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  Etiqueta Automática
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao selecionar, o sistema busca preço e prazo em tempo real. A etiqueta é gerada automaticamente ao salvar a venda.
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Serviço Melhor Envio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {integratedCarriers.map((carrier) => {
                      const service = getServiceInfo(carrier.correios_service_code);
                      return (
                        <TableRow key={carrier.id}>
                          <TableCell className="font-medium">{carrier.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
                              <Package className="w-3 h-3" />
                              {service ? `${service.company} - ${service.name}` : carrier.correios_service_code}
                            </Badge>
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Manual Carriers Section */}
          {manualCarriers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Transportadoras Manuais</h4>
                <Badge variant="outline" className="text-xs">
                  Sem Integração
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Usam preço e prazo fixos. O vendedor deve gerar a etiqueta manualmente fora do sistema.
              </p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Custo Fixo</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualCarriers.map((carrier) => (
                      <TableRow key={carrier.id}>
                        <TableCell className="font-medium">{carrier.name}</TableCell>
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
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCarrier ? 'Editar Transportadora' : 'Nova Transportadora'}
            </DialogTitle>
            <DialogDescription>
              {isIntegrated 
                ? 'Transportadora integrada: preço e prazo são buscados automaticamente da API do Melhor Envio.'
                : 'Transportadora manual: você define preço e prazo fixos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nome *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: PAC Econômico, SEDEX Expresso..."
                className="mt-1"
              />
            </div>

            {/* Integration Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="font-medium">Integrar com Melhor Envio</Label>
                <p className="text-xs text-muted-foreground">
                  {isIntegrated 
                    ? 'Etiqueta será gerada automaticamente ao salvar a venda'
                    : 'Transportadora manual sem geração de etiqueta'}
                </p>
              </div>
              <Switch
                checked={isIntegrated}
                onCheckedChange={(checked) => {
                  setIsIntegrated(checked);
                  if (!checked) setMelhorEnvioServiceId(null);
                }}
                disabled={!isMelhorEnvioActive}
              />
            </div>

            {isIntegrated ? (
              /* Integrated: Select Melhor Envio Service */
              <div>
                <Label>Serviço Melhor Envio *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Selecione o serviço que será usado para gerar etiquetas
                </p>
                <Select
                  value={melhorEnvioServiceId ? String(melhorEnvioServiceId) : ''}
                  onValueChange={(value) => setMelhorEnvioServiceId(parseInt(value))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {MELHOR_ENVIO_SERVICES.map((service) => (
                      <SelectItem key={service.id} value={String(service.id)}>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-green-600" />
                          <span>{service.company} - {service.name}</span>
                          <span className="text-xs text-muted-foreground">({service.description})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              /* Manual: Cost and Days */
              <>
                <div>
                  <Label>Custo de Envio (fixo)</Label>
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
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={
                !name.trim() || 
                (isIntegrated && !melhorEnvioServiceId) ||
                createCarrier.isPending || 
                updateCarrier.isPending
              }
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

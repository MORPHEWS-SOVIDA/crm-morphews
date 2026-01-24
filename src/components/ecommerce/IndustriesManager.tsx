import { useState } from 'react';
import { Plus, Factory, Trash2, Pencil, Building2, Phone, Mail, Banknote, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIndustries, useCreateIndustry, useUpdateIndustry, useDeleteIndustry, type Industry } from '@/hooks/ecommerce/useIndustries';

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

export function IndustriesManager() {
  const { data: industries, isLoading } = useIndustries();
  const createIndustry = useCreateIndustry();
  const updateIndustry = useUpdateIndustry();
  const deleteIndustry = useDeleteIndustry();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    document: '',
    email: '',
    phone: '',
    bank_name: '',
    bank_agency: '',
    bank_account: '',
    bank_account_type: 'corrente',
    pix_key: '',
    is_active: true,
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      legal_name: '',
      document: '',
      email: '',
      phone: '',
      bank_name: '',
      bank_agency: '',
      bank_account: '',
      bank_account_type: 'corrente',
      pix_key: '',
      is_active: true,
      notes: '',
    });
    setEditingIndustry(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (industry: Industry) => {
    setEditingIndustry(industry);
    setFormData({
      name: industry.name,
      legal_name: industry.legal_name || '',
      document: industry.document || '',
      email: industry.email || '',
      phone: industry.phone || '',
      bank_name: industry.bank_name || '',
      bank_agency: industry.bank_agency || '',
      bank_account: industry.bank_account || '',
      bank_account_type: industry.bank_account_type || 'corrente',
      pix_key: industry.pix_key || '',
      is_active: industry.is_active,
      notes: industry.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingIndustry) {
        await updateIndustry.mutateAsync({
          id: editingIndustry.id,
          ...formData,
        });
        toast.success('Indústria atualizada!');
      } else {
        await createIndustry.mutateAsync(formData);
        toast.success('Indústria cadastrada!');
      }
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar indústria');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteIndustry.mutateAsync(deleteId);
      toast.success('Indústria removida!');
      setDeleteId(null);
    } catch (error) {
      toast.error('Erro ao remover indústria');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Indústrias / Fornecedores
          </h2>
          <p className="text-sm text-muted-foreground">
            Cadastre indústrias que recebem valor fixo por produto vendido
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Indústria
        </Button>
      </div>

      {industries?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Factory className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma indústria cadastrada</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Cadastre indústrias/fornecedores que receberão valores fixos por produto vendido
            </p>
            <Button onClick={handleOpenCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Indústria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {industries?.map((industry) => (
            <Card key={industry.id} className={!industry.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{industry.name}</CardTitle>
                  </div>
                  <Badge variant={industry.is_active ? 'default' : 'secondary'}>
                    {industry.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                {industry.legal_name && (
                  <CardDescription className="text-xs">
                    {industry.legal_name}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {industry.document && (
                  <div className="text-xs text-muted-foreground">
                    CNPJ: {industry.document}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  {industry.email && (
                    <Badge variant="outline" className="gap-1">
                      <Mail className="h-3 w-3" />
                      {industry.email}
                    </Badge>
                  )}
                  {industry.phone && (
                    <Badge variant="outline" className="gap-1">
                      <Phone className="h-3 w-3" />
                      {industry.phone}
                    </Badge>
                  )}
                </div>

                {(industry.bank_name || industry.pix_key) && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Banknote className="h-3 w-3" />
                      Dados Bancários
                    </div>
                    {industry.bank_name && (
                      <div className="text-xs">
                        {industry.bank_name} | Ag: {industry.bank_agency} | CC: {industry.bank_account}
                      </div>
                    )}
                    {industry.pix_key && (
                      <div className="text-xs text-muted-foreground">
                        PIX: {industry.pix_key}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => handleOpenEdit(industry)}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(industry.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              {editingIndustry ? 'Editar Indústria' : 'Nova Indústria'}
            </DialogTitle>
            <DialogDescription>
              Cadastre fornecedores que recebem valor fixo por unidade vendida dos produtos
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Dados Básicos */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Fantasia *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome da indústria"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_name">Razão Social</Label>
                <Input
                  id="legal_name"
                  value={formData.legal_name}
                  onChange={(e) => setFormData((p) => ({ ...p, legal_name: e.target.value }))}
                  placeholder="Razão social"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="document">CNPJ</Label>
                <Input
                  id="document"
                  value={formData.document}
                  onChange={(e) => setFormData((p) => ({ ...p, document: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contato@industria.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Dados Bancários */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Dados Bancários
              </h4>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Banco</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData((p) => ({ ...p, bank_name: e.target.value }))}
                    placeholder="Nome do banco"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_agency">Agência</Label>
                  <Input
                    id="bank_agency"
                    value={formData.bank_agency}
                    onChange={(e) => setFormData((p) => ({ ...p, bank_agency: e.target.value }))}
                    placeholder="0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account">Conta</Label>
                  <Input
                    id="bank_account"
                    value={formData.bank_account}
                    onChange={(e) => setFormData((p) => ({ ...p, bank_account: e.target.value }))}
                    placeholder="00000-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_type">Tipo</Label>
                  <Select
                    value={formData.bank_account_type}
                    onValueChange={(v) => setFormData((p) => ({ ...p, bank_account_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <Label htmlFor="pix_key">Chave PIX</Label>
                <Input
                  id="pix_key"
                  value={formData.pix_key}
                  onChange={(e) => setFormData((p) => ({ ...p, pix_key: e.target.value }))}
                  placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Anotações sobre esta indústria..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
              />
              <Label htmlFor="is_active">Indústria ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createIndustry.isPending || updateIndustry.isPending}
            >
              {editingIndustry ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover indústria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os custos vinculados a produtos também serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Copy, Link2, Trash2, Users, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  usePartnerPublicLinks,
  useCreatePartnerPublicLink,
  useUpdatePartnerPublicLink,
  useDeletePartnerPublicLink,
} from '@/hooks/ecommerce/usePartnerPublicLinks';
import {
  PartnerType,
  CommissionType,
  partnerTypeLabels,
  partnerTypeColors,
  formatCommission,
} from '@/hooks/ecommerce/usePartners';

export function PublicLinksTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    partner_type: 'affiliate' as PartnerType,
    commission_type: 'percentage' as CommissionType,
    commission_value: 10,
    responsible_for_refunds: true,
    responsible_for_chargebacks: true,
    max_registrations: '',
  });

  const { data: links, isLoading } = usePartnerPublicLinks();
  const createLink = useCreatePartnerPublicLink();
  const updateLink = useUpdatePartnerPublicLink();
  const deleteLink = useDeletePartnerPublicLink();

  const handleCreate = () => {
    if (!formData.slug.trim() || !formData.name.trim()) {
      toast.error('Slug e nome são obrigatórios');
      return;
    }

    createLink.mutate({
      ...formData,
      max_registrations: formData.max_registrations ? Number(formData.max_registrations) : undefined,
    }, {
      onSuccess: () => {
        toast.success('Link criado com sucesso!');
        setCreateDialogOpen(false);
        setFormData({
          slug: '',
          name: '',
          partner_type: 'affiliate',
          commission_type: 'percentage',
          commission_value: 10,
          responsible_for_refunds: true,
          responsible_for_chargebacks: true,
          max_registrations: '',
        });
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  const handleCopyLink = (slug: string) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/convite-parceiros/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleToggleActive = (link: typeof links extends (infer T)[] ? T : never) => {
    updateLink.mutate({
      id: link.id,
      is_active: !link.is_active,
    }, {
      onSuccess: () => {
        toast.success(link.is_active ? 'Link desativado' : 'Link ativado');
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteLink.mutate(id, {
      onSuccess: () => {
        toast.success('Link excluído');
      },
    });
  };

  const showLiabilityOptions = 
    formData.partner_type === 'affiliate' || 
    formData.partner_type === 'coproducer';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Links Públicos de Cadastro</h3>
          <p className="text-sm text-muted-foreground">
            Compartilhe esses links para parceiros se cadastrarem em massa
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Link Público</DialogTitle>
              <DialogDescription>
                Parceiros que acessarem este link poderão solicitar cadastro
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Slug */}
              <div className="space-y-2">
                <Label>Identificador do Link (slug) *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/convite-parceiros/</span>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData(p => ({ 
                      ...p, 
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') 
                    }))}
                    placeholder="minha-empresa"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex: sovida, morphews, evento-2024
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label>Nome do Link *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Evento X, Campanha Y..."
                />
              </div>

              {/* Partner Type */}
              <div className="space-y-2">
                <Label>Tipo de Parceiro</Label>
                <Select
                  value={formData.partner_type}
                  onValueChange={(value: PartnerType) =>
                    setFormData((p) => ({ ...p, partner_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="affiliate">Afiliado</SelectItem>
                    <SelectItem value="coproducer">Co-produtor</SelectItem>
                    <SelectItem value="industry">Indústria</SelectItem>
                    <SelectItem value="factory">Fábrica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Commission Type */}
              <div className="space-y-3">
                <Label>Tipo de Comissão</Label>
                <RadioGroup
                  value={formData.commission_type}
                  onValueChange={(value: CommissionType) =>
                    setFormData((p) => ({ ...p, commission_type: value }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="pct" />
                    <Label htmlFor="pct" className="font-normal">Porcentagem (%)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="fix" />
                    <Label htmlFor="fix" className="font-normal">Valor Fixo (R$)</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Commission Value */}
              <div className="space-y-2">
                <Label>
                  {formData.commission_type === 'percentage' ? 'Porcentagem (%)' : 'Valor Fixo (R$)'}
                </Label>
                <Input
                  type="number"
                  value={
                    formData.commission_type === 'fixed'
                      ? formData.commission_value / 100
                      : formData.commission_value
                  }
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      commission_value:
                        formData.commission_type === 'fixed'
                          ? Number(e.target.value) * 100
                          : Number(e.target.value),
                    }))
                  }
                  min={0}
                  step={formData.commission_type === 'fixed' ? 0.01 : 1}
                />
              </div>

              {/* Max Registrations */}
              <div className="space-y-2">
                <Label>Limite de Cadastros (opcional)</Label>
                <Input
                  type="number"
                  value={formData.max_registrations}
                  onChange={(e) => setFormData(p => ({ ...p, max_registrations: e.target.value }))}
                  placeholder="Ilimitado"
                  min={1}
                />
              </div>

              {/* Liability Options */}
              {showLiabilityOptions && (
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-medium">Responsabilidade por Estornos</Label>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Responsável por Reembolsos</p>
                    </div>
                    <Switch
                      checked={formData.responsible_for_refunds}
                      onCheckedChange={(checked) =>
                        setFormData((p) => ({ ...p, responsible_for_refunds: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Responsável por Chargebacks</p>
                    </div>
                    <Switch
                      checked={formData.responsible_for_chargebacks}
                      onCheckedChange={(checked) =>
                        setFormData((p) => ({ ...p, responsible_for_chargebacks: checked }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.slug || !formData.name || createLink.isPending}
              >
                Criar Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Links List */}
      {links && links.length > 0 ? (
        <div className="grid gap-4">
          {links.map((link) => (
            <Card key={link.id} className={!link.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">{link.name}</span>
                      <Badge variant="outline" className={partnerTypeColors[link.partner_type]}>
                        {partnerTypeLabels[link.partner_type]}
                      </Badge>
                      {!link.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs">
                        /convite-parceiros/{link.slug}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopyLink(link.slug)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <a
                        href={`/convite-parceiros/${link.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Comissão: <strong>{formatCommission(link.commission_type, link.commission_value)}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {link.registrations_count} cadastros
                        {link.max_registrations && ` / ${link.max_registrations}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(link)}
                    >
                      {link.is_active ? (
                        <ToggleRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir link?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Solicitações pendentes deste link serão mantidas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(link.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Link2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">Nenhum link criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie links públicos para parceiros se cadastrarem em massa
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Link
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

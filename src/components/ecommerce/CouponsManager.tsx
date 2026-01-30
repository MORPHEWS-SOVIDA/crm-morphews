import { useState } from 'react';
import { Plus, Ticket, Search, Pencil, Trash2, Copy, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useDiscountCoupons,
  useDeleteDiscountCoupon,
  useToggleCouponStatus,
  type DiscountCoupon,
} from '@/hooks/useDiscountCoupons';
import { CouponFormDialog } from './CouponFormDialog';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function CouponsManager() {
  const { data: coupons, isLoading } = useDiscountCoupons();
  const deleteCoupon = useDeleteDiscountCoupon();
  const toggleStatus = useToggleCouponStatus();

  const [searchTerm, setSearchTerm] = useState('');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<DiscountCoupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<DiscountCoupon | null>(null);

  const filteredCoupons = coupons?.filter(c =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  const handleEdit = (coupon: DiscountCoupon) => {
    setEditingCoupon(coupon);
    setFormDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deletingCoupon) {
      await deleteCoupon.mutateAsync(deletingCoupon.id);
      setDeletingCoupon(null);
    }
  };

  const handleToggleStatus = async (coupon: DiscountCoupon) => {
    await toggleStatus.mutateAsync({ id: coupon.id, is_active: !coupon.is_active });
  };

  const getDiscountDisplay = (coupon: DiscountCoupon) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value_cents}%`;
    }
    return formatCurrency(coupon.discount_value_cents);
  };

  const getStatusBadge = (coupon: DiscountCoupon) => {
    const now = new Date();
    
    if (!coupon.is_active) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return <Badge variant="outline">Agendado</Badge>;
    }
    
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return <Badge variant="destructive">Esgotado</Badge>;
    }
    
    return <Badge variant="default">Ativo</Badge>;
  };

  const getAppliesToLabel = (coupon: DiscountCoupon) => {
    switch (coupon.applies_to) {
      case 'all':
        return 'Todos os produtos';
      case 'specific_products':
        return `${coupon.product_ids?.length || 0} produto(s)`;
      case 'specific_combos':
        return `${coupon.combo_ids?.length || 0} combo(s)`;
      case 'specific_items':
        return 'Itens específicos';
      default:
        return 'Todos';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Cupons de Desconto</h2>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie cupons para suas lojas e checkouts
          </p>
        </div>
        <Button onClick={() => { setEditingCoupon(null); setFormDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cupom
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código ou nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {filteredCoupons.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? 'Nenhum cupom encontrado' : 'Nenhum cupom criado'}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              {searchTerm
                ? 'Tente buscar por outro termo'
                : 'Crie cupons de desconto para oferecer promoções aos seus clientes'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setFormDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeiro Cupom
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Aplica-se a</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {coupon.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopyCode(coupon.code)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{coupon.name}</p>
                      {coupon.auto_attribute_affiliate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Vincula a: {coupon.auto_attribute_affiliate.display_name || 'Afiliado'}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">
                      {getDiscountDisplay(coupon)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getAppliesToLabel(coupon)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {coupon.valid_until ? (
                      <span>
                        até {format(new Date(coupon.valid_until), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sem limite</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {coupon.current_uses}
                      {coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(coupon)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleStatus(coupon)}
                        title={coupon.is_active ? 'Desativar' : 'Ativar'}
                      >
                        {coupon.is_active ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(coupon)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingCoupon(coupon)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <CouponFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        coupon={editingCoupon}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCoupon} onOpenChange={() => setDeletingCoupon(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cupom "{deletingCoupon?.code}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

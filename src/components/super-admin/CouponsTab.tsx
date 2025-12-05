import { useState } from "react";
import { Plus, Trash2, Power, PowerOff, Loader2, Tag, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDiscountCoupons, useCreateCoupon, useToggleCoupon, useDeleteCoupon } from "@/hooks/useWhatsAppInstances";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

export function CouponsTab() {
  const { data: coupons, isLoading } = useDiscountCoupons();
  const createCoupon = useCreateCoupon();
  const toggleCoupon = useToggleCoupon();
  const deleteCoupon = useDeleteCoupon();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount_value: "",
    max_uses: "",
    valid_until: "",
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const handleCreateCoupon = async () => {
    if (!newCoupon.code.trim()) {
      toast({ title: "Digite um código para o cupom", variant: "destructive" });
      return;
    }
    if (!newCoupon.discount_value || parseFloat(newCoupon.discount_value) <= 0) {
      toast({ title: "Digite um valor de desconto válido", variant: "destructive" });
      return;
    }

    try {
      await createCoupon.mutateAsync({
        code: newCoupon.code,
        discount_value_cents: Math.round(parseFloat(newCoupon.discount_value) * 100),
        max_uses: newCoupon.max_uses ? parseInt(newCoupon.max_uses) : undefined,
        valid_until: newCoupon.valid_until || undefined,
      });

      setShowCreateDialog(false);
      setNewCoupon({ code: "", discount_value: "", max_uses: "", valid_until: "" });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    await toggleCoupon.mutateAsync({ id, is_active: !currentStatus });
  };

  const handleDelete = async (id: string, code: string) => {
    if (confirm(`Tem certeza que deseja excluir o cupom ${code}?`)) {
      await deleteCoupon.mutateAsync(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Cupons de Desconto</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie cupons para desconto em instâncias WhatsApp
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cupom
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Cupom de Desconto</DialogTitle>
              <DialogDescription>
                Cupons são aplicados ao valor mensal das instâncias WhatsApp (R$ 197/mês)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Código do Cupom *</Label>
                <Input
                  id="coupon-code"
                  placeholder="Ex: DESCONTO50"
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                />
                <p className="text-xs text-muted-foreground">
                  Será convertido automaticamente para maiúsculas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-value">Valor do Desconto (R$) *</Label>
                <Input
                  id="discount-value"
                  type="number"
                  placeholder="Ex: 50.00"
                  value={newCoupon.discount_value}
                  onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Desconto fixo em reais (não percentual)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-uses">Limite de Usos (opcional)</Label>
                <Input
                  id="max-uses"
                  type="number"
                  placeholder="Ex: 10"
                  value={newCoupon.max_uses}
                  onChange={(e) => setNewCoupon({ ...newCoupon, max_uses: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para uso ilimitado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valid-until">Válido até (opcional)</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={newCoupon.valid_until}
                  onChange={(e) => setNewCoupon({ ...newCoupon, valid_until: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para sem data de expiração
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleCreateCoupon}
                disabled={createCoupon.isPending}
              >
                {createCoupon.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Cupom
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {coupons?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cupom cadastrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons?.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-bold">{coupon.code}</TableCell>
                    <TableCell className="text-green-600 font-semibold">
                      {formatPrice(coupon.discount_value_cents)}
                    </TableCell>
                    <TableCell>
                      {coupon.current_uses}
                      {coupon.max_uses && ` / ${coupon.max_uses}`}
                    </TableCell>
                    <TableCell>
                      {coupon.valid_until ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(coupon.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem limite</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {coupon.is_active ? (
                        <Badge className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(coupon.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggle(coupon.id, coupon.is_active)}
                          title={coupon.is_active ? "Desativar" : "Ativar"}
                        >
                          {coupon.is_active ? (
                            <PowerOff className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Power className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(coupon.id, coupon.code)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

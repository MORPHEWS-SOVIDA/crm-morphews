import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, CreditCard, User, Store, Package } from 'lucide-react';
import {
  usePosTerminals,
  useCreatePosTerminal,
  useUpdatePosTerminal,
  useTogglePosTerminal,
  useDeletePosTerminal,
  POS_GATEWAY_LABELS,
  ASSIGNMENT_TYPE_LABELS,
  type PosTerminal,
  type PosGatewayType,
  type CreatePosTerminalInput,
} from '@/hooks/usePosTerminals';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

const GATEWAY_OPTIONS: PosGatewayType[] = ['getnet', 'pagarme', 'banrisul', 'vero', 'banricompras', 'stone'];

const ASSIGNMENT_ICONS: Record<string, React.ReactNode> = {
  user: <User className="w-4 h-4" />,
  counter: <Store className="w-4 h-4" />,
  pickup: <Package className="w-4 h-4" />,
};

interface FormData {
  gateway_type: PosGatewayType;
  terminal_id: string;
  serial_number: string;
  name: string;
  payment_method_id: string;
  assignment_type: string;
  assigned_user_id: string;
  is_active: boolean;
}

const initialFormData: FormData = {
  gateway_type: 'getnet',
  terminal_id: '',
  serial_number: '',
  name: '',
  payment_method_id: '',
  assignment_type: 'counter',
  assigned_user_id: '',
  is_active: true,
};

export function PosTerminalsManager() {
  const { data: terminals = [], isLoading } = usePosTerminals();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: paymentMethods = [] } = usePaymentMethods();
  
  const createTerminal = useCreatePosTerminal();
  const updateTerminal = useUpdatePosTerminal();
  const toggleTerminal = useTogglePosTerminal();
  const deleteTerminal = useDeletePosTerminal();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<PosTerminal | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingTerminal(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (terminal: PosTerminal) => {
    setEditingTerminal(terminal);
    setFormData({
      gateway_type: terminal.gateway_type,
      terminal_id: terminal.terminal_id || '',
      serial_number: terminal.serial_number || '',
      name: terminal.name,
      payment_method_id: terminal.payment_method_id || '',
      assignment_type: terminal.assignment_type || 'counter',
      assigned_user_id: terminal.current_assignment?.user_id || '',
      is_active: terminal.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    const input: CreatePosTerminalInput = {
      gateway_type: formData.gateway_type,
      terminal_id: formData.terminal_id || '',
      serial_number: formData.serial_number || undefined,
      name: formData.name.trim(),
      payment_method_id: formData.payment_method_id || undefined,
      assignment_type: formData.assignment_type,
      assigned_user_id: formData.assignment_type === 'user' ? formData.assigned_user_id : undefined,
      is_active: formData.is_active,
    };

    if (editingTerminal) {
      await updateTerminal.mutateAsync({ id: editingTerminal.id, ...input });
    } else {
      await createTerminal.mutateAsync(input);
    }

    setIsFormOpen(false);
    resetForm();
  };

  const handleToggleActive = async (terminal: PosTerminal) => {
    await toggleTerminal.mutateAsync({ id: terminal.id, is_active: !terminal.is_active });
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteTerminal.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const getAssignmentLabel = (terminal: PosTerminal) => {
    if (terminal.assignment_type === 'user' && terminal.current_assignment?.profiles) {
      const p = terminal.current_assignment.profiles;
      return `${p.first_name} ${p.last_name}`;
    }
    return ASSIGNMENT_TYPE_LABELS[terminal.assignment_type || 'counter'] || terminal.assignment_type;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {terminals.length} máquina{terminals.length !== 1 ? 's' : ''} cadastrada{terminals.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Máquina
        </Button>
      </div>

      {terminals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma máquina POS cadastrada</p>
          <p className="text-sm mt-1">Cadastre suas máquinas de cartão para rastrear pagamentos</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>TID/Serial</TableHead>
                <TableHead>Atribuição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminals.map((terminal) => (
                <TableRow key={terminal.id}>
                  <TableCell className="font-medium">{terminal.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{POS_GATEWAY_LABELS[terminal.gateway_type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {terminal.terminal_id || terminal.serial_number || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {ASSIGNMENT_ICONS[terminal.assignment_type || 'counter']}
                      <span className="text-sm">{getAssignmentLabel(terminal)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={terminal.is_active}
                      onCheckedChange={() => handleToggleActive(terminal)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(terminal)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(terminal.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTerminal ? 'Editar Máquina POS' : 'Nova Máquina POS'}
            </DialogTitle>
            <DialogDescription>
              Configure os dados da máquina de cartão para rastreamento de pagamentos
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome da Máquina *</Label>
              <Input
                id="name"
                placeholder="Ex: Getnet Motoboy João"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Gateway/Adquirente *</Label>
                <Select
                  value={formData.gateway_type}
                  onValueChange={(v) => setFormData({ ...formData, gateway_type: v as PosGatewayType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAY_OPTIONS.map((gw) => (
                      <SelectItem key={gw} value={gw}>
                        {POS_GATEWAY_LABELS[gw]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={formData.payment_method_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, payment_method_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tid">TID (Terminal ID)</Label>
                <Input
                  id="tid"
                  placeholder="Identificador do terminal"
                  value={formData.terminal_id}
                  onChange={(e) => setFormData({ ...formData, terminal_id: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="serial">Número de Série</Label>
                <Input
                  id="serial"
                  placeholder="Serial da máquina"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de Atribuição *</Label>
              <Select
                value={formData.assignment_type}
                onValueChange={(v) => setFormData({ ...formData, assignment_type: v, assigned_user_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Usuário/Motoboy
                    </div>
                  </SelectItem>
                  <SelectItem value="counter">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      Balcão/Caixa
                    </div>
                  </SelectItem>
                  <SelectItem value="pickup">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Retirada
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.assignment_type === 'user' && (
              <div className="grid gap-2">
                <Label>Usuário Responsável</Label>
                <Select
                  value={formData.assigned_user_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, assigned_user_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label htmlFor="is_active">Máquina ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name.trim() || createTerminal.isPending || updateTerminal.isPending}
            >
              {editingTerminal ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover máquina POS?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As transações já registradas serão mantidas,
              mas não haverá mais vínculo com esta máquina.
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

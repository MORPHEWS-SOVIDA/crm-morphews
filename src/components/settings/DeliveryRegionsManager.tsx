import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Trash2, Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/MultiSelect';
import {
  useDeliveryRegions,
  useCreateDeliveryRegion,
  useUpdateDeliveryRegion,
  useDeleteDeliveryRegion,
  DeliveryRegion,
  DAYS_OF_WEEK,
  SHIFTS,
} from '@/hooks/useDeliveryConfig';
import { useUsers } from '@/hooks/useUsers';

type ShiftType = 'morning' | 'afternoon' | 'full_day';

interface ScheduleInput {
  day_of_week: number;
  shift: ShiftType;
}

export function DeliveryRegionsManager() {
  const { data: regions = [], isLoading } = useDeliveryRegions();
  const { data: users = [] } = useUsers();
  const createRegion = useCreateDeliveryRegion();
  const updateRegion = useUpdateDeliveryRegion();
  const deleteRegion = useDeleteDeliveryRegion();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<DeliveryRegion | null>(null);
  const [name, setName] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayShifts, setDayShifts] = useState<Record<number, ShiftType[]>>({});

  const userOptions = users.map(user => ({
    value: user.user_id,
    label: `${user.first_name} ${user.last_name}`,
  }));

  const openCreateDialog = () => {
    setEditingRegion(null);
    setName('');
    setAssignedUserIds([]);
    setSelectedDays([]);
    setDayShifts({});
    setDialogOpen(true);
  };

  const openEditDialog = (region: DeliveryRegion) => {
    setEditingRegion(region);
    setName(region.name);
    
    // Load assigned users from the new array
    const userIds = region.assigned_users?.map(au => au.user_id) || [];
    setAssignedUserIds(userIds);
    
    // Group schedules by day and collect all shifts per day
    const days = [...new Set(region.schedules?.map(s => s.day_of_week) || [])];
    setSelectedDays(days);
    
    const shifts: Record<number, ShiftType[]> = {};
    region.schedules?.forEach(s => {
      if (!shifts[s.day_of_week]) {
        shifts[s.day_of_week] = [];
      }
      shifts[s.day_of_week].push(s.shift);
    });
    setDayShifts(shifts);
    
    setDialogOpen(true);
  };

  const handleDayToggle = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
      const newShifts = { ...dayShifts };
      delete newShifts[day];
      setDayShifts(newShifts);
    } else {
      setSelectedDays([...selectedDays, day]);
      setDayShifts({ ...dayShifts, [day]: ['full_day'] });
    }
  };

  const handleShiftToggle = (day: number, shift: ShiftType) => {
    const currentShifts = dayShifts[day] || [];
    
    if (currentShifts.includes(shift)) {
      // Remove shift, but ensure at least one remains
      const newShifts = currentShifts.filter(s => s !== shift);
      if (newShifts.length === 0) {
        // If removing last one, keep it
        return;
      }
      setDayShifts({ ...dayShifts, [day]: newShifts });
    } else {
      // Add shift
      setDayShifts({ ...dayShifts, [day]: [...currentShifts, shift] });
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    // Build schedules array - one entry per day/shift combination
    const schedules: ScheduleInput[] = [];
    selectedDays.forEach(day => {
      const shifts = dayShifts[day] || ['full_day'];
      shifts.forEach(shift => {
        schedules.push({ day_of_week: day, shift });
      });
    });

    try {
      if (editingRegion) {
        await updateRegion.mutateAsync({
          id: editingRegion.id,
          name: name.trim(),
          assigned_user_ids: assignedUserIds,
          schedules,
        });
      } else {
        await createRegion.mutateAsync({
          name: name.trim(),
          assigned_user_ids: assignedUserIds,
          schedules,
        });
      }

      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving region:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover esta região?')) {
      await deleteRegion.mutateAsync(id);
    }
  };

  const formatScheduleSummary = (region: DeliveryRegion): string => {
    if (!region.schedules || region.schedules.length === 0) return 'Nenhum dia';
    
    const days = [...new Set(region.schedules.map(s => s.day_of_week))].sort();
    return days.map(d => DAYS_OF_WEEK[d].short).join(', ');
  };

  const formatAssignedUsers = (region: DeliveryRegion): React.ReactNode => {
    if (!region.assigned_users || region.assigned_users.length === 0) {
      return <span className="text-muted-foreground">Não atribuído</span>;
    }
    
    return region.assigned_users.map(au => 
      au.user ? `${au.user.first_name} ${au.user.last_name}` : 'Usuário'
    ).join(', ');
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
          Configure as regiões atendidas por motoboy
        </p>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Região
        </Button>
      </div>

      {regions.length === 0 ? (
        <div className="text-center p-8 border rounded-lg border-dashed">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma região cadastrada</p>
          <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar primeira região
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Região</TableHead>
                <TableHead>Entregadores</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((region) => (
                <TableRow key={region.id}>
                  <TableCell className="font-medium">{region.name}</TableCell>
                  <TableCell>
                    {formatAssignedUsers(region)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatScheduleSummary(region)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={region.is_active ? 'default' : 'secondary'}>
                      {region.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(region)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(region.id)}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRegion ? 'Editar Região' : 'Nova Região'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="region-name">Nome da Região *</Label>
              <Input
                id="region-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Porto Alegre Centro"
              />
            </div>

            <div className="space-y-2">
              <Label>Entregadores Responsáveis</Label>
              <MultiSelect
                options={userOptions}
                selected={assignedUserIds}
                onChange={setAssignedUserIds}
                placeholder="Selecione os entregadores (opcional)"
              />
              <p className="text-xs text-muted-foreground">
                Você pode selecionar mais de um entregador para esta região.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Dias e Turnos de Entrega</Label>
              <div className="border rounded-lg p-4 space-y-4">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label 
                        htmlFor={`day-${day.value}`} 
                        className="text-sm font-medium cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                    
                    {selectedDays.includes(day.value) && (
                      <div className="ml-7 pl-4 border-l-2 border-muted">
                        <div className="flex flex-wrap gap-4">
                          {SHIFTS.map((shift) => (
                            <div key={shift.value} className="flex items-center gap-2">
                              <Checkbox
                                id={`${day.value}-${shift.value}`}
                                checked={(dayShifts[day.value] || []).includes(shift.value as ShiftType)}
                                onCheckedChange={() => handleShiftToggle(day.value, shift.value as ShiftType)}
                              />
                              <Label 
                                htmlFor={`${day.value}-${shift.value}`} 
                                className="text-sm cursor-pointer"
                              >
                                {shift.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione os dias e turnos de entrega. Você pode marcar mais de um turno por dia.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!name.trim() || createRegion.isPending || updateRegion.isPending}
            >
              {(createRegion.isPending || updateRegion.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingRegion ? 'Salvar' : 'Criar Região'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

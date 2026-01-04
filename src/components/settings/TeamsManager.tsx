import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, Users, Loader2 } from 'lucide-react';
import { useTeamsWithMembers, useCreateTeam, useUpdateTeam, useDeleteTeam, TeamWithMembers } from '@/hooks/useTeams';

const TEAM_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

export function TeamsManager() {
  const { data: teams, isLoading } = useTeamsWithMembers();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithMembers | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#6366f1' });

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    
    await createTeam.mutateAsync({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      color: formData.color,
    });
    
    setFormData({ name: '', description: '', color: '#6366f1' });
    setIsCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingTeam || !formData.name.trim()) return;
    
    await updateTeam.mutateAsync({
      id: editingTeam.id,
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      color: formData.color,
    });
    
    setEditingTeam(null);
    setFormData({ name: '', description: '', color: '#6366f1' });
  };

  const handleDelete = async (id: string) => {
    await deleteTeam.mutateAsync(id);
  };

  const openEditDialog = (team: TeamWithMembers) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      color: team.color || '#6366f1',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Times
            </CardTitle>
            <CardDescription>
              Gerencie os times da sua organização para agrupar usuários
            </CardDescription>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Time</DialogTitle>
                <DialogDescription>
                  Adicione um novo time para organizar seus colaboradores
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Time *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Vendas, Suporte, Marketing..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição do time (opcional)"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor do Time</Label>
                  <div className="flex gap-2 flex-wrap">
                    {TEAM_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={!formData.name.trim() || createTeam.isPending}>
                  {createTeam.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Time
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {teams && teams.length > 0 ? (
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: team.color || '#6366f1' }}
                  />
                  <div>
                    <div className="font-medium">{team.name}</div>
                    {team.description && (
                      <div className="text-sm text-muted-foreground">{team.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {team.member_count} {team.member_count === 1 ? 'membro' : 'membros'}
                  </Badge>
                  
                  <Dialog open={editingTeam?.id === team.id} onOpenChange={(open) => !open && setEditingTeam(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(team)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Time</DialogTitle>
                        <DialogDescription>
                          Atualize as informações do time
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-name">Nome do Time *</Label>
                          <Input
                            id="edit-name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-description">Descrição</Label>
                          <Textarea
                            id="edit-description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cor do Time</Label>
                          <div className="flex gap-2 flex-wrap">
                            {TEAM_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-8 h-8 rounded-full border-2 transition-all ${
                                  formData.color === color ? 'border-foreground scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setFormData(prev => ({ ...prev, color }))}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTeam(null)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleUpdate} disabled={!formData.name.trim() || updateTeam.isPending}>
                          {updateTeam.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Salvar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Time</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o time "{team.name}"?
                          {team.member_count > 0 && (
                            <span className="block mt-2 text-amber-600">
                              Este time possui {team.member_count} membro(s) associado(s). Eles serão desvinculados do time.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(team.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum time cadastrado</p>
            <p className="text-sm">Crie times para organizar seus colaboradores</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

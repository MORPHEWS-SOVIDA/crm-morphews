import { useState } from 'react';
import { Loader2, Trash2, Shield, User, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { useUsersWithRoles, useUpdateUserRole, useDeleteUser, UserWithRole } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export function UsersList() {
  const { data: users = [], isLoading } = useUsersWithRoles();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();
  const { user: currentUser } = useAuth();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserWithRole | null>(null);

  const handleRoleChange = async (userId: string, role: 'admin' | 'user') => {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast({ title: 'Perfil atualizado!' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!userToDelete || deleteConfirmText !== 'EXCLUIR') return;
    
    try {
      await deleteUser.mutateAsync(userToDelete.user_id);
      toast({ title: 'Usuário removido!' });
      setUserToDelete(null);
      setDeleteConfirmText('');
    } catch (error: any) {
      toast({
        title: 'Erro ao remover usuário',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const isCurrentUser = user.user_id === currentUser?.id;
        const fullName = `${user.first_name} ${user.last_name}`;
        
        return (
          <div
            key={user.id}
            className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-primary font-semibold">
                    {user.first_name[0]}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium">{fullName}</p>
                {user.instagram && (
                  <p className="text-sm text-muted-foreground">@{user.instagram.replace('@', '')}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={user.role}
                onValueChange={(value) => handleRoleChange(user.user_id, value as 'admin' | 'user')}
                disabled={isCurrentUser}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Vendedor
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={isCurrentUser}
                    onClick={() => setUserToDelete(user)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O usuário{' '}
                      <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong>{' '}
                      será removido permanentemente do sistema.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Digite <strong>EXCLUIR</strong> para confirmar:
                    </p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="EXCLUIR"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                      setUserToDelete(null);
                      setDeleteConfirmText('');
                    }}>
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleteConfirmText !== 'EXCLUIR'}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}

      {users.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum usuário cadastrado
        </div>
      )}
    </div>
  );
}

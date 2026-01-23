import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Plus, Search, Loader2, Pencil, Trash2, Package, ArrowLeft } from 'lucide-react';
import { useProductCombos, useDeleteProductCombo } from '@/hooks/useProductCombos';
import { Link, useNavigate } from 'react-router-dom';
// Simple text normalization for search
const normalizeText = (text: string) => 
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function ProductCombos() {
  const navigate = useNavigate();
  const { data: combos = [], isLoading } = useProductCombos();
  const deleteCombo = useDeleteProductCombo();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [comboToDelete, setComboToDelete] = useState<string | null>(null);

  const filteredCombos = combos.filter(combo =>
    normalizeText(combo.name).includes(normalizeText(searchTerm)) ||
    (combo.description && normalizeText(combo.description).includes(normalizeText(searchTerm)))
  );

  const handleDelete = async () => {
    if (!comboToDelete) return;
    await deleteCombo.mutateAsync(comboToDelete);
    setComboToDelete(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/produtos">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Combos</h1>
              <p className="text-muted-foreground text-sm">
                Gerencie vendas casadas de múltiplos produtos
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/produtos/combos/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Combo
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar combos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Combos Cadastrados
              {filteredCombos.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filteredCombos.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCombos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">Nenhum combo encontrado</p>
                <p className="text-sm">Crie combos para aumentar o ticket médio das vendas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCombos.map((combo) => (
                      <TableRow key={combo.id}>
                        <TableCell className="font-medium">{combo.name}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {combo.description || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {combo.sku || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={combo.is_active ? 'default' : 'secondary'}>
                            {combo.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/produtos/combos/${combo.id}`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setComboToDelete(combo.id)}
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
          </CardContent>
        </Card>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={!!comboToDelete} onOpenChange={() => setComboToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Combo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O combo será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCombo.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

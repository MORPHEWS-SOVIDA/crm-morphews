import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, BarChart3, Edit, Trash2, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react';
import { useQuizzes, useDeleteQuiz, useUpdateQuiz, type Quiz } from '@/hooks/ecommerce/useQuizzes';
import { QuizFormDialog } from './QuizFormDialog';
import { QuizBuilderDialog } from './QuizBuilderDialog';
import { QuizAnalyticsDialog } from './QuizAnalyticsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function QuizManager() {
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);

  const { data: quizzes, isLoading } = useQuizzes();
  const deleteQuiz = useDeleteQuiz();
  const updateQuiz = useUpdateQuiz();

  const filteredQuizzes = quizzes?.filter(q => 
    q.name.toLowerCase().includes(search.toLowerCase()) ||
    q.slug.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleCreate = () => {
    setSelectedQuiz(null);
    setIsFormOpen(true);
  };

  const handleEdit = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setIsFormOpen(true);
  };

  const handleBuild = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setIsBuilderOpen(true);
  };

  const handleAnalytics = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setIsAnalyticsOpen(true);
  };

  const handleToggleActive = async (quiz: Quiz) => {
    await updateQuiz.mutateAsync({
      id: quiz.id,
      is_active: !quiz.is_active,
    });
  };

  const handleCopyLink = (quiz: Quiz) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/quiz/${quiz.slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleDelete = async () => {
    if (quizToDelete) {
      await deleteQuiz.mutateAsync(quizToDelete.id);
      setQuizToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar quizzes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Quiz
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nenhum quiz encontrado</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Crie seu primeiro quiz para qualificar e converter mais leads.
              </p>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Quiz
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.map(quiz => (
            <Card key={quiz.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{quiz.name}</CardTitle>
                    <CardDescription className="truncate">
                      /quiz/{quiz.slug}
                    </CardDescription>
                  </div>
                  <Badge variant={quiz.is_active ? 'default' : 'secondary'}>
                    {quiz.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {quiz.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {quiz.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Criado em {format(new Date(quiz.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBuild(quiz)}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAnalytics(quiz)}
                  >
                    <BarChart3 className="h-3.5 w-3.5 mr-1" />
                    Métricas
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(quiz)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`/quiz/${quiz.slug}`, '_blank')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(quiz)}
                  >
                    {quiz.is_active ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuizToDelete(quiz)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <QuizFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        quiz={selectedQuiz}
        onSuccess={(quiz) => {
          setIsFormOpen(false);
          if (!selectedQuiz) {
            setSelectedQuiz(quiz);
            setIsBuilderOpen(true);
          }
        }}
      />

      {/* Builder Dialog */}
      {selectedQuiz && (
        <QuizBuilderDialog
          open={isBuilderOpen}
          onOpenChange={setIsBuilderOpen}
          quizId={selectedQuiz.id}
        />
      )}

      {/* Analytics Dialog */}
      {selectedQuiz && (
        <QuizAnalyticsDialog
          open={isAnalyticsOpen}
          onOpenChange={setIsAnalyticsOpen}
          quizId={selectedQuiz.id}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!quizToDelete} onOpenChange={() => setQuizToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados de respostas e métricas serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

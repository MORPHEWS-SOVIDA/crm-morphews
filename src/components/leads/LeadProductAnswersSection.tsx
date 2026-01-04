import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MessageSquare, 
  Plus, 
  Edit2, 
  Trash2, 
  Package,
  HelpCircle,
  Calendar,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useLeadQuestionAnswers, 
  useProductQuestions,
  useAllProductQuestions,
  useUpsertLeadQuestionAnswers, 
  useDeleteLeadProductQuestionAnswers,
  type LeadQuestionAnswerWithDetails,
} from '@/hooks/useProductQuestions';
import { useProducts, Product } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/skeleton';

interface LeadProductAnswersSectionProps {
  leadId: string;
}

export function LeadProductAnswersSection({ leadId }: LeadProductAnswersSectionProps) {
  const { data: answers, isLoading: loadingAnswers } = useLeadQuestionAnswers(leadId);
  const { data: products, isLoading: loadingProducts } = useProducts();
  const upsertAnswers = useUpsertLeadQuestionAnswers();
  const deleteAnswers = useDeleteLeadProductQuestionAnswers();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [answerValues, setAnswerValues] = useState<Record<string, string>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Get all product IDs that have answers
  const productIdsWithAnswers = useMemo(() => {
    if (!answers) return [];
    return [...new Set(answers.map(a => a.product_id))];
  }, [answers]);

  // Fetch questions for selected product in dialog
  const { data: selectedProductQuestions } = useProductQuestions(selectedProductId || undefined);
  
  // Fetch all questions for products with answers
  const { data: allQuestions } = useAllProductQuestions(productIdsWithAnswers);

  // Group answers by product
  const answersByProduct = useMemo(() => {
    if (!answers) return {};
    return answers.reduce((acc, answer) => {
      if (!acc[answer.product_id]) acc[answer.product_id] = [];
      acc[answer.product_id].push(answer);
      return acc;
    }, {} as Record<string, LeadQuestionAnswerWithDetails[]>);
  }, [answers]);

  // Available products for new answers
  const availableProducts = products?.filter(p => 
    p.is_active && !productIdsWithAnswers.includes(p.id)
  ) || [];

  const selectedProduct = products?.find(p => p.id === selectedProductId);

  const handleOpenNewAnswer = () => {
    setEditingProductId(null);
    setSelectedProductId('');
    setAnswerValues({});
    setIsDialogOpen(true);
  };

  const handleEditAnswer = (productId: string, productAnswers: LeadQuestionAnswerWithDetails[]) => {
    setEditingProductId(productId);
    setSelectedProductId(productId);
    // Populate answer values
    const values: Record<string, string> = {};
    productAnswers.forEach(a => {
      values[a.question_id] = a.answer_text || '';
    });
    setAnswerValues(values);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedProductId || !selectedProductQuestions) return;

    const answersToSave = selectedProductQuestions.map(q => ({
      questionId: q.id,
      answerText: answerValues[q.id] || null,
    }));

    upsertAnswers.mutate({
      leadId,
      productId: selectedProductId,
      answers: answersToSave,
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setSelectedProductId('');
        setAnswerValues({});
        setEditingProductId(null);
      },
    });
  };

  const handleDelete = (productId: string) => {
    if (confirm('Tem certeza que deseja remover as respostas deste produto?')) {
      deleteAnswers.mutate({ leadId, productId });
    }
  };

  if (loadingAnswers || loadingProducts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Perguntas Chave
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get questions for a product from allQuestions
  const getQuestionsForProduct = (productId: string) => {
    return allQuestions?.filter(q => q.product_id === productId).sort((a, b) => a.position - b.position) || [];
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Perguntas Chave
        </CardTitle>
        {availableProducts.length > 0 && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleOpenNewAnswer}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProductId ? 'Editar Respostas' : 'Adicionar Respostas'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {!editingProductId && (
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedProductQuestions && selectedProductQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {selectedProductQuestions.map((question) => (
                      <div key={question.id} className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          {question.question_text}
                        </Label>
                        <Textarea
                          value={answerValues[question.id] || ''}
                          onChange={(e) => setAnswerValues(prev => ({ 
                            ...prev, 
                            [question.id]: e.target.value 
                          }))}
                          placeholder="Resposta do cliente..."
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                ) : selectedProductId ? (
                  <p className="text-muted-foreground text-sm">
                    Este produto não tem perguntas chave configuradas.
                  </p>
                ) : null}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={!selectedProductId || !selectedProductQuestions?.length || upsertAnswers.isPending}
                  >
                    {upsertAnswers.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {productIdsWithAnswers.length > 0 ? (
          <div className="space-y-4">
            {productIdsWithAnswers.map((productId) => {
              const product = products?.find(p => p.id === productId);
              const productAnswers = answersByProduct[productId] || [];
              const productQuestions = getQuestionsForProduct(productId);
              
              // Get latest update info
              const latestAnswer = productAnswers.reduce((latest, curr) => {
                if (!latest) return curr;
                return new Date(curr.updated_at) > new Date(latest.updated_at) ? curr : latest;
              }, productAnswers[0]);

              return (
                <div 
                  key={productId} 
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      <span className="font-medium">{product?.name || 'Produto'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {latestAnswer && (
                        <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {format(new Date(latestAnswer.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {latestAnswer.updated_by_profile && (
                            <div className="flex items-center gap-1 text-foreground">
                              <User className="w-3 h-3" />
                              <span className="font-medium">
                                {latestAnswer.updated_by_profile.first_name} {latestAnswer.updated_by_profile.last_name}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEditAnswer(productId, productAnswers)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(productId)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {productQuestions.map((question) => {
                      const answer = productAnswers.find(a => a.question_id === question.id);
                      return (
                        <div key={question.id}>
                          <p className="text-muted-foreground">{question.question_text}</p>
                          <p className="font-medium">
                            {answer?.answer_text || <span className="text-muted-foreground italic">Sem resposta</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma resposta registrada ainda</p>
            {availableProducts.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={handleOpenNewAnswer}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar respostas
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

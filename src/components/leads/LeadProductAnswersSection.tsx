import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLeadAnswers, useUpsertLeadProductAnswer, useDeleteLeadProductAnswer } from '@/hooks/useLeadProductAnswers';
import { useProducts, Product } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/skeleton';

interface LeadProductAnswersSectionProps {
  leadId: string;
}

export function LeadProductAnswersSection({ leadId }: LeadProductAnswersSectionProps) {
  const { data: answers, isLoading: loadingAnswers } = useLeadAnswers(leadId);
  const { data: products, isLoading: loadingProducts } = useProducts();
  const upsertAnswer = useUpsertLeadProductAnswer();
  const deleteAnswer = useDeleteLeadProductAnswer();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [answer3, setAnswer3] = useState('');
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);

  // Products that already have answers for this lead
  const answeredProductIds = answers?.map(a => a.product_id) || [];
  
  // Available products for new answers (excluding already answered)
  const availableProducts = products?.filter(p => 
    p.is_active && !answeredProductIds.includes(p.id)
  ) || [];

  const selectedProduct = products?.find(p => p.id === selectedProductId);

  const handleOpenNewAnswer = () => {
    setEditingAnswerId(null);
    setSelectedProductId('');
    setAnswer1('');
    setAnswer2('');
    setAnswer3('');
    setIsDialogOpen(true);
  };

  const handleEditAnswer = (answer: typeof answers extends (infer T)[] ? T : never) => {
    setEditingAnswerId(answer.id);
    setSelectedProductId(answer.product_id);
    setAnswer1(answer.answer_1 || '');
    setAnswer2(answer.answer_2 || '');
    setAnswer3(answer.answer_3 || '');
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedProductId) return;

    upsertAnswer.mutate({
      lead_id: leadId,
      product_id: selectedProductId,
      answer_1: answer1 || null,
      answer_2: answer2 || null,
      answer_3: answer3 || null,
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        setSelectedProductId('');
        setAnswer1('');
        setAnswer2('');
        setAnswer3('');
        setEditingAnswerId(null);
      },
    });
  };

  const handleDelete = (productId: string) => {
    if (confirm('Tem certeza que deseja remover as respostas deste produto?')) {
      deleteAnswer.mutate({ leadId, productId });
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
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingAnswerId ? 'Editar Respostas' : 'Adicionar Respostas'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {!editingAnswerId && (
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

                {selectedProduct && (
                  <>
                    {selectedProduct.key_question_1 && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          {selectedProduct.key_question_1}
                        </Label>
                        <Textarea
                          value={answer1}
                          onChange={(e) => setAnswer1(e.target.value)}
                          placeholder="Resposta do cliente..."
                          rows={2}
                        />
                      </div>
                    )}

                    {selectedProduct.key_question_2 && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          {selectedProduct.key_question_2}
                        </Label>
                        <Textarea
                          value={answer2}
                          onChange={(e) => setAnswer2(e.target.value)}
                          placeholder="Resposta do cliente..."
                          rows={2}
                        />
                      </div>
                    )}

                    {selectedProduct.key_question_3 && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                          {selectedProduct.key_question_3}
                        </Label>
                        <Textarea
                          value={answer3}
                          onChange={(e) => setAnswer3(e.target.value)}
                          placeholder="Resposta do cliente..."
                          rows={2}
                        />
                      </div>
                    )}

                    {!selectedProduct.key_question_1 && !selectedProduct.key_question_2 && !selectedProduct.key_question_3 && (
                      <p className="text-muted-foreground text-sm">
                        Este produto não tem perguntas chave configuradas.
                      </p>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={!selectedProductId || upsertAnswer.isPending}
                  >
                    {upsertAnswer.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {answers && answers.length > 0 ? (
          <div className="space-y-4">
            {answers.map((answer) => (
              <div 
                key={answer.id} 
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="font-medium">{answer.product?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {format(new Date(answer.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEditAnswer(answer)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(answer.product_id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {answer.product?.key_question_1 && (
                    <div>
                      <p className="text-muted-foreground">{answer.product.key_question_1}</p>
                      <p className="font-medium">
                        {answer.answer_1 || <span className="text-muted-foreground italic">Sem resposta</span>}
                      </p>
                    </div>
                  )}
                  {answer.product?.key_question_2 && (
                    <div>
                      <p className="text-muted-foreground">{answer.product.key_question_2}</p>
                      <p className="font-medium">
                        {answer.answer_2 || <span className="text-muted-foreground italic">Sem resposta</span>}
                      </p>
                    </div>
                  )}
                  {answer.product?.key_question_3 && (
                    <div>
                      <p className="text-muted-foreground">{answer.product.key_question_3}</p>
                      <p className="font-medium">
                        {answer.answer_3 || <span className="text-muted-foreground italic">Sem resposta</span>}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
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

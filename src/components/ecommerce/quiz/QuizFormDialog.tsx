import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreateQuiz, useUpdateQuiz, type Quiz } from '@/hooks/ecommerce/useQuizzes';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  description: z.string().optional(),
  primary_color: z.string().optional(),
  background_color: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface QuizFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quiz: Quiz | null;
  onSuccess?: (quiz: Quiz) => void;
}

export function QuizFormDialog({ open, onOpenChange, quiz, onSuccess }: QuizFormDialogProps) {
  const createQuiz = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const isEditing = !!quiz;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      primary_color: '#6366f1',
      background_color: '#ffffff',
    },
  });

  useEffect(() => {
    if (quiz) {
      form.reset({
        name: quiz.name,
        slug: quiz.slug,
        description: quiz.description || '',
        primary_color: quiz.primary_color,
        background_color: quiz.background_color,
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        description: '',
        primary_color: '#6366f1',
        background_color: '#ffffff',
      });
    }
  }, [quiz, form]);

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName) {
      const slug = watchName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      form.setValue('slug', slug);
    }
  }, [watchName, isEditing, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      let result: Quiz;
      
      if (isEditing) {
        result = await updateQuiz.mutateAsync({
          id: quiz.id,
          ...values,
        });
      } else {
        result = await createQuiz.mutateAsync({
          name: values.name,
          slug: values.slug,
          description: values.description,
          primary_color: values.primary_color,
          background_color: values.background_color,
        });
      }
      
      onSuccess?.(result);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Quiz' : 'Novo Quiz'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Quiz</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Descubra seu perfil" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (URL)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/quiz/</span>
                      <Input placeholder="meu-quiz" {...field} />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Identificador único para a URL do quiz
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descreva o objetivo deste quiz..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primary_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor Principal</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input type="color" className="w-12 h-10 p-1" {...field} />
                        <Input {...field} className="flex-1" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="background_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor de Fundo</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input type="color" className="w-12 h-10 p-1" {...field} />
                        <Input {...field} className="flex-1" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createQuiz.isPending || updateQuiz.isPending}>
                {isEditing ? 'Salvar' : 'Criar Quiz'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

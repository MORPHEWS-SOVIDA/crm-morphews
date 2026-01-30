import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical, Star, MessageSquareQuote, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
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
  useStorefrontTestimonials,
  useDeleteStorefrontTestimonial,
  useUpdateStorefrontTestimonial,
  useToggleTestimonialsEnabled,
  type StorefrontTestimonial,
} from '@/hooks/ecommerce/useStorefrontTestimonials';
import { useStorefront } from '@/hooks/ecommerce';
import { StorefrontTestimonialFormDialog } from '../dialogs/StorefrontTestimonialFormDialog';

interface StorefrontTestimonialsTabProps {
  storefrontId: string;
}

export function StorefrontTestimonialsTab({ storefrontId }: StorefrontTestimonialsTabProps) {
  const { data: storefront } = useStorefront(storefrontId);
  const { data: testimonials, isLoading } = useStorefrontTestimonials(storefrontId);
  const deleteTestimonial = useDeleteStorefrontTestimonial();
  const updateTestimonial = useUpdateStorefrontTestimonial();
  const toggleEnabled = useToggleTestimonialsEnabled();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<StorefrontTestimonial | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (testimonial: StorefrontTestimonial) => {
    setEditingTestimonial(testimonial);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingTestimonial(null);
    setFormOpen(true);
  };

  const handleToggleActive = (testimonial: StorefrontTestimonial) => {
    updateTestimonial.mutate({
      id: testimonial.id,
      storefrontId,
      is_active: !testimonial.is_active,
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTestimonial.mutate(
        { id: deleteId, storefrontId },
        { onSuccess: () => setDeleteId(null) }
      );
    }
  };

  const handleToggleCarousel = (enabled: boolean) => {
    toggleEnabled.mutate({ storefrontId, enabled });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const isCarouselEnabled = (storefront as any)?.testimonials_enabled ?? false;

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Depoimentos de Clientes</h3>
          <p className="text-sm text-muted-foreground">
            Exiba avaliações e depoimentos dos seus clientes na loja
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <Switch
              id="carousel-enabled"
              checked={isCarouselEnabled}
              onCheckedChange={handleToggleCarousel}
              disabled={toggleEnabled.isPending}
            />
            <Label htmlFor="carousel-enabled" className="text-sm font-medium">
              Exibir carrossel
            </Label>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Depoimento
          </Button>
        </div>
      </div>

      {/* Info Card */}
      {!isCarouselEnabled && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-4">
            <MessageSquareQuote className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800">
              O carrossel de depoimentos está desativado. Ative-o acima para exibir na loja.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {testimonials?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquareQuote className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum depoimento cadastrado</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Adicione depoimentos de clientes para aumentar a confiança na sua loja.
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Depoimento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials?.map((testimonial) => (
            <Card key={testimonial.id} className={!testimonial.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Photo */}
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    {testimonial.photo_url ? (
                      <img
                        src={testimonial.photo_url}
                        alt={testimonial.customer_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <MessageSquareQuote className="h-12 w-12" />
                      </div>
                    )}
                  </div>

                  {/* Stars */}
                  <div className="flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="h-5 w-5 fill-pink-500 text-pink-500"
                      />
                    ))}
                  </div>

                  {/* Name with verified badge */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-semibold text-lg">{testimonial.customer_name}</span>
                    {testimonial.is_verified && (
                      <CheckCircle className="h-5 w-5 fill-blue-500 text-white" />
                    )}
                  </div>

                  {/* Testimonial text */}
                  <p className="text-center text-muted-foreground text-sm line-clamp-3">
                    {testimonial.testimonial_text}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Switch
                      checked={testimonial.is_active}
                      onCheckedChange={() => handleToggleActive(testimonial)}
                    />
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(testimonial)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(testimonial.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StorefrontTestimonialFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        storefrontId={storefrontId}
        testimonial={editingTestimonial}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover depoimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
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

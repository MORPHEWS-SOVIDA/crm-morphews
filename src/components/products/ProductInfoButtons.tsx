import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  FlaskConical, 
  HelpCircle, 
  ExternalLink,
  Youtube
} from 'lucide-react';
import { useProductIngredients } from '@/hooks/useProductIngredients';
import { useProductFaqs } from '@/hooks/useProductFaqs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ProductInfoButtonsProps {
  productId: string;
  productName: string;
  hotSiteUrl?: string | null;
  youtubeVideoUrl?: string | null;
}

export function ProductInfoButtons({ 
  productId, 
  productName, 
  hotSiteUrl, 
  youtubeVideoUrl 
}: ProductInfoButtonsProps) {
  const [showCompositionDialog, setShowCompositionDialog] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);

  const { data: ingredients = [] } = useProductIngredients(productId);
  const { data: faqs = [] } = useProductFaqs(productId);

  const hasComposition = ingredients.length > 0;
  const hasFaq = faqs.length > 0;
  const hasHotSite = !!hotSiteUrl;
  const hasYoutube = !!youtubeVideoUrl;

  // If no info available, don't render anything
  if (!hasComposition && !hasFaq && !hasHotSite && !hasYoutube) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {hasComposition && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCompositionDialog(true)}
          >
            <FlaskConical className="w-4 h-4 mr-2" />
            Ver Composição
          </Button>
        )}
        
        {hasFaq && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFaqDialog(true)}
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Ver FAQ
          </Button>
        )}
        
        {hasHotSite && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(hotSiteUrl!, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Hot Site
          </Button>
        )}
        
        {hasYoutube && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(youtubeVideoUrl!, '_blank')}
          >
            <Youtube className="w-4 h-4 mr-2" />
            Vídeo
          </Button>
        )}
      </div>

      {/* Composition Dialog */}
      <Dialog open={showCompositionDialog} onOpenChange={setShowCompositionDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              Composição - {productName}
            </DialogTitle>
            <DialogDescription>
              Detalhes dos componentes do produto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {ingredients.map((ingredient, index) => (
              <div key={ingredient.id} className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{index + 1}</Badge>
                  <h4 className="font-semibold">{ingredient.name}</h4>
                </div>
                {ingredient.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {ingredient.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* FAQ Dialog */}
      <Dialog open={showFaqDialog} onOpenChange={setShowFaqDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              FAQ - {productName}
            </DialogTitle>
            <DialogDescription>
              Perguntas frequentes sobre o produto
            </DialogDescription>
          </DialogHeader>
          <Accordion type="single" collapsible className="w-full mt-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.id} value={faq.id}>
                <AccordionTrigger className="text-left">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground whitespace-pre-wrap pl-8">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  MessageCircle, 
  UserPlus, 
  ExternalLink, 
  ThumbsUp, 
  ThumbsDown,
  Copy,
  Check,
  Sparkles,
  Phone,
  ShoppingBag,
  X,
} from 'lucide-react';
import { LeadSuggestion } from '@/hooks/useLeadIntelligence';
import { toast } from 'sonner';

interface SuggestionDetailModalProps {
  suggestion: LeadSuggestion | null;
  open: boolean;
  onClose: () => void;
  onFeedback?: (leadId: string, isUseful: boolean) => void;
  onDismiss?: (leadId: string) => void;
  type: 'followup' | 'products';
}

export function SuggestionDetailModal({ 
  suggestion, 
  open, 
  onClose, 
  onFeedback,
  onDismiss,
  type,
}: SuggestionDetailModalProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);

  if (!suggestion) return null;

  const whatsappNumber = suggestion.lead_whatsapp?.replace(/\D/g, '');
  
  // Build WhatsApp link with pre-filled message
  const getWhatsAppLink = () => {
    if (!whatsappNumber) return null;
    const message = encodeURIComponent(suggestion.suggested_script || '');
    return `https://wa.me/55${whatsappNumber}?text=${message}`;
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(suggestion.suggested_script || suggestion.reason);
    setCopied(true);
    toast.success('Texto copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (isUseful: boolean) => {
    setFeedbackGiven(isUseful ? 'positive' : 'negative');
    onFeedback?.(suggestion.lead_id, isUseful);
    toast.success(isUseful ? 'Obrigado pelo feedback positivo!' : 'Feedback registrado. Vamos melhorar!');
  };

  const handleDismiss = () => {
    onDismiss?.(suggestion.lead_id);
    onClose();
  };

  const handleWhatsApp = () => {
    const link = getWhatsAppLink();
    if (link) {
      window.open(link, '_blank');
    }
  };

  const handleAddReceptivo = () => {
    // Navigate to Add Receptivo with lead pre-selected
    navigate(`/add-receptivo?leadId=${suggestion.lead_id}`);
    onClose();
  };

  const handleViewLead = () => {
    navigate(`/leads/${suggestion.lead_id}`);
    onClose();
  };

  const priorityConfig = {
    high: { label: 'Alta Prioridade', className: 'bg-red-100 text-red-700 border-red-300' },
    medium: { label: 'Média Prioridade', className: 'bg-amber-100 text-amber-700 border-amber-300' },
    low: { label: 'Baixa Prioridade', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  };

  const actionConfig = {
    ligar: { label: 'Ligar', icon: Phone },
    whatsapp: { label: 'WhatsApp', icon: MessageCircle },
    agendar: { label: 'Agendar', icon: UserPlus },
  };

  const actionInfo = actionConfig[suggestion.suggested_action] || actionConfig.whatsapp;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${type === 'followup' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                {type === 'followup' ? (
                  <Sparkles className={`w-5 h-5 ${type === 'followup' ? 'text-blue-600' : 'text-purple-600'}`} />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-purple-600" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {suggestion.lead_name}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {type === 'followup' ? 'Sugestão de Follow-up' : 'Recomendação de Produtos'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Priority & Action Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={priorityConfig[suggestion.priority].className}>
              {priorityConfig[suggestion.priority].label}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <actionInfo.icon className="w-3 h-3" />
              Ação: {actionInfo.label}
            </Badge>
          </div>

          {/* Reason / Context */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Por que contatar?</h4>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm leading-relaxed">{suggestion.reason}</p>
            </div>
          </div>

          {/* Suggested Script */}
          {suggestion.suggested_script && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Mensagem sugerida</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={handleCopyScript}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{suggestion.suggested_script}</p>
              </div>
            </div>
          )}

          {/* Recommended Products */}
          {suggestion.recommended_products && suggestion.recommended_products.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Produtos recomendados</h4>
              <div className="flex flex-wrap gap-2">
                {suggestion.recommended_products.map((product, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {product}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Ações rápidas</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleWhatsApp}
                disabled={!whatsappNumber}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button 
                variant="outline"
                onClick={handleAddReceptivo}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Receptivo
              </Button>
            </div>
            <Button 
              variant="ghost"
              className="w-full"
              onClick={handleViewLead}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver perfil completo do lead
            </Button>
          </div>

          <Separator />

          {/* Feedback Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Esta sugestão foi útil?</h4>
            {feedbackGiven ? (
              <div className={`p-3 rounded-lg text-center ${
                feedbackGiven === 'positive' 
                  ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' 
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              }`}>
                <p className="text-sm">
                  {feedbackGiven === 'positive' 
                    ? '✓ Obrigado! Seu feedback ajuda a melhorar as sugestões.' 
                    : '✓ Feedback registrado. Vamos melhorar!'}
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => handleFeedback(true)}
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Útil
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => handleFeedback(false)}
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Não útil
                </Button>
              </div>
            )}
          </div>

          {/* Dismiss Button */}
          <Button 
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4 mr-2" />
            Dispensar esta sugestão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PostSaleSurvey, 
  getPostSaleSurveyStatusLabel, 
  getPostSaleSurveyStatusColor,
  getDeliveryTypeLabel 
} from '@/hooks/usePostSaleSurveys';
import { Check, X, MessageSquare, Pill } from 'lucide-react';

interface PostSaleHistoryCardProps {
  survey: PostSaleSurvey;
}

export function PostSaleHistoryCard({ survey }: PostSaleHistoryCardProps) {
  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const RatingDisplay = ({ value, label }: { value: number | null; label: string }) => {
    if (value === null) return null;
    
    const getColor = (v: number) => {
      if (v >= 9) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      if (v >= 7) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      if (v >= 5) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    };
    
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${getColor(value)}`}>
          {value}/10
        </span>
      </div>
    );
  };

  const BooleanDisplay = ({ value, label }: { value: boolean | null; label: string }) => {
    if (value === null) return null;
    
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        {value ? (
          <span className="flex items-center gap-1 text-green-600">
            <Check className="w-4 h-4" /> Sim
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-600">
            <X className="w-4 h-4" /> Não
          </span>
        )}
      </div>
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Venda: {formatCurrency(survey.sale?.total_cents || 0)}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatDate(survey.completed_at || survey.attempted_at || survey.created_at)}
            </p>
          </div>
          <Badge className={getPostSaleSurveyStatusColor(survey.status)}>
            {getPostSaleSurveyStatusLabel(survey.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <BooleanDisplay value={survey.received_order} label="Recebeu o pedido" />
        <BooleanDisplay value={survey.knows_how_to_use} label="Sabe como usar" />
        <RatingDisplay value={survey.seller_rating} label="Nota do vendedor" />
        
        {survey.delivery_type && survey.delivery_rating !== null && (
          <RatingDisplay 
            value={survey.delivery_rating} 
            label={`Nota ${getDeliveryTypeLabel(survey.delivery_type)}`} 
          />
        )}
        
        {survey.uses_continuous_medication && (
          <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50">
            <Pill className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-muted-foreground">Medicamentos:</span>
              <p className="text-foreground">{survey.continuous_medication_details || '-'}</p>
            </div>
          </div>
        )}
        
        {survey.notes && (
          <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50">
            <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-foreground">{survey.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

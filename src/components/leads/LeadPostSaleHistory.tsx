import { useLeadPostSaleSurveys } from '@/hooks/usePostSaleSurveys';
import { PostSaleHistoryCard } from '@/components/post-sale/PostSaleHistoryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Loader2 } from 'lucide-react';

interface LeadPostSaleHistoryProps {
  leadId: string;
}

export function LeadPostSaleHistory({ leadId }: LeadPostSaleHistoryProps) {
  const { data: surveys, isLoading } = useLeadPostSaleSurveys(leadId);
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Histórico Pós-Venda
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  if (!surveys || surveys.length === 0) {
    return null; // Don't show section if there's no history
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          Histórico Pós-Venda
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {surveys.map((survey) => (
            <PostSaleHistoryCard key={survey.id} survey={survey} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

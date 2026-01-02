import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, AlertCircle, PhoneCall } from 'lucide-react';
import { 
  PostSaleSurvey, 
  DeliveryType, 
  useUpdatePostSaleSurvey,
  getDeliveryTypeLabel 
} from '@/hooks/usePostSaleSurveys';
import { WhatsAppButton } from '@/components/WhatsAppButton';

interface PostSaleSurveyFormProps {
  survey: PostSaleSurvey;
  onComplete?: () => void;
}

export function PostSaleSurveyForm({ survey, onComplete }: PostSaleSurveyFormProps) {
  const updateSurvey = useUpdatePostSaleSurvey();
  
  // Form state
  const [receivedOrder, setReceivedOrder] = useState<boolean | null>(survey.received_order);
  const [knowsHowToUse, setKnowsHowToUse] = useState<boolean | null>(survey.knows_how_to_use);
  const [sellerRating, setSellerRating] = useState<number | null>(survey.seller_rating);
  const [usesContinuousMedication, setUsesContinuousMedication] = useState<boolean | null>(survey.uses_continuous_medication);
  const [continuousMedicationDetails, setContinuousMedicationDetails] = useState(survey.continuous_medication_details || '');
  const [deliveryRating, setDeliveryRating] = useState<number | null>(survey.delivery_rating);
  const [notes, setNotes] = useState(survey.notes || '');

  const deliveryType = (survey.sale?.delivery_type || survey.delivery_type) as DeliveryType | null;
  
  const handleComplete = async () => {
    await updateSurvey.mutateAsync({
      id: survey.id,
      received_order: receivedOrder ?? undefined,
      knows_how_to_use: knowsHowToUse ?? undefined,
      seller_rating: sellerRating ?? undefined,
      uses_continuous_medication: usesContinuousMedication ?? undefined,
      continuous_medication_details: continuousMedicationDetails || undefined,
      delivery_rating: deliveryRating ?? undefined,
      notes: notes || undefined,
      status: 'completed',
    });
    onComplete?.();
  };
  
  const handleAttempt = async () => {
    await updateSurvey.mutateAsync({
      id: survey.id,
      notes: notes || undefined,
      status: 'attempted',
    });
    onComplete?.();
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const RatingSelector = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number | null; 
    onChange: (v: number) => void; 
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <Button
            key={n}
            type="button"
            variant={value === n ? 'default' : 'outline'}
            size="sm"
            className="w-10 h-10"
            onClick={() => onChange(n)}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );

  const YesNoSelector = ({
    value,
    onChange,
    label,
  }: {
    value: boolean | null;
    onChange: (v: boolean) => void;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === true ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => onChange(true)}
        >
          <Check className="w-4 h-4 mr-2" />
          Sim
        </Button>
        <Button
          type="button"
          variant={value === false ? 'destructive' : 'outline'}
          className="flex-1"
          onClick={() => onChange(false)}
        >
          <X className="w-4 h-4 mr-2" />
          Não
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">Pesquisa Pós-Venda</CardTitle>
            <CardDescription>
              Cliente: <span className="font-medium text-foreground">{survey.lead?.name}</span>
            </CardDescription>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <span>Venda: {formatCurrency(survey.sale?.total_cents || 0)}</span>
              {deliveryType && (
                <>
                  <span>•</span>
                  <Badge variant="outline">{getDeliveryTypeLabel(deliveryType)}</Badge>
                </>
              )}
            </div>
          </div>
          {survey.lead?.whatsapp && (
            <WhatsAppButton phone={survey.lead.whatsapp} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fixed Questions */}
        <div className="space-y-4">
          <YesNoSelector
            value={receivedOrder}
            onChange={setReceivedOrder}
            label="Recebeu seu pedido?"
          />
          
          <YesNoSelector
            value={knowsHowToUse}
            onChange={setKnowsHowToUse}
            label="Sabe como usar?"
          />
          
          <RatingSelector
            value={sellerRating}
            onChange={setSellerRating}
            label="De 0 a 10, qual nota você dá para o vendedor que lhe fez a venda?"
          />
          
          {/* Continuous Medication */}
          <div className="space-y-3">
            <YesNoSelector
              value={usesContinuousMedication}
              onChange={setUsesContinuousMedication}
              label="Você usa algum remédio de uso contínuo?"
            />
            
            {usesContinuousMedication && (
              <div className="pl-4 border-l-2 border-primary">
                <Label htmlFor="medication-details">Citar medicamentos:</Label>
                <Textarea
                  id="medication-details"
                  value={continuousMedicationDetails}
                  onChange={(e) => setContinuousMedicationDetails(e.target.value)}
                  placeholder="Liste os medicamentos de uso contínuo..."
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Delivery-specific question */}
        {deliveryType && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Pergunta específica para entrega via {getDeliveryTypeLabel(deliveryType)}</span>
            </div>
            
            {deliveryType === 'motoboy' && (
              <RatingSelector
                value={deliveryRating}
                onChange={setDeliveryRating}
                label="De 0 a 10, qual nota você dá para o motoboy?"
              />
            )}
            
            {deliveryType === 'carrier' && (
              <RatingSelector
                value={deliveryRating}
                onChange={setDeliveryRating}
                label="De 0 a 10, qual nota você dá para a transportadora?"
              />
            )}
            
            {deliveryType === 'counter' && (
              <RatingSelector
                value={deliveryRating}
                onChange={setDeliveryRating}
                label="De 0 a 10, qual nota você dá para o atendimento no balcão?"
              />
            )}
          </div>
        )}

        {/* Notes */}
        <div className="pt-4 border-t">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações adicionais sobre a pesquisa..."
            className="mt-1"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            onClick={handleComplete}
            disabled={updateSurvey.isPending}
            className="flex-1"
          >
            {updateSurvey.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Concluir Pesquisa
          </Button>
          
          <Button
            variant="outline"
            onClick={handleAttempt}
            disabled={updateSurvey.isPending}
          >
            <PhoneCall className="w-4 h-4 mr-2" />
            Registrar Tentativa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { FileText, Pill, User, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  quantity?: string;
  instructions?: string;
}

interface PrescriberInfo {
  name?: string;
  crm?: string;
  specialty?: string;
}

interface DocumentReadingCardProps {
  reading: {
    id: string;
    status: string;
    summary?: string | null;
    medications?: Medication[] | null;
    prescriber_info?: PrescriberInfo | null;
    auto_replied?: boolean;
    processed_at?: string | null;
    created_at: string;
  };
}

export function DocumentReadingCard({ reading }: DocumentReadingCardProps) {
  const isProcessing = reading.status === "pending" || reading.status === "processing";
  const isCompleted = reading.status === "completed";
  const isFailed = reading.status === "failed";

  const medications = reading.medications as Medication[] | null;
  const prescriberInfo = reading.prescriber_info as PrescriberInfo | null;

  return (
    <div className="mt-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
          Interpretação do Documento
        </span>
        {isProcessing && (
          <Badge variant="outline" className="text-xs">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processando...
          </Badge>
        )}
        {isCompleted && (
          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Concluído
          </Badge>
        )}
        {isFailed && (
          <Badge variant="outline" className="text-xs text-red-600 border-red-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Falhou
          </Badge>
        )}
      </div>

      {isCompleted && reading.summary && (
        <>
          <p className="text-sm text-foreground">{reading.summary}</p>

          {medications && medications.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Pill className="w-3 h-3" />
                Medicamentos Identificados:
              </div>
              <div className="space-y-1">
                {medications.map((med, index) => (
                  <div
                    key={index}
                    className="text-sm p-2 rounded bg-white dark:bg-background/50"
                  >
                    <span className="font-medium">{med.name}</span>
                    {med.dosage && (
                      <span className="text-muted-foreground"> - {med.dosage}</span>
                    )}
                    {med.frequency && (
                      <span className="text-muted-foreground text-xs"> ({med.frequency})</span>
                    )}
                    {med.instructions && (
                      <p className="text-xs text-muted-foreground mt-1">{med.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {prescriberInfo && (prescriberInfo.name || prescriberInfo.crm) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>
                {prescriberInfo.name}
                {prescriberInfo.crm && ` - CRM: ${prescriberInfo.crm}`}
                {prescriberInfo.specialty && ` (${prescriberInfo.specialty})`}
              </span>
            </div>
          )}

          {reading.auto_replied && (
            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Resumo enviado automaticamente ao cliente
            </div>
          )}
        </>
      )}

      {reading.processed_at && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {format(new Date(reading.processed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      )}
    </div>
  );
}

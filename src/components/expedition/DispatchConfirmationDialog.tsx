import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';

interface DispatchConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmWithoutCheck: () => void;
  onGoBackToCheck: () => void;
}

export function DispatchConfirmationDialog({
  open,
  onOpenChange,
  onConfirmWithoutCheck,
  onGoBackToCheck,
}: DispatchConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Conferência de Produtos Pendente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3 pt-2">
            <p className="text-foreground font-medium">
              Você não apertou nas unidades do produto separado.
            </p>
            <p>
              Isso quer dizer que você não seguiu as etapas do processo de conferência.
            </p>
            <p className="text-destructive font-semibold border border-destructive/30 bg-destructive/10 p-3 rounded-md">
              ⚠️ Se essa venda for enviada errada, o custo de reenvio será repassado para você.
            </p>
            <p>
              Quer conferir novamente ou realmente quer marcar como despachado sem conferir as unidades vendidas pelo sistema dando check em cada item separado?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button
            variant="outline"
            className="flex items-center gap-2 flex-1"
            onClick={() => {
              onGoBackToCheck();
              onOpenChange(false);
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            VOLTAR PARA CONFERIR QUANTIDADES
          </Button>
          <Button
            variant="destructive"
            className="flex items-center gap-2 flex-1"
            onClick={() => {
              onConfirmWithoutCheck();
              onOpenChange(false);
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            PROSSEGUIR PARA DESPACHE SEM CONFERÊNCIA
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

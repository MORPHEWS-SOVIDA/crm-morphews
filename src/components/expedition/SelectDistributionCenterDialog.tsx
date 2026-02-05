import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DistributionCenterOption {
  id: string;
  firstName: string;
  lastName: string | null;
}

interface SelectDistributionCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distributionCenters: DistributionCenterOption[];
  onSelect: (centerId: string) => void;
  isLoading?: boolean;
  saleName?: string;
}

export function SelectDistributionCenterDialog({
  open,
  onOpenChange,
  distributionCenters,
  onSelect,
  isLoading,
  saleName,
}: SelectDistributionCenterDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
      setSelectedId(null);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedId(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-primary" />
            Selecionar Centro de Distribuição
          </DialogTitle>
          <DialogDescription>
            {saleName ? (
              <>Selecione qual CD vai enviar <strong>{saleName}</strong></>
            ) : (
              'Selecione qual centro de distribuição vai enviar esta venda'
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-2">
          <div className="space-y-2">
            {distributionCenters.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum centro de distribuição disponível
              </p>
            ) : (
              distributionCenters.map((center) => (
                <div
                  key={center.id}
                  onClick={() => setSelectedId(center.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border",
                    selectedId === center.id
                      ? "bg-primary/10 border-primary"
                      : "bg-background hover:bg-accent border-transparent"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(
                      "text-sm font-medium",
                      selectedId === center.id ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {center.firstName.charAt(0)}
                      {center.lastName?.charAt(0) || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {center.firstName} {center.lastName || ''}
                    </p>
                  </div>
                  {selectedId === center.id && (
                    <Warehouse className="w-5 h-5 text-primary" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedId || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Atribuindo...
              </>
            ) : (
              'Confirmar e Despachar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

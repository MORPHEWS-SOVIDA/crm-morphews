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
import { Bike, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MotoboyOption {
  id: string;
  firstName: string;
  lastName: string | null;
}

interface SelectMotoboyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motoboys: MotoboyOption[];
  onSelect: (motoboyId: string) => void;
  isLoading?: boolean;
  saleName?: string;
}

export function SelectMotoboyDialog({
  open,
  onOpenChange,
  motoboys,
  onSelect,
  isLoading,
  saleName,
}: SelectMotoboyDialogProps) {
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
            <Bike className="w-5 h-5 text-primary" />
            Selecionar Motoboy
          </DialogTitle>
          <DialogDescription>
            {saleName ? (
              <>Selecione qual motoboy fará a entrega de <strong>{saleName}</strong></>
            ) : (
              'Selecione qual motoboy fará esta entrega'
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-2">
          <div className="space-y-2">
            {motoboys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum motoboy disponível
              </p>
            ) : (
              motoboys.map((motoboy) => (
                <div
                  key={motoboy.id}
                  onClick={() => setSelectedId(motoboy.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border",
                    selectedId === motoboy.id
                      ? "bg-primary/10 border-primary"
                      : "bg-background hover:bg-accent border-transparent"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn(
                      "text-sm font-medium",
                      selectedId === motoboy.id ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {motoboy.firstName.charAt(0)}
                      {motoboy.lastName?.charAt(0) || ''}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {motoboy.firstName} {motoboy.lastName || ''}
                    </p>
                  </div>
                  {selectedId === motoboy.id && (
                    <Bike className="w-5 h-5 text-primary" />
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
                Despachando...
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

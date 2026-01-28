import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateNetwork } from '@/hooks/ecommerce/useAffiliateNetworks';

interface NetworkCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NetworkCreateDialog({ open, onOpenChange }: NetworkCreateDialogProps) {
  const createNetwork = useCreateNetwork();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Digite um nome para a rede');
      return;
    }

    createNetwork.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        photo_url: photoUrl.trim() || undefined,
      },
      {
        onSuccess: (network) => {
          toast.success('Rede criada com sucesso!');
          onOpenChange(false);
          setName('');
          setDescription('');
          setPhotoUrl('');
        },
        onError: (error: Error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Rede de Afiliados</DialogTitle>
          <DialogDescription>
            Crie uma rede para agrupar afiliados com checkouts específicos
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Rede *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Influenciadores Fitness"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição da rede..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">URL da Foto (opcional)</Label>
            <Input
              id="photo"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createNetwork.isPending}>
              {createNetwork.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Rede
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateIntegration } from '@/hooks/useIntegrations';
import { Webhook, FileCode, Plug2 } from 'lucide-react';

interface IntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const integrationTypes = [
  { 
    value: 'webhook_inbound', 
    label: 'Webhook de Entrada', 
    description: 'Receba dados de plataformas externas (Payt, Hotmart, etc)',
    icon: Webhook
  },
  { 
    value: 'webhook_outbound', 
    label: 'Webhook de Saída', 
    description: 'Envie eventos para sistemas externos',
    icon: Webhook
  },
  { 
    value: 'api', 
    label: 'API REST', 
    description: 'Integração via API com autenticação por chave',
    icon: FileCode
  },
];

export function IntegrationDialog({ open, onOpenChange }: IntegrationDialogProps) {
  const createIntegration = useCreateIntegration();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('webhook_inbound');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;
    
    await createIntegration.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      type: type as any,
      status: 'inactive',
    });
    
    // Reset form
    setName('');
    setDescription('');
    setType('webhook_inbound');
    onOpenChange(false);
  };

  const selectedType = integrationTypes.find(t => t.value === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Integração</DialogTitle>
            <DialogDescription>
              Configure uma nova integração para conectar sistemas externos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Integração *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Payt - Carrinho Abandonado"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo desta integração..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Integração</Label>
              <div className="grid gap-2">
                {integrationTypes.map((intType) => {
                  const Icon = intType.icon;
                  const isSelected = type === intType.value;
                  
                  return (
                    <div
                      key={intType.value}
                      className={`
                        flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                        ${isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                        }
                      `}
                      onClick={() => setType(intType.value)}
                    >
                      <div className={`
                        p-2 rounded-md 
                        ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                      `}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{intType.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {intType.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createIntegration.isPending || !name.trim()}>
              {createIntegration.isPending ? 'Criando...' : 'Criar Integração'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent,
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
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
import { Loader2, AlertTriangle } from 'lucide-react';
import { useFiscalCompanies, formatCNPJ } from '@/hooks/useFiscalCompanies';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvalidateNumbersDialog({ open, onOpenChange }: Props) {
  const { data: companies = [] } = useFiscalCompanies();
  const activeCompanies = companies.filter(c => c.is_active && c.certificate_file_path);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [serie, setSerie] = useState('1');
  const [startNumber, setStartNumber] = useState('');
  const [endNumber, setEndNumber] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedCompanyId) {
      toast({ title: 'Selecione uma empresa', variant: 'destructive' });
      return;
    }
    if (!startNumber || !endNumber) {
      toast({ title: 'Preencha os números inicial e final', variant: 'destructive' });
      return;
    }
    const start = parseInt(startNumber, 10);
    const end = parseInt(endNumber, 10);
    if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0) {
      toast({ title: 'Números inválidos', variant: 'destructive' });
      return;
    }
    if (start > end) {
      toast({ title: 'Número inicial deve ser menor ou igual ao final', variant: 'destructive' });
      return;
    }
    if (justification.length < 15) {
      toast({ title: 'Justificativa deve ter pelo menos 15 caracteres', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('focus-nfe-invalidate', {
        body: {
          fiscal_company_id: selectedCompanyId,
          serie: parseInt(serie, 10),
          start_number: start,
          end_number: end,
          justification,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Inutilização solicitada com sucesso!',
        description: `Números ${start} a ${end} série ${serie}`,
      });
      onOpenChange(false);
      // Reset form
      setStartNumber('');
      setEndNumber('');
      setJustification('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao inutilizar numeração',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nota fiscal eletrônica</DialogTitle>
          <DialogDescription>
            Inutilizar faixa de numeração de NF-e
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive" className="border-amber-500 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              A inutilização é <strong>irreversível</strong>. Use apenas para números que não foram e não serão utilizados.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Unidade de negócio</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {activeCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.company_name} ({formatCNPJ(company.cnpj)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Série <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Número inicial <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(e.target.value)}
                min={1}
                placeholder="Ex: 100"
              />
            </div>
            <div className="space-y-2">
              <Label>Número final <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                value={endNumber}
                onChange={(e) => setEndNumber(e.target.value)}
                min={1}
                placeholder="Ex: 105"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Digite a justificativa <span className="text-destructive">*</span>
              <span className="text-muted-foreground text-xs ml-1">(mín. 15 caracteres)</span>
            </Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Numeração não utilizada por falha no sistema"
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {justification.length}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedCompanyId}
            variant="destructive"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Inutilizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

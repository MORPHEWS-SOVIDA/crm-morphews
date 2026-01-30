import { Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { Lead } from '@/hooks/useLeads';

interface LeadFiscalRegistrationSectionProps {
  lead: Lead;
  onUpdate: (field: string, value: string | boolean | null) => void;
  canEdit?: boolean;
}

export function LeadFiscalRegistrationSection({ 
  lead, 
  onUpdate,
  canEdit = true 
}: LeadFiscalRegistrationSectionProps) {
  const ieIsento = lead.inscricao_estadual_isento ?? true;
  const imIsento = lead.inscricao_municipal_isento ?? true;

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
      <div className="p-2 rounded-lg bg-amber-500/10">
        <Building2 className="w-5 h-5 text-amber-500" />
      </div>
      <div className="flex-1 space-y-4">
        <p className="text-sm font-medium text-muted-foreground">Inscrições Fiscais (para PJ)</p>
        
        {/* Inscrição Estadual */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Inscrição Estadual</Label>
            <div className="flex items-center gap-1.5 ml-auto">
              <Checkbox
                id="ie_isento_detail"
                checked={ieIsento}
                onCheckedChange={(checked) => {
                  onUpdate('inscricao_estadual_isento', !!checked);
                  if (checked) {
                    onUpdate('inscricao_estadual', null);
                  }
                }}
                disabled={!canEdit}
              />
              <Label htmlFor="ie_isento_detail" className="text-xs text-muted-foreground cursor-pointer">
                Isento
              </Label>
            </div>
          </div>
          <Input
            value={lead.inscricao_estadual || ''}
            onChange={(e) => onUpdate('inscricao_estadual', e.target.value || null)}
            placeholder={ieIsento ? 'Isento' : 'Número da IE'}
            disabled={ieIsento || !canEdit}
            className={ieIsento ? 'bg-muted text-muted-foreground' : ''}
          />
        </div>

        {/* Inscrição Municipal */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Inscrição Municipal</Label>
            <div className="flex items-center gap-1.5 ml-auto">
              <Checkbox
                id="im_isento_detail"
                checked={imIsento}
                onCheckedChange={(checked) => {
                  onUpdate('inscricao_municipal_isento', !!checked);
                  if (checked) {
                    onUpdate('inscricao_municipal', null);
                  }
                }}
                disabled={!canEdit}
              />
              <Label htmlFor="im_isento_detail" className="text-xs text-muted-foreground cursor-pointer">
                Isento
              </Label>
            </div>
          </div>
          <Input
            value={lead.inscricao_municipal || ''}
            onChange={(e) => onUpdate('inscricao_municipal', e.target.value || null)}
            placeholder={imIsento ? 'Isento' : 'Número da IM'}
            disabled={imIsento || !canEdit}
            className={imIsento ? 'bg-muted text-muted-foreground' : ''}
          />
        </div>
      </div>
    </div>
  );
}

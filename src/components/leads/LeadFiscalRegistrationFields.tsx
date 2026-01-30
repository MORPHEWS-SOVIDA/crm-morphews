import { Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface FiscalRegistrationData {
  inscricao_estadual: string;
  inscricao_estadual_isento: boolean;
  inscricao_municipal: string;
  inscricao_municipal_isento: boolean;
}

interface LeadFiscalRegistrationFieldsProps {
  data: FiscalRegistrationData;
  onChange: (field: keyof FiscalRegistrationData, value: string | boolean) => void;
  readonly?: boolean;
}

export function LeadFiscalRegistrationFields({ 
  data, 
  onChange,
  readonly = false 
}: LeadFiscalRegistrationFieldsProps) {
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
                id="ie_isento"
                checked={data.inscricao_estadual_isento}
                onCheckedChange={(checked) => {
                  onChange('inscricao_estadual_isento', !!checked);
                  if (checked) {
                    onChange('inscricao_estadual', '');
                  }
                }}
                disabled={readonly}
              />
              <Label htmlFor="ie_isento" className="text-xs text-muted-foreground cursor-pointer">
                Isento
              </Label>
            </div>
          </div>
          <Input
            value={data.inscricao_estadual || ''}
            onChange={(e) => onChange('inscricao_estadual', e.target.value)}
            placeholder={data.inscricao_estadual_isento ? 'Isento' : 'Número da IE'}
            disabled={data.inscricao_estadual_isento || readonly}
            className={data.inscricao_estadual_isento ? 'bg-muted text-muted-foreground' : ''}
          />
        </div>

        {/* Inscrição Municipal */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Inscrição Municipal</Label>
            <div className="flex items-center gap-1.5 ml-auto">
              <Checkbox
                id="im_isento"
                checked={data.inscricao_municipal_isento}
                onCheckedChange={(checked) => {
                  onChange('inscricao_municipal_isento', !!checked);
                  if (checked) {
                    onChange('inscricao_municipal', '');
                  }
                }}
                disabled={readonly}
              />
              <Label htmlFor="im_isento" className="text-xs text-muted-foreground cursor-pointer">
                Isento
              </Label>
            </div>
          </div>
          <Input
            value={data.inscricao_municipal || ''}
            onChange={(e) => onChange('inscricao_municipal', e.target.value)}
            placeholder={data.inscricao_municipal_isento ? 'Isento' : 'Número da IM'}
            disabled={data.inscricao_municipal_isento || readonly}
            className={data.inscricao_municipal_isento ? 'bg-muted text-muted-foreground' : ''}
          />
        </div>
      </div>
    </div>
  );
}

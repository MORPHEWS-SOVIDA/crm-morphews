import { useMemo, useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Lead } from '@/types/lead';

type FieldKey =
  | 'id' | 'name' | 'email' | 'whatsapp' | 'secondary_phone'
  | 'instagram' | 'tiktok' | 'linkedin' | 'site'
  | 'specialty' | 'followers' | 'stage' | 'stars' | 'lead_source' | 'source'
  | 'city' | 'state' | 'neighborhood' | 'cep' | 'street' | 'street_number'
  | 'cpf_cnpj' | 'birth_date' | 'gender'
  | 'negotiated_value' | 'paid_value' | 'desired_products' | 'observations'
  | 'assigned_to' | 'created_at' | 'updated_at'
  | 'classificacao_contato';

interface FieldDef {
  key: FieldKey;
  label: string;
  group: 'Identificação' | 'Contato' | 'Endereço' | 'Comercial' | 'Datas' | 'Análise';
}

const FIELDS: FieldDef[] = [
  { key: 'id', label: 'ID', group: 'Identificação' },
  { key: 'name', label: 'Nome', group: 'Identificação' },
  { key: 'specialty', label: 'Especialidade', group: 'Identificação' },
  { key: 'cpf_cnpj', label: 'CPF/CNPJ', group: 'Identificação' },
  { key: 'birth_date', label: 'Data de nascimento', group: 'Identificação' },
  { key: 'gender', label: 'Gênero', group: 'Identificação' },

  { key: 'email', label: 'Email', group: 'Contato' },
  { key: 'whatsapp', label: 'WhatsApp', group: 'Contato' },
  { key: 'secondary_phone', label: 'Telefone secundário', group: 'Contato' },
  { key: 'instagram', label: 'Instagram', group: 'Contato' },
  { key: 'tiktok', label: 'TikTok', group: 'Contato' },
  { key: 'linkedin', label: 'LinkedIn', group: 'Contato' },
  { key: 'site', label: 'Site', group: 'Contato' },
  { key: 'followers', label: 'Seguidores', group: 'Contato' },

  { key: 'cep', label: 'CEP', group: 'Endereço' },
  { key: 'street', label: 'Rua', group: 'Endereço' },
  { key: 'street_number', label: 'Número', group: 'Endereço' },
  { key: 'neighborhood', label: 'Bairro', group: 'Endereço' },
  { key: 'city', label: 'Cidade', group: 'Endereço' },
  { key: 'state', label: 'Estado', group: 'Endereço' },

  { key: 'stage', label: 'Etapa do funil', group: 'Comercial' },
  { key: 'stars', label: 'Estrelas', group: 'Comercial' },
  { key: 'lead_source', label: 'Origem (lead_source)', group: 'Comercial' },
  { key: 'source', label: 'Source', group: 'Comercial' },
  { key: 'assigned_to', label: 'Responsável', group: 'Comercial' },
  { key: 'negotiated_value', label: 'Valor negociado', group: 'Comercial' },
  { key: 'paid_value', label: 'Valor pago', group: 'Comercial' },
  { key: 'desired_products', label: 'Produtos desejados', group: 'Comercial' },
  { key: 'observations', label: 'Observações', group: 'Comercial' },

  { key: 'created_at', label: 'Criado em', group: 'Datas' },
  { key: 'updated_at', label: 'Atualizado em', group: 'Datas' },

  { key: 'classificacao_contato', label: 'Classificação Insta/WhatsApp', group: 'Análise' },
];

const PRESETS: Record<string, FieldKey[]> = {
  Básico: ['name', 'whatsapp', 'instagram', 'email', 'stage', 'classificacao_contato'],
  Contato: ['name', 'email', 'whatsapp', 'secondary_phone', 'instagram', 'tiktok', 'city', 'state', 'classificacao_contato'],
  Comercial: ['name', 'whatsapp', 'email', 'stage', 'stars', 'negotiated_value', 'paid_value', 'assigned_to', 'created_at'],
  Completo: FIELDS.map((f) => f.key),
};

const GROUPS: FieldDef['group'][] = ['Identificação', 'Contato', 'Endereço', 'Comercial', 'Datas', 'Análise'];

function classify(lead: Lead): string {
  const ig = (lead.instagram || '').trim();
  const wa = (lead.whatsapp || '').trim();
  if (ig && !wa) return 'instagram_sem_whatsapp';
  if (wa && !ig) return 'whatsapp_sem_instagram';
  if (ig && wa) return 'ambos';
  return 'nenhum';
}

function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s: string;
  if (val instanceof Date) s = val.toISOString();
  else if (typeof val === 'object') s = JSON.stringify(val);
  else s = String(val);
  if (/[",\n;\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

interface Props {
  leads: Lead[];
  totalCount: number;
}

export function ExportLeadsDialog({ leads, totalCount }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<FieldKey>>(new Set(PRESETS.Básico));

  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({ group: g, fields: FIELDS.filter((f) => f.group === g) }));
  }, []);

  const toggle = (key: FieldKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPreset = (name: keyof typeof PRESETS) => {
    setSelected(new Set(PRESETS[name]));
  };

  const handleExport = () => {
    if (selected.size === 0) {
      toast.error('Selecione pelo menos um campo para exportar.');
      return;
    }
    if (leads.length === 0) {
      toast.error('Não há leads para exportar com os filtros atuais.');
      return;
    }

    const cols = FIELDS.filter((f) => selected.has(f.key));
    const header = cols.map((c) => csvCell(c.label)).join(',');
    const rows = leads.map((lead) => {
      const enriched = { ...lead, classificacao_contato: classify(lead) } as Record<string, unknown>;
      return cols.map((c) => csvCell(enriched[c.key])).join(',');
    });
    const csv = '\uFEFF' + [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `leads_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${leads.length} leads exportados`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full sm:w-auto">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Exportar leads em CSV
          </DialogTitle>
          <DialogDescription>
            {leads.length === totalCount
              ? `Você vai exportar ${leads.length} leads.`
              : `Você vai exportar ${leads.length} de ${totalCount} leads (filtros aplicados).`}
            {' '}Selecione os campos que deseja incluir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Presets rápidos</Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset(name as keyof typeof PRESETS)}
                >
                  {name}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Limpar
              </Button>
            </div>
          </div>

          <Separator />

          <ScrollArea className="h-[340px] pr-4">
            <div className="space-y-4">
              {grouped.map(({ group, fields }) => (
                <div key={group}>
                  <h4 className="text-sm font-semibold mb-2">{group}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {fields.map((f) => (
                      <label
                        key={f.key}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                      >
                        <Checkbox
                          checked={selected.has(f.key)}
                          onCheckedChange={() => toggle(f.key)}
                        />
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Baixar {leads.length} leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

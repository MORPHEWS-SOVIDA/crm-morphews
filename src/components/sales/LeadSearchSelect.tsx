import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLeads } from '@/hooks/useLeads';
import { useNavigate } from 'react-router-dom';

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  state: string | null;
}

interface LeadSearchSelectProps {
  value: string | null;
  onChange: (leadId: string | null, lead: Lead | null) => void;
  placeholder?: string;
}

export function LeadSearchSelect({
  value,
  onChange,
  placeholder = "Selecione um cliente...",
}: LeadSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { data: leads = [], isLoading } = useLeads();

  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads.slice(0, 50);
    
    const search = searchTerm.toLowerCase();
    return leads.filter(lead => 
      lead.name.toLowerCase().includes(search) ||
      lead.whatsapp.includes(search) ||
      lead.email?.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [leads, searchTerm]);

  const selectedLead = useMemo(() => {
    return leads.find(lead => lead.id === value);
  }, [leads, value]);

  const handleSelect = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      onChange(leadId, lead as Lead);
      setOpen(false);
    }
  };

  const handleNewLead = () => {
    setOpen(false);
    navigate('/leads/new?returnTo=vendas');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10"
        >
          {selectedLead ? (
            <div className="flex items-center gap-2 text-left">
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="font-medium">{selectedLead.name}</p>
                <p className="text-xs text-muted-foreground">{selectedLead.whatsapp}</p>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar por nome, telefone ou email..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Nenhum cliente encontrado
                  </p>
                  <Button size="sm" onClick={handleNewLead}>
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar Novo Lead
                  </Button>
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={handleNewLead}
                className="text-primary cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Novo Lead
              </CommandItem>
              {filteredLeads.map((lead) => (
                <CommandItem
                  key={lead.id}
                  value={lead.id}
                  onSelect={handleSelect}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === lead.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.whatsapp}
                      {lead.city && ` • ${lead.city}/${lead.state}`}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

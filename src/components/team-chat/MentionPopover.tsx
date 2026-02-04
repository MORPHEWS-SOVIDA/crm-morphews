import { useEffect, useState } from 'react';
import { User, Briefcase, FileText, Package, Headphones, DollarSign, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { TeamMentionData } from '@/hooks/useTeamChat';
import { cn } from '@/lib/utils';

interface MentionPopoverProps {
  open: boolean;
  query: string;
  type: TeamMentionData['type'] | null;
  onSelect: (mention: TeamMentionData) => void;
  onClose: () => void;
}

interface MentionOption {
  id: string;
  type: TeamMentionData['type'];
  display_name: string;
  subtitle?: string;
  avatar_url?: string;
}

export function MentionPopover({ open, query, type, onSelect, onClose }: MentionPopoverProps) {
  const { data: tenantId } = useCurrentTenantId();
  const [options, setOptions] = useState<MentionOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<TeamMentionData['type'] | null>(type);

  // Reset selected type when popover opens
  useEffect(() => {
    if (open) {
      setSelectedType(type);
    }
  }, [open, type]);

  // Buscar opções baseado no tipo e query
  useEffect(() => {
    if (!open || !tenantId) return;

    const searchOptions = async () => {
      setIsLoading(true);
      const results: MentionOption[] = [];

      try {
        // Se nenhum tipo selecionado, mostrar tipos disponíveis
        if (!selectedType) {
          // Apenas mostrar categorias
          setOptions([]);
          setIsLoading(false);
          return;
        }

        const searchQuery = query.toLowerCase();

        switch (selectedType) {
          case 'user': {
            const { data } = await supabase
              .from('organization_members')
              .select('user_id, profiles!inner(first_name, last_name, avatar_url)')
              .eq('organization_id', tenantId)
              .limit(10);

            data?.forEach((member: any) => {
              const name = `${member.profiles?.first_name || ''} ${member.profiles?.last_name || ''}`.trim();
              if (!searchQuery || name.toLowerCase().includes(searchQuery)) {
                results.push({
                  id: member.user_id,
                  type: 'user',
                  display_name: name || 'Usuário',
                  avatar_url: member.profiles?.avatar_url,
                });
              }
            });
            break;
          }

          case 'lead': {
            const { data } = await supabase
              .from('leads')
              .select('id, name, email')
              .eq('organization_id', tenantId)
              .ilike('name', `%${searchQuery}%`)
              .limit(10);

            data?.forEach((lead) => {
              results.push({
                id: lead.id,
                type: 'lead',
                display_name: lead.name,
                subtitle: lead.email || undefined,
              });
            });
            break;
          }

          case 'demand': {
            const { data } = await supabase
              .from('demands')
              .select('id, title, urgency')
              .eq('organization_id', tenantId)
              .ilike('title', `%${searchQuery}%`)
              .limit(10);

            data?.forEach((demand: any) => {
              results.push({
                id: demand.id,
                type: 'demand',
                display_name: demand.title,
                subtitle: demand.urgency || undefined,
              });
            });
            break;
          }

          case 'product': {
            const { data } = await supabase
              .from('lead_products')
              .select('id, name, price_1_unit')
              .eq('organization_id', tenantId)
              .ilike('name', `%${searchQuery}%`)
              .limit(10);

            data?.forEach((product: any) => {
              results.push({
                id: product.id,
                type: 'product',
                display_name: product.name,
                subtitle: product.price_1_unit ? `R$ ${product.price_1_unit}` : undefined,
              });
            });
            break;
          }

          case 'sac': {
            const { data } = await supabase
              .from('sac_tickets')
              .select('id, description, status, category')
              .eq('organization_id', tenantId)
              .ilike('description', `%${searchQuery}%`)
              .limit(10);

            data?.forEach((ticket: any) => {
              results.push({
                id: ticket.id,
                type: 'sac',
                display_name: ticket.category || ticket.description?.substring(0, 50) || 'Ticket',
                subtitle: ticket.status || undefined,
              });
            });
            break;
          }
        }

        setOptions(results);
      } catch (error) {
        console.error('Error searching mentions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchOptions, 200);
    return () => clearTimeout(debounce);
  }, [open, selectedType, query, tenantId]);

  if (!open) return null;

  const typeCategories = [
    { type: 'user' as const, label: 'Pessoas', icon: User, color: 'text-blue-500' },
    { type: 'lead' as const, label: 'Leads', icon: Briefcase, color: 'text-green-500' },
    { type: 'demand' as const, label: 'Demandas', icon: FileText, color: 'text-orange-500' },
    { type: 'product' as const, label: 'Produtos', icon: Package, color: 'text-purple-500' },
    { type: 'sac' as const, label: 'SAC', icon: Headphones, color: 'text-pink-500' },
  ];

  const getIcon = (mentionType: TeamMentionData['type']) => {
    const category = typeCategories.find(c => c.type === mentionType);
    return category ? <category.icon className={cn("h-4 w-4", category.color)} /> : null;
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover border rounded-lg shadow-lg overflow-hidden z-50">
      {/* Se não tem tipo selecionado, mostrar categorias */}
      {!selectedType ? (
        <div className="p-2">
          <p className="text-xs text-muted-foreground px-2 py-1">
            Selecione o tipo de menção:
          </p>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {typeCategories.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors text-left"
              >
                <Icon className={cn("h-4 w-4", color)} />
                <span className="text-sm">@{label.toLowerCase()}:</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Header do tipo selecionado */}
          <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
            <div className="flex items-center gap-2">
              {getIcon(selectedType)}
              <span className="text-sm font-medium">
                @{typeCategories.find(c => c.type === selectedType)?.label.toLowerCase()}:
              </span>
            </div>
            <button
              onClick={() => setSelectedType(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Voltar
            </button>
          </div>

          {/* Lista de opções */}
          <ScrollArea className="max-h-[200px]">
            {isLoading ? (
              <div className="p-4 text-center">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : options.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {query ? `Nenhum resultado para "${query}"` : 'Digite para buscar...'}
              </div>
            ) : (
              <div className="p-1">
                {options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onSelect(option)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    {option.avatar_url ? (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={option.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {option.display_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                        {getIcon(option.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{option.display_name}</p>
                      {option.subtitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {option.subtitle}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}

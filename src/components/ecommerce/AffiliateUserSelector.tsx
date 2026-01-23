import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, UserPlus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { supabase } from '@/integrations/supabase/client';

interface MorphewsUser {
  user_id: string;
  full_name: string;
  email: string;
  organization_name: string;
}

interface AffiliateUserSelectorProps {
  value?: string;
  onChange: (userId: string | null, userData?: MorphewsUser) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AffiliateUserSelector({
  value,
  onChange,
  disabled,
  placeholder = 'Selecionar usuário Morphews...',
}: AffiliateUserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Search for Morphews users (profiles with organizations)
  const { data: users, isLoading } = useQuery({
    queryKey: ['morphews-users-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, organization_id')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      // Fetch org names separately
      const orgIds = [...new Set((data || []).map(p => p.organization_id).filter(Boolean))] as string[];
      let orgMap: Record<string, string> = {};
      
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
        orgMap = (orgs || []).reduce((acc, o) => ({ ...acc, [o.id]: o.name }), {});
      }

      return (data || []).map((profile) => ({
        user_id: profile.user_id,
        full_name: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Sem nome',
        email: profile.email || '',
        organization_name: profile.organization_id ? orgMap[profile.organization_id] || 'Sem organização' : 'Sem organização',
      })) as MorphewsUser[];
    },
    enabled: searchTerm.length >= 2,
  });

  // Get selected user info
  const { data: selectedUser } = useQuery({
    queryKey: ['morphews-user', value],
    queryFn: async () => {
      if (!value) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, organization_id')
        .eq('user_id', value)
        .single();

      if (error) return null;

      let orgName = 'Sem organização';
      if (data.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', data.organization_id)
          .single();
        orgName = org?.name || 'Sem organização';
      }

      return {
        user_id: data.user_id,
        full_name: [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Sem nome',
        email: data.email || '',
        organization_name: orgName,
      } as MorphewsUser;
    },
    enabled: !!value,
  });

  const handleSelect = (user: MorphewsUser) => {
    onChange(user.user_id, user);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedUser ? (
            <span className="truncate">
              {selectedUser.full_name} ({selectedUser.email})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {searchTerm.length < 2 ? (
              <CommandEmpty className="py-6 text-center text-sm">
                <Search className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Digite pelo menos 2 caracteres para buscar
                </p>
              </CommandEmpty>
            ) : isLoading ? (
              <CommandEmpty>Buscando...</CommandEmpty>
            ) : !users?.length ? (
              <CommandEmpty className="py-6 text-center text-sm">
                <UserPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground mb-1">
                  Nenhum usuário encontrado
                </p>
                <p className="text-xs text-muted-foreground">
                  O afiliado precisa ter conta na Morphews
                </p>
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Usuários Morphews">
                {users.map((user) => (
                  <CommandItem
                    key={user.user_id}
                    value={user.user_id}
                    onSelect={() => handleSelect(user)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        'h-4 w-4',
                        value === user.user_id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email} • {user.organization_name}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { useState, useMemo } from 'react';
import { Instagram } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface SocialSellingProfileFilterProps {
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string | null) => void;
  compact?: boolean;
}

export function SocialSellingProfileFilter({
  selectedProfileId,
  onSelectProfile,
  compact,
}: SocialSellingProfileFilterProps) {
  const { organizationId } = useTenant();

  const { data: profiles = [] } = useQuery({
    queryKey: ['social-selling-profiles-filter', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await (supabase as any)
        .from('social_selling_profiles')
        .select('id, instagram_username, display_name, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('instagram_username');
      return data || [];
    },
    enabled: !!organizationId,
  });

  if (profiles.length === 0) return null;

  return (
    <Select
      value={selectedProfileId || 'all'}
      onValueChange={(value) => onSelectProfile(value === 'all' ? null : value)}
    >
      <SelectTrigger className={compact ? 'w-[180px] h-9 text-xs' : 'w-[200px]'}>
        <div className="flex items-center gap-1.5">
          <Instagram className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Instagram Social" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os perfis</SelectItem>
        {profiles.map((p: any) => (
          <SelectItem key={p.id} value={p.id}>
            @{p.instagram_username}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

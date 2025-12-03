import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  instagram: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name');

      if (error) throw error;
      return data as UserProfile[];
    },
  });
}

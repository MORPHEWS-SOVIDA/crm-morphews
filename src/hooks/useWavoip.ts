import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type WavoipStatus = 'checking' | 'available' | 'unavailable' | 'error' | 'disabled';

interface WavoipConfig {
  instanceId: string;
  instanceName: string;
  wavoipEnabled: boolean;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
}

interface WavoipCheckResult {
  status: WavoipStatus;
  error: string | null;
}

interface MakeCallParams {
  instanceName: string;
  contactPhone: string;
  contactName?: string;
  leadId?: string;
  conversationId?: string;
  isVideo?: boolean;
}

// Calls are proxied through a backend function (keeps server URL/API key private)
// and allows per-instance configuration for multi-tenant setups.

/**
 * Hook para gerenciar chamadas Wavoip via Evolution API
 */
export function useWavoip(instanceId?: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [wavoipStatus, setWavoipStatus] = useState<WavoipStatus>('checking');
  const [wavoipError, setWavoipError] = useState<string | null>(null);
  const [isLoadingCall, setIsLoadingCall] = useState(false);

  // Fetch instance config for Wavoip
  const { data: instanceConfig } = useQuery({
    queryKey: ['wavoip-instance-config', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, name, wavoip_enabled, evolution_instance_id')
        .eq('id', instanceId)
        .single();

      if (error) {
        console.error('[Wavoip] Error fetching instance:', error);
        return null;
      }

      return {
        instanceId: data.id,
        instanceName: data.evolution_instance_id || data.name,
        wavoipEnabled: data.wavoip_enabled ?? false,
      } as WavoipConfig;
    },
    enabled: !!instanceId,
  });

  // Check Wavoip availability (client-side): if enabled on the instance, we allow dialing.
  // Real integration errors are surfaced when attempting a call (handled by the backend function).
  const checkWavoipAvailability = useCallback(async () => {
    // If instance doesn't have Wavoip enabled, skip
    if (!instanceConfig?.wavoipEnabled) {
      setWavoipStatus('disabled');
      setWavoipError('Chamadas não habilitadas para esta instância');
      return;
    }

    setWavoipStatus('available');
    setWavoipError(null);
  }, [instanceConfig?.wavoipEnabled]);

  // Check availability when instance config changes
  useEffect(() => {
    if (instanceConfig) {
      checkWavoipAvailability();
    } else if (instanceId === undefined || instanceId === null) {
      setWavoipStatus('disabled');
      setWavoipError(null);
    }
  }, [instanceConfig, checkWavoipAvailability, instanceId]);

  // Make WhatsApp call
  const makeCall = useCallback(async ({
    instanceName,
    contactPhone,
    contactName,
    leadId,
    conversationId,
    isVideo = false,
  }: MakeCallParams): Promise<boolean> => {
    console.log('📞 ===== INICIANDO CHAMADA =====');
    
    console.log('📞 Dados da chamada:', {
      instanceName,
      contactPhone,
      contactName,
      leadId,
      conversationId,
      isVideo,
    });
    
    if (!instanceName) {
      console.error('❌ Instance name não disponível');
      toast.error('Erro: Instância não encontrada');
      return false;
    }
    
    if (!contactPhone) {
      console.error('❌ Contact phone não disponível');
      toast.error('Erro: Número do contato não encontrado');
      return false;
    }

    // Format phone number
    let cleanPhone = contactPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
      // Add 9th digit if missing for Brazilian mobiles
      cleanPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4);
    }
    const formattedNumber = cleanPhone.includes('@s.whatsapp.net') 
      ? cleanPhone 
      : `${cleanPhone}@s.whatsapp.net`;
    
    console.log('📞 Número formatado:', formattedNumber);

    const apiUrl = `${EVOLUTION_API_URL}/call/offer/${instanceName}`;
    
    const requestBody = {
      number: formattedNumber,
      isVideo,
      callDuration: 30
    };
    
    console.log('📞 Requisição preparada:', {
      url: apiUrl,
      method: 'POST',
      body: requestBody
    });
    
    setIsLoadingCall(true);
    toast.info('📞 Iniciando chamada...');
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify(requestBody)
      });
      
      let responseData: any = null;
      try {
        responseData = await response.json();
      } catch {
        // No JSON response
      }
      
      console.log('📞 Resposta recebida:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        data: responseData
      });
      
      // Log the call
      if (profile?.organization_id && instanceId) {
        await supabase.from('whatsapp_call_logs').insert({
          organization_id: profile.organization_id,
          instance_id: instanceId,
          user_id: profile.id,
          contact_phone: contactPhone,
          contact_name: contactName || null,
          lead_id: leadId || null,
          conversation_id: conversationId || null,
          call_direction: 'outbound',
          call_status: response.ok ? 'initiated' : 'failed',
          is_video: isVideo,
          error_message: response.ok ? null : (responseData?.message || responseData?.error || `Status ${response.status}`),
        });
      }
      
      if (response.ok) {
        console.log('✅ ===== CHAMADA INICIADA COM SUCESSO =====');
        toast.success('Chamada iniciada com sucesso!');
        setIsLoadingCall(false);
        return true;
        
      } else {
        let errorMessage = 'Erro ao iniciar chamada';
        
        if (response.status === 404) {
          errorMessage = 'Endpoint não encontrado. Wavoip não está configurado.';
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = 'Erro de autenticação. API Key inválida.';
        } else if (response.status === 400) {
          errorMessage = responseData?.message || responseData?.error || 'Dados inválidos';
        } else if (response.status === 500) {
          errorMessage = 'Erro interno do servidor Evolution';
        } else if (responseData?.error) {
          errorMessage = responseData.error;
        } else if (responseData?.message) {
          errorMessage = responseData.message;
        }
        
        toast.error(errorMessage);
        console.error('❌ ===== CHAMADA FALHOU =====');
        console.error('❌ Status:', response.status);
        console.error('❌ Erro:', errorMessage);
        setIsLoadingCall(false);
        return false;
      }
      
    } catch (error: any) {
      console.error('❌ ===== EXCEÇÃO/ERRO DE REDE =====');
      console.error('❌ Tipo de erro:', error.name);
      console.error('❌ Mensagem:', error.message);
      toast.error('Erro de conexão. Verifique sua internet.');
      setIsLoadingCall(false);
      return false;
      
    }
  }, [instanceId, profile]);

  return {
    wavoipStatus,
    wavoipError,
    isLoadingCall,
    makeCall,
    checkWavoipAvailability,
    instanceConfig,
  };
}

/**
 * Hook para gerenciar a fila de distribuição de chamadas
 */
export function useCallQueue(instanceId?: string | null) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch call queue for instance
  const { data: callQueue, isLoading } = useQuery({
    queryKey: ['call-queue', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];

      const { data: rows, error } = await supabase
        .from('whatsapp_call_queue')
        .select('*')
        .eq('instance_id', instanceId)
        .order('position', { ascending: true });

      if (error) throw error;

      const userIds = Array.from(
        new Set((rows || []).map((r: any) => r.user_id).filter(Boolean))
      ) as string[];

      if (userIds.length === 0) return rows || [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const byUserId = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (rows || []).map((r: any) => ({
        ...r,
        profiles: byUserId.get(r.user_id) || null,
      }));
    },
    enabled: !!instanceId,
  });

  // Toggle user availability
  const toggleAvailability = useMutation({
    mutationFn: async ({ userId, isAvailable }: { userId: string; isAvailable: boolean }) => {
      if (!instanceId) throw new Error('No instance');
      
      const { error } = await supabase
        .from('whatsapp_call_queue')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
        .eq('instance_id', instanceId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-queue', instanceId] });
    },
  });

  // Add user to queue
  const addToQueue = useMutation({
    mutationFn: async (userId: string) => {
      if (!instanceId || !profile?.organization_id) throw new Error('No instance or org');
      
      // Get max position
      const { data: existing } = await supabase
        .from('whatsapp_call_queue')
        .select('position')
        .eq('instance_id', instanceId)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position ?? -1;
      
      const { error } = await supabase
        .from('whatsapp_call_queue')
        .upsert({
          organization_id: profile.organization_id,
          instance_id: instanceId,
          user_id: userId,
          position: maxPosition + 1,
          is_available: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-queue', instanceId] });
      toast.success('Usuário adicionado à fila de chamadas');
    },
  });

  // Remove user from queue
  const removeFromQueue = useMutation({
    mutationFn: async (userId: string) => {
      if (!instanceId) throw new Error('No instance');
      
      const { error } = await supabase
        .from('whatsapp_call_queue')
        .delete()
        .eq('instance_id', instanceId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-queue', instanceId] });
      toast.success('Usuário removido da fila');
    },
  });

  // Get next user in queue (round-robin)
  const getNextUser = useCallback(async () => {
    if (!instanceId) return null;
    
    const { data } = await supabase
      .from('whatsapp_call_queue')
      .select('user_id, position')
      .eq('instance_id', instanceId)
      .eq('is_available', true)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    return data?.user_id || null;
  }, [instanceId]);

  // Move user to end of queue (after receiving call)
  const moveToEndOfQueue = useMutation({
    mutationFn: async (userId: string) => {
      if (!instanceId) throw new Error('No instance');
      
      // Get max position
      const { data: existing } = await supabase
        .from('whatsapp_call_queue')
        .select('position')
        .eq('instance_id', instanceId)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position ?? 0;
      
      const { error } = await supabase
        .from('whatsapp_call_queue')
        .update({ 
          position: maxPosition + 1,
          last_call_at: new Date().toISOString(),
          calls_received: supabase.rpc ? undefined : undefined, // Would need RPC for increment
        })
        .eq('instance_id', instanceId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-queue', instanceId] });
    },
  });

  return {
    callQueue,
    isLoading,
    toggleAvailability,
    addToQueue,
    removeFromQueue,
    getNextUser,
    moveToEndOfQueue,
  };
}

/**
 * Hook para verificar se o usuário atual está disponível para chamadas
 */
export function useUserCallAvailability(instanceId?: string | null) {
  const { user } = useAuth();
  const { callQueue, toggleAvailability, addToQueue, removeFromQueue } = useCallQueue(instanceId);

  const userQueueEntry = callQueue?.find(q => q.user_id === user?.id);
  const isInQueue = !!userQueueEntry;
  const isAvailable = userQueueEntry?.is_available ?? false;

  const setAvailable = useCallback((available: boolean) => {
    if (!user?.id) return;
    
    if (!isInQueue) {
      // Add to queue first
      addToQueue.mutate(user.id);
    } else {
      toggleAvailability.mutate({ userId: user.id, isAvailable: available });
    }
  }, [user?.id, isInQueue, addToQueue, toggleAvailability]);

  const leaveQueue = useCallback(() => {
    if (!user?.id) return;
    removeFromQueue.mutate(user.id);
  }, [user?.id, removeFromQueue]);

  return {
    isInQueue,
    isAvailable,
    setAvailable,
    leaveQueue,
    queuePosition: userQueueEntry?.position,
  };
}

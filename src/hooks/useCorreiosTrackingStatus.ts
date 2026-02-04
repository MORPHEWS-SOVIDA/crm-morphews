import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TrackingEvent {
  type: string;
  status: string;
  date: string;
  time: string;
  location: string;
  description: string;
}

export interface TrackingStatusResult {
  tracking_code: string;
  current_status: string;
  last_update: string;
  location: string;
  delivered: boolean;
  events: TrackingEvent[];
  error?: string;
}

export function useCorreiosTrackingStatus() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [statuses, setStatuses] = useState<Record<string, TrackingStatusResult>>({});

  const fetchStatus = useCallback(async (trackingCode: string): Promise<TrackingStatusResult | null> => {
    if (!trackingCode) return null;
    
    // Check if it's a valid Correios code (not a UUID)
    const isValidCode = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/i.test(trackingCode);
    if (!isValidCode) {
      return {
        tracking_code: trackingCode,
        current_status: 'Código não é do Correios',
        last_update: '',
        location: '',
        delivered: false,
        events: [],
        error: 'Formato inválido',
      };
    }

    setLoading(prev => ({ ...prev, [trackingCode]: true }));

    try {
      const { data, error } = await supabase.functions.invoke('correios-tracking-status', {
        body: { tracking_code: trackingCode.toUpperCase() },
      });

      if (error) throw error;

      const result = data as TrackingStatusResult;
      setStatuses(prev => ({ ...prev, [trackingCode]: result }));
      return result;
    } catch (err) {
      console.error('[useCorreiosTrackingStatus] Error:', err);
      const result: TrackingStatusResult = {
        tracking_code: trackingCode,
        current_status: 'Erro ao consultar',
        last_update: '',
        location: '',
        delivered: false,
        events: [],
        error: 'Falha na consulta',
      };
      setStatuses(prev => ({ ...prev, [trackingCode]: result }));
      return result;
    } finally {
      setLoading(prev => ({ ...prev, [trackingCode]: false }));
    }
  }, []);

  const getCorreiosTrackingUrl = useCallback((trackingCode: string): string => {
    // Direct link to Correios tracking page
    return `https://rastreamento.correios.com.br/app/index.php?objetos=${trackingCode}`;
  }, []);

  return {
    loading,
    statuses,
    fetchStatus,
    getCorreiosTrackingUrl,
  };
}

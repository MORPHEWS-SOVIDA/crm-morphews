import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);

  const checkConnection = useCallback(async () => {
    if (!user) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-api', {
        body: { action: 'checkConnection' },
      });

      if (error || data?.needsAuth) {
        setIsConnected(false);
      } else {
        setIsConnected(true);
      }
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkConnection();

    // Listen for connection success from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_CALENDAR_CONNECTED') {
        setIsConnected(true);
        checkConnection();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkConnection]);

  const connect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth');
      
      if (error) throw error;
      
      if (data?.url) {
        // Open in popup
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
          data.url,
          'Google Calendar Auth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      throw error;
    }
  };

  const disconnect = async () => {
    if (!user) return;

    try {
      // Remove tokens from database
      const { error } = await supabase
        .from('google_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      setIsConnected(false);
      setEvents([]);
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      throw error;
    }
  };

  const listEvents = async (timeMin?: string, timeMax?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-api', {
        body: { action: 'listEvents', timeMin, timeMax },
      });

      if (error) throw error;
      
      setEvents(data?.events || []);
      return data?.events || [];
    } catch (error) {
      console.error('Error listing events:', error);
      throw error;
    }
  };

  const createEvent = async (params: {
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    attendees?: string[];
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-api', {
        body: { action: 'createEvent', ...params },
      });

      if (error) throw error;
      
      return data?.event;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  };

  const updateEvent = async (eventId: string, params: {
    summary?: string;
    description?: string;
    start?: string;
    end?: string;
    location?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-api', {
        body: { action: 'updateEvent', eventId, ...params },
      });

      if (error) throw error;
      
      return data?.event;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-api', {
        body: { action: 'deleteEvent', eventId },
      });

      if (error) throw error;
      
      return data?.success;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  };

  return {
    isConnected,
    isLoading,
    events,
    connect,
    disconnect,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    checkConnection,
  };
}

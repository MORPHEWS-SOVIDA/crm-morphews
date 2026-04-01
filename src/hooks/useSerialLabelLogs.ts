import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  organization_id: string;
  serial_code?: string;
  action: string;
  details?: Record<string, any>;
  user_id?: string;
  sale_id?: string;
  success?: boolean;
  error_message?: string;
}

export async function logSerialAction(entry: LogEntry) {
  try {
    await supabase.from('serial_label_logs').insert({
      organization_id: entry.organization_id,
      serial_code: entry.serial_code || null,
      action: entry.action,
      details: entry.details || {},
      user_id: entry.user_id || null,
      sale_id: entry.sale_id || null,
      success: entry.success ?? true,
      error_message: entry.error_message || null,
    } as any);
  } catch {
    console.error('Failed to log serial action');
  }
}

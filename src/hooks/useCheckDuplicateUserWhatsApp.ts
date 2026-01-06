import { supabase } from '@/integrations/supabase/client';

export interface DuplicateUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  whatsapp: string;
  organization_id: string;
}

/**
 * Normalizes a Brazilian phone number to always have 55 + DD + 9 + 8 digits
 */
function normalizeWhatsApp(phone: string): string {
  let clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  
  // Add country code if not present
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  // Add 9th digit if needed (12 digits should become 13)
  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }
  
  return clean;
}

/**
 * Checks if a WhatsApp number already exists for another user in ANY organization
 * This ensures WhatsApp uniqueness across all tenants for user identification
 * @param whatsapp - The WhatsApp number to check
 * @param excludeUserId - Optional user ID to exclude (useful when editing own profile)
 * @returns The duplicate user info if found, null otherwise
 */
export async function checkDuplicateUserWhatsApp(
  whatsapp: string,
  excludeUserId?: string
): Promise<DuplicateUserInfo | null> {
  if (!whatsapp || whatsapp.trim() === '') {
    return null;
  }

  // Normalize the phone number
  const normalizedPhone = normalizeWhatsApp(whatsapp);
  
  if (normalizedPhone.length < 10) {
    return null;
  }

  // Query for existing profile with same WhatsApp in any organization
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, whatsapp, organization_id')
    .eq('whatsapp', normalizedPhone)
    .limit(1);

  // Exclude current user if editing
  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error checking duplicate user WhatsApp:', error);
    return null;
  }

  if (data) {
    return {
      id: data.id,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      whatsapp: data.whatsapp,
      organization_id: data.organization_id,
    };
  }

  return null;
}

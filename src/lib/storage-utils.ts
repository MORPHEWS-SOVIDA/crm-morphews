import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Extract the file path from a full Supabase storage URL or relative path
 */
export function extractStorageFilePath(urlOrPath: string, bucket: string = 'sales-documents'): string {
  // If it's already just a path (like "temp/payment_proof_xxx.jpeg"), return as is
  if (!urlOrPath.includes('supabase.co')) {
    return urlOrPath;
  }
  
  // Extract path from full URL
  // Format: https://xxx.supabase.co/storage/v1/object/public/sales-documents/SALE_ID/filename
  // Or: https://xxx.supabase.co/storage/v1/object/sign/sales-documents/path?token=xxx
  const pattern = new RegExp(`/${bucket}/(.+?)(?:\\?|$)`);
  const match = urlOrPath.match(pattern);
  return match ? match[1] : urlOrPath;
}

/**
 * Get a signed URL for viewing/downloading private files from Supabase Storage
 */
export async function getSignedStorageUrl(
  urlOrPath: string, 
  bucket: string = 'sales-documents',
  expiresIn: number = 3600
): Promise<string | null> {
  const filePath = extractStorageFilePath(urlOrPath, bucket);
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);
  
  if (error || !data?.signedUrl) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  
  return data.signedUrl;
}

/**
 * Open a private storage file in a new tab with signed URL
 */
export async function openStorageFile(
  urlOrPath: string, 
  bucket: string = 'sales-documents'
): Promise<void> {
  const signedUrl = await getSignedStorageUrl(urlOrPath, bucket);
  
  if (signedUrl) {
    window.open(signedUrl, '_blank');
  } else {
    toast.error('Erro ao abrir arquivo');
  }
}

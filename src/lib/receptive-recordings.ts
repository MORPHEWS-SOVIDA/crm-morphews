// Small helpers for handling URLs generated from the 'receptive-recordings' storage bucket.

const SIGNED_PREFIX = "/storage/v1/object/sign/receptive-recordings/";
const PUBLIC_PREFIX = "/storage/v1/object/public/receptive-recordings/";

/**
 * Extracts the storage path (inside the bucket) from a signed/public URL.
 * Returns null for external URLs.
 */
export function extractReceptiveRecordingStoragePath(audioUrl?: string | null): string | null {
  if (!audioUrl) return null;

  try {
    const url = new URL(audioUrl);
    const p = url.pathname;

    const signedIdx = p.indexOf(SIGNED_PREFIX);
    if (signedIdx !== -1) {
      const raw = p.slice(signedIdx + SIGNED_PREFIX.length);
      return decodeURIComponent(raw);
    }

    const publicIdx = p.indexOf(PUBLIC_PREFIX);
    if (publicIdx !== -1) {
      const raw = p.slice(publicIdx + PUBLIC_PREFIX.length);
      return decodeURIComponent(raw);
    }

    return null;
  } catch {
    // If it's not a valid URL, ignore.
    return null;
  }
}

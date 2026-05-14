const AUTH_NETWORK_ISSUE_KEY = 'atomic_auth_network_issue';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

function getProjectRefFromUrl(url?: string) {
  if (!url) return null;
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function getAuthStorageKeys(storage: Storage) {
  const keys = new Set<string>();
  const projectRef = getProjectRefFromUrl(SUPABASE_URL);
  if (projectRef) keys.add(`sb-${projectRef}-auth-token`);

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

function getStoredExpirySeconds(raw: string | null): number | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession ?? parsed?.session ?? parsed;
    const explicitExpiry = session?.expires_at ?? session?.expiresAt ?? parsed?.expires_at ?? parsed?.expiresAt;

    if (typeof explicitExpiry === 'number') {
      return explicitExpiry > 10_000_000_000 ? Math.floor(explicitExpiry / 1000) : explicitExpiry;
    }

    if (typeof session?.access_token === 'string') {
      const payload = session.access_token.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
      return typeof decoded?.exp === 'number' ? decoded.exp : null;
    }
  } catch {
    return 0;
  }

  return null;
}

export function isAuthNetworkError(errorOrMessage?: unknown) {
  const message = String(
    typeof errorOrMessage === 'string'
      ? errorOrMessage
      : (errorOrMessage as { message?: string; name?: string })?.message || (errorOrMessage as { name?: string })?.name || ''
  ).toLowerCase();

  return (
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('network request failed') ||
    message.includes('authretryablefetcherror') ||
    message.includes('err_name_not_resolved') ||
    message.includes('name_not_resolved') ||
    message.includes('dns_probe') ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
}

export function rememberAuthNetworkIssue(message: string) {
  try {
    sessionStorage.setItem(
      AUTH_NETWORK_ISSUE_KEY,
      JSON.stringify({ message, at: new Date().toISOString(), href: window.location.href })
    );
  } catch {
    // Ignore storage errors in private browsing / locked-down devices.
  }
}

export function consumeAuthNetworkIssue() {
  try {
    const raw = sessionStorage.getItem(AUTH_NETWORK_ISSUE_KEY);
    sessionStorage.removeItem(AUTH_NETWORK_ISSUE_KEY);
    return raw ? (JSON.parse(raw) as { message: string; at: string; href: string }) : null;
  } catch {
    return null;
  }
}

export function clearSupabaseAuthStorage(reason = 'Sessão local limpa por falha de conexão com o backend.') {
  const message = reason || 'Falha de conexão com o backend.';
  rememberAuthNetworkIssue(message);

  try {
    getAuthStorageKeys(localStorage).forEach((key) => localStorage.removeItem(key));
    getAuthStorageKeys(sessionStorage).forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage can be unavailable on some browsers; auth calls will still surface the original error.
  }
}

export function pruneExpiredSupabaseAuthSession() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const expiryMarginSeconds = 120;

    getAuthStorageKeys(localStorage).forEach((key) => {
      const expiresAt = getStoredExpirySeconds(localStorage.getItem(key));
      if (expiresAt !== null && expiresAt <= now + expiryMarginSeconds) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Best-effort guard only. Never block app startup because of localStorage parsing.
  }
}

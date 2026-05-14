import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Activity, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

type ProbeStatus = 'idle' | 'running' | 'ok' | 'fail';

interface ProbeResult {
  name: string;
  url: string;
  status: ProbeStatus;
  detail?: string;
  ms?: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

async function timedFetch(url: string, init?: RequestInit, timeoutMs = 8000): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const start = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    return { ok: res.ok || res.status === 401 || res.status === 400, status: res.status, ms: Math.round(performance.now() - start) };
  } catch (e: any) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - start), error: e?.message || 'network error' };
  } finally {
    clearTimeout(t);
  }
}

interface ConnectivityProbeProps {
  autoRun?: boolean;
  defaultOpen?: boolean;
  triggerError?: string;
}

export function ConnectivityProbe({ autoRun = false, defaultOpen = false, triggerError }: ConnectivityProbeProps = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [running, setRunning] = useState(false);

  const tests: { name: string; url: string; init?: RequestInit }[] = [
    { name: 'App (atomic.ia.br)', url: window.location.origin + '/favicon.ico' },
    { name: 'Backend Auth (health)', url: `${SUPABASE_URL}/auth/v1/health`, init: { headers: { apikey: SUPABASE_KEY } } },
    { name: 'Backend Auth (token endpoint)', url: `${SUPABASE_URL}/auth/v1/token?grant_type=password`, init: { method: 'POST', headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: '{}' } },
    { name: 'Backend REST (database)', url: `${SUPABASE_URL}/rest/v1/`, init: { headers: { apikey: SUPABASE_KEY } } },
    { name: 'Backend Functions', url: `${SUPABASE_URL}/functions/v1/`, init: { headers: { apikey: SUPABASE_KEY } } },
    { name: 'CDN (Lovable)', url: 'https://lovable.dev/favicon.ico' },
  ];

  const run = async () => {
    setRunning(true);
    setResults(tests.map(t => ({ name: t.name, url: t.url, status: 'running' as ProbeStatus })));
    const out: ProbeResult[] = [];
    for (const t of tests) {
      const r = await timedFetch(t.url, t.init);
      out.push({
        name: t.name,
        url: t.url,
        status: r.ok ? 'ok' : 'fail',
        detail: r.error ? `❌ ${r.error}` : `HTTP ${r.status}`,
        ms: r.ms,
      });
      setResults([...out, ...tests.slice(out.length).map(rest => ({ name: rest.name, url: rest.url, status: 'running' as ProbeStatus }))]);
    }
    setRunning(false);
  };

  const copyReport = () => {
    const ua = navigator.userAgent;
    const lines = [
      `Diagnóstico Atomic — ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `Navegador: ${ua}`,
      `Online: ${navigator.onLine}`,
      triggerError ? `Erro do login: ${triggerError}` : '',
      '',
      ...results.map(r => `${r.status === 'ok' ? '✅' : '❌'} ${r.name} — ${r.detail} (${r.ms}ms)`),
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines);
    toast({ title: 'Copiado!', description: 'Cole no chat de suporte.' });
  };

  useEffect(() => {
    if (autoRun && results.length === 0 && !running) {
      setOpen(true);
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); run(); }}
        className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mx-auto"
      >
        <Activity className="w-3 h-3" />
        Não consegue acessar? Testar conexão
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border bg-muted/30 text-left space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4" /> Diagnóstico de conexão
        </h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={run} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
          {running ? 'Testando...' : 'Iniciar teste'}
        </Button>
        {results.length > 0 && !running && (
          <Button size="sm" variant="outline" onClick={copyReport} className="gap-2">
            <Copy className="w-3 h-3" /> Copiar relatório
          </Button>
        )}
      </div>

      {results.length > 0 && (
        <ul className="space-y-1.5 text-xs">
          {results.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              {r.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
              {r.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
              {r.status === 'fail' && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
              <span className="font-medium">{r.name}</span>
              {r.detail && <span className="text-muted-foreground">— {r.detail}</span>}
              {typeof r.ms === 'number' && <span className="text-muted-foreground ml-auto">{r.ms}ms</span>}
            </li>
          ))}
        </ul>
      )}

      {results.some(r => r.status === 'fail') && !running && (() => {
        const dnsFailed = results.some(r => r.detail?.includes('NAME_NOT_RESOLVED') || r.detail?.includes('Failed to fetch') || r.detail?.includes('network error'));
        return (
          <div className="text-xs space-y-2 border-t pt-2">
            {dnsFailed && (
              <div className="p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive">
                <p className="font-bold">🔴 DNS bloqueado pela sua rede</p>
                <p className="text-foreground/80 mt-1">Seu provedor de internet (ou antivírus) está impedindo o navegador de encontrar nosso servidor.</p>
              </div>
            )}
            <div className="text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Como resolver (faça nesta ordem):</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li><strong>Troque o DNS para 1.1.1.1</strong> (Cloudflare) — Painel de Controle → Rede → Adaptador → IPv4 → DNS preferencial: <code className="bg-muted px-1">1.1.1.1</code></li>
                <li><strong>Teste no 4G do celular</strong> (compartilhar internet) — se funcionar, é a sua rede</li>
                <li><strong>Desative o antivírus</strong> temporariamente (Kaspersky, ESET, McAfee inspecionam HTTPS)</li>
                <li><strong>Tente outro navegador</strong> (Edge, Firefox) ou modo anônimo</li>
                <li>Se nada funcionar, copie o relatório acima e envie ao suporte</li>
              </ol>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

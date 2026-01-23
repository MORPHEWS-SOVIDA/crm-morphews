import { Globe, CheckCircle, Copy, ExternalLink, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DomainRecord {
  type: string;
  name: string;
  value: string;
}

const DNS_RECORDS: DomainRecord[] = [
  { type: 'A', name: '@', value: '185.158.133.1' },
  { type: 'A', name: 'www', value: '185.158.133.1' },
  { type: 'TXT', name: '_lovable', value: 'lovable_verify=SEU_TOKEN' },
];

export function CustomDomainGuide() {
  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Copiado!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Globe className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Domínio Personalizado</h2>
          <p className="text-muted-foreground">Configure seu domínio próprio para sua loja</p>
        </div>
      </div>

      {/* Step 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge>1</Badge>
            Acessar Configurações
          </CardTitle>
          <CardDescription>
            Vá em Configurações do Projeto → Domínios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" asChild>
            <a href="https://lovable.dev/projects" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir Lovable Dashboard
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge>2</Badge>
            Configurar DNS no seu Provedor
          </CardTitle>
          <CardDescription>
            Adicione os seguintes registros DNS no painel do seu domínio (GoDaddy, Hostinger, Cloudflare, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Nome</th>
                  <th className="px-4 py-2 text-left font-medium">Valor</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {DNS_RECORDS.map((record, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-3">
                      <Badge variant="outline">{record.type}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{record.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{record.value}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(record.value)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Importante:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Adicione AMBOS os registros: <code className="bg-background px-1 rounded">@</code> (raiz) e <code className="bg-background px-1 rounded">www</code></li>
                <li>O token TXT será gerado automaticamente no dashboard</li>
                <li>Remova registros A antigos que apontem para outros IPs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge>3</Badge>
            Aguardar Propagação
          </CardTitle>
          <CardDescription>
            A propagação DNS pode levar até 72 horas (geralmente 15-30 minutos)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span>SSL (HTTPS) é provisionado automaticamente após verificação</span>
          </div>

          <Button variant="outline" className="gap-2" asChild>
            <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Verificar Propagação DNS
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Status Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Status do Domínio</CardTitle>
          <CardDescription>Significado de cada status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { status: 'Active', color: 'bg-green-500', desc: 'Domínio funcionando normalmente' },
              { status: 'Ready', color: 'bg-blue-500', desc: 'DNS correto, aguardando publicação' },
              { status: 'Verifying', color: 'bg-amber-500', desc: 'Verificando registros DNS' },
              { status: 'Setting up', color: 'bg-purple-500', desc: 'Gerando certificado SSL' },
              { status: 'Offline', color: 'bg-red-500', desc: 'DNS alterado, precisa correção' },
              { status: 'Failed', color: 'bg-red-500', desc: 'Erro no SSL, clique em Retry' },
            ].map((item) => (
              <div key={item.status} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="font-medium w-24">{item.status}</span>
                <span className="text-sm text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Success */}
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
        <CardContent className="flex items-center gap-4 p-6">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <div>
            <p className="font-medium">Após configuração bem-sucedida</p>
            <p className="text-sm text-muted-foreground">
              Sua loja estará acessível em seudominio.com.br com SSL automático
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

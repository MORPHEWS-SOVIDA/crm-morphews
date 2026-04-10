import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Tag, ClipboardList, RotateCcw, ScanLine, Search, Upload, FileText, Package } from 'lucide-react';

const sections = [
  {
    title: 'Ver Estoque',
    description: 'Veja todas as etiquetas registradas e vinculadas a produtos',
    icon: Package,
    href: '/expedicao/etiquetas-seriais/estoque',
    color: 'text-emerald-600',
  },
  {
    title: 'Associar ao Produto',
    description: 'Vincule etiquetas a um produto e registre entrada no estoque',
    icon: Tag,
    href: '/expedicao/etiquetas-seriais/associar',
    color: 'text-green-600',
  },
  {
    title: 'Separação de Pedido',
    description: 'Escaneie QR codes para validar a separação de uma venda',
    icon: ClipboardList,
    href: '/expedicao/etiquetas-seriais/separacao',
    color: 'text-blue-600',
  },
  {
    title: 'Devolução',
    description: 'Escaneie produtos devolvidos para retornar ao estoque',
    icon: RotateCcw,
    href: '/expedicao/etiquetas-seriais/devolucao',
    color: 'text-purple-600',
  },
  {
    title: 'Scanner / Consulta',
    description: 'Consulte o status de qualquer etiqueta via QR ou código',
    icon: ScanLine,
    href: '/expedicao/etiquetas-seriais/scanner',
    color: 'text-orange-600',
  },
  {
    title: 'Buscar Etiquetas',
    description: 'Pesquise etiquetas por código ou parte do código',
    icon: Search,
    href: '/expedicao/etiquetas-seriais/buscar',
    color: 'text-muted-foreground',
  },
  {
    title: 'Registrar Lote',
    description: 'Cadastre um lote de etiquetas novas no sistema',
    icon: Upload,
    href: '/expedicao/etiquetas-seriais/registrar-lote',
    color: 'text-primary',
  },
  {
    title: 'Logs / Auditoria',
    description: 'Histórico de scans, registros, erros e rastreabilidade completa',
    icon: FileText,
    href: '/expedicao/etiquetas-seriais/logs',
    color: 'text-muted-foreground',
  },
];

export default function SerialLabelsIndexPage() {
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <QrCode className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Etiquetas Seriais</h1>
          <p className="text-sm text-muted-foreground">Rastreabilidade unitária de produtos</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} to={s.href}>
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{s.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

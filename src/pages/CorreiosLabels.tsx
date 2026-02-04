import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  Settings, 
  Tag, 
  Printer, 
  Search,
  Download,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  FileText
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  useCorreiosLabels, 
  usePendingCorreiosSales, 
  useCorreiosConfig,
  useGenerateCorreiosLabel,
  CorreiosLabel
} from '@/hooks/useCorreiosIntegration';
import { CorreiosConfigDialog } from '@/components/correios/CorreiosConfigDialog';
import { CorreiosLabelGenerator } from '@/components/correios/CorreiosLabelGenerator';
import { formatCurrency } from '@/hooks/useSales';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMelhorEnvioLabelDownload } from '@/hooks/useMelhorEnvioLabelDownload';
import { useAuth } from '@/hooks/useAuth';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600', icon: <Clock className="w-3 h-3" /> },
  generated: { label: 'Gerada', color: 'bg-green-500/10 text-green-600', icon: <CheckCircle className="w-3 h-3" /> },
  posted: { label: 'Postada', color: 'bg-blue-500/10 text-blue-600', icon: <Truck className="w-3 h-3" /> },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/10 text-red-600', icon: <XCircle className="w-3 h-3" /> },
};

export default function CorreiosLabels() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false);

  const { data: config, isLoading: configLoading } = useCorreiosConfig();
  const { data: labels, isLoading: labelsLoading, refetch: refetchLabels } = useCorreiosLabels();
  const { data: pendingSales, isLoading: salesLoading, refetch: refetchSales } = usePendingCorreiosSales();
  const generateLabel = useGenerateCorreiosLabel();
  const { profile } = useAuth();
  const { downloadLabel, isDownloading: isDownloadingLabel } = useMelhorEnvioLabelDownload();

  const filteredLabels = labels?.filter(label => 
    label.tracking_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    label.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    label.recipient_city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSales = pendingSales?.filter(sale =>
    sale.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.lead?.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(sale.romaneio_number || '').includes(searchTerm)
  );

  const handleGenerateLabel = (sale: any) => {
    setSelectedSale(sale);
    setShowGeneratorDialog(true);
  };

  const handleLabelGenerated = () => {
    setShowGeneratorDialog(false);
    setSelectedSale(null);
    refetchLabels();
    refetchSales();
  };

  const isConfigured = config?.is_active && config?.id_correios && config?.cartao_postagem;

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/expedicao')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Package className="w-6 h-6 text-primary" />
                Etiquetas Correios
              </h1>
              <p className="text-sm text-muted-foreground">
                Gere e gerencie etiquetas de envio automaticamente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          </div>
        </div>

        {/* Status Card */}
        <Card className={isConfigured ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isConfigured ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-600" />
                )}
                <div>
                  <p className="font-medium">
                    {isConfigured ? 'Integração ativa' : 'Configuração pendente'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isConfigured 
                      ? `Ambiente: ${config?.ambiente} | Contrato: ${config?.contrato || 'N/A'}`
                      : 'Configure suas credenciais do Correios para começar'}
                  </p>
                </div>
              </div>
              {!isConfigured && (
                <Button onClick={() => setShowConfigDialog(true)}>
                  Configurar agora
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Tag className="w-4 h-4" />
                Pendentes
                {pendingSales && pendingSales.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {pendingSales.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <FileText className="w-4 h-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => {
                  refetchLabels();
                  refetchSales();
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Pending Sales Tab */}
          <TabsContent value="pending" className="mt-6">
            {salesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !filteredSales?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">Nenhuma venda pendente de etiqueta</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Vendas com transportadora e sem código de rastreio aparecerão aqui
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredSales.map((sale) => (
                  <Card key={sale.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">
                              #{sale.romaneio_number || sale.id.slice(0, 8)}
                            </span>
                            <Badge variant="outline">
                              {sale.shipping_carrier?.name || 'Correios'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {sale.lead?.name || 'Cliente'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sale.lead?.city}, {sale.lead?.state} - CEP: {sale.lead?.cep}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{sale.items?.length || 0} item(s)</span>
                            <span>•</span>
                            <span>{formatCurrency(sale.total_cents)}</span>
                          </div>
                        </div>
                        <Button 
                          onClick={() => handleGenerateLabel(sale)}
                          disabled={!isConfigured || generateLabel.isPending}
                        >
                          <Tag className="w-4 h-4 mr-2" />
                          Gerar Etiqueta
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-6">
            {labelsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !filteredLabels?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">Nenhuma etiqueta gerada ainda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredLabels.map((label) => (
                  <LabelCard key={label.id} label={label} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Config Dialog */}
      <CorreiosConfigDialog 
        open={showConfigDialog} 
        onOpenChange={setShowConfigDialog} 
      />

      {/* Label Generator Dialog */}
      <Dialog open={showGeneratorDialog} onOpenChange={setShowGeneratorDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar Etiqueta Correios</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <CorreiosLabelGenerator 
              sale={selectedSale} 
              onSuccess={handleLabelGenerated}
              onCancel={() => setShowGeneratorDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function LabelCard({ label }: { label: CorreiosLabel }) {
  const status = statusConfig[label.status] || statusConfig.pending;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-primary">
                {label.tracking_code}
              </span>
              <Badge className={status.color}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
              <Badge variant="outline">
                {label.service_name || label.service_code}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {label.recipient_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {label.recipient_city}, {label.recipient_state} - CEP: {label.recipient_cep}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Criada em {format(new Date(label.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {label.label_pdf_url && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(label.label_pdf_url!, '_blank')}
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Imprimir
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = label.label_pdf_url!;
                    link.download = `etiqueta-${label.tracking_code}.pdf`;
                    link.click();
                  }}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(`https://www.linkcorreios.com.br/?id=${label.tracking_code}`, '_blank')}
              title="Rastrear"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

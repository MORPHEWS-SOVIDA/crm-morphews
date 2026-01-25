import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Upload,
  Search,
  Loader2,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Warehouse,
  Plus,
} from 'lucide-react';
import { usePurchaseInvoices, type PurchaseInvoice } from '@/hooks/usePurchaseInvoices';
import { useStockLocations } from '@/hooks/useStockLocations';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PurchaseInvoiceImportDialog } from '@/components/stock/PurchaseInvoiceImportDialog';
import { PurchaseInvoiceDetailDialog } from '@/components/stock/PurchaseInvoiceDetailDialog';
import { StockLocationsManager } from '@/components/stock/StockLocationsManager';
import { ManualStockEntryDialog } from '@/components/stock/ManualStockEntryDialog';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  processing: { label: 'Processando', variant: 'outline', icon: Loader2 },
  completed: { label: 'Concluída', variant: 'default', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
};

export default function PurchaseInvoices() {
  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [manualEntryDialogOpen, setManualEntryDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  const { data: invoices, isLoading } = usePurchaseInvoices();
  const { data: locations } = useStockLocations();

  const filteredInvoices = invoices?.filter((inv) =>
    inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.supplier_cnpj.includes(searchTerm)
  );

  const getStatusInfo = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notas de Entrada</h1>
            <p className="text-muted-foreground">
              Gerencie suas notas fiscais de compra e entrada de estoque
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setManualEntryDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Entrada Manual
            </Button>
            <Button onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar XML
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />
              Notas Fiscais
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2">
              <Warehouse className="h-4 w-4" />
              Locais de Estoque
              {locations && locations.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {locations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="mt-6 space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, fornecedor ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Invoices List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredInvoices?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">Nenhuma nota encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm
                      ? 'Tente uma busca diferente'
                      : 'Importe sua primeira nota fiscal de compra'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setImportDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar XML
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices?.map((invoice) => {
                      const statusInfo = getStatusInfo(invoice.status);
                      const StatusIcon = statusInfo.icon;
                      
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.number}
                            {invoice.series && (
                              <span className="text-muted-foreground ml-1">
                                (Série {invoice.series})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{invoice.supplier_name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.supplier_cnpj.replace(
                              /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                              '$1.$2.$3/$4-$5'
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.total_invoice_cents)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedInvoice(invoice)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="locations" className="mt-6">
            <StockLocationsManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Import Dialog */}
      <PurchaseInvoiceImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      {/* Detail Dialog */}
      <PurchaseInvoiceDetailDialog
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
      />

      {/* Manual Entry Dialog */}
      <ManualStockEntryDialog
        open={manualEntryDialogOpen}
        onOpenChange={setManualEntryDialogOpen}
      />
    </Layout>
  );
}

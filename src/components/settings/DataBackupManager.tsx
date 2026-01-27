import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Shield, AlertTriangle, Package, Users, ShoppingCart, Handshake, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Separator } from '@/components/ui/separator';

// Helper to escape CSV fields
function escapeCSVField(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper to download CSV
function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows.map(row => row.map(escapeCSVField).join(';')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function DataBackupManager() {
  const { profile } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para exportar dados');
      }

      const response = await supabase.functions.invoke('tenant-data-backup', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao exportar dados');
      }

      // Create and download the file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup exportado com sucesso!',
        description: `${response.data.summary?.total_leads || 0} leads, ${response.data.summary?.total_sales || 0} vendas, ${response.data.summary?.total_partners || 0} parceiros exportados.`,
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Erro ao exportar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export Products CSV
  const handleExportProducts = async () => {
    if (!profile?.organization_id) return;
    setExportingType('products');
    try {
      const { data: products, error } = await supabase
        .from('lead_products')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;

      const headers = [
        'ID', 'Nome', 'Descrição', 'Categoria', 'SKU', 'EAN', 'NCM',
        'Preço Base (R$)', 'Custo (R$)', 'Estoque', 'Estoque Mínimo',
        'Peso Líquido (g)', 'Peso Bruto (g)', 'Largura (cm)', 'Altura (cm)', 'Profundidade (cm)',
        'Ativo', 'Destaque', 'Data Criação'
      ];

      const rows = (products || []).map(p => [
        p.id,
        p.name,
        p.description || '',
        p.category || '',
        p.sku || '',
        p.barcode_ean || '',
        p.fiscal_ncm || '',
        ((p.base_price_cents || p.price_1_unit || 0) / 100).toFixed(2).replace('.', ','),
        ((p.cost_cents || 0) / 100).toFixed(2).replace('.', ','),
        String(p.stock_quantity || 0),
        String(p.minimum_stock || 0),
        String(p.net_weight_grams || ''),
        String(p.gross_weight_grams || ''),
        String(p.width_cm || ''),
        String(p.height_cm || ''),
        String(p.depth_cm || ''),
        p.is_active ? 'Sim' : 'Não',
        p.is_featured ? 'Sim' : 'Não',
        p.created_at ? format(new Date(p.created_at), 'dd/MM/yyyy') : '',
      ]);

      downloadCSV(`produtos_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
      toast({ title: 'Produtos exportados!', description: `${rows.length} produtos exportados.` });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar produtos', description: error.message, variant: 'destructive' });
    } finally {
      setExportingType(null);
    }
  };

  // Export Leads/Clients CSV
  const handleExportLeads = async () => {
    if (!profile?.organization_id) return;
    setExportingType('leads');
    try {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('*, lead_addresses(*)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const headers = [
        'ID', 'Nome', 'WhatsApp', 'Email', 'CPF/CNPJ', 'Etapa', 'Estrelas',
        'Responsável', 'Origem', 'UTM Source', 'UTM Medium', 'UTM Campaign',
        'CEP', 'Rua', 'Número', 'Complemento', 'Bairro', 'Cidade', 'Estado',
        'Data Criação', 'Última Atividade'
      ];

      const rows = (leads || []).map((l: any) => {
        const addr = l.lead_addresses?.[0] || {};
        return [
          l.id,
          l.name || '',
          l.whatsapp || '',
          l.email || '',
          l.cpf_cnpj || '',
          l.stage || '',
          String(l.stars || 3),
          l.assigned_to || '',
          l.origin || l.utm_source || '',
          l.utm_source || '',
          l.utm_medium || '',
          l.utm_campaign || '',
          addr.cep || '',
          addr.street || '',
          addr.number || '',
          addr.complement || '',
          addr.neighborhood || '',
          addr.city || '',
          addr.state || '',
          l.created_at ? format(new Date(l.created_at), 'dd/MM/yyyy HH:mm') : '',
          l.updated_at ? format(new Date(l.updated_at), 'dd/MM/yyyy HH:mm') : '',
        ];
      });

      downloadCSV(`clientes_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
      toast({ title: 'Clientes exportados!', description: `${rows.length} clientes exportados.` });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar clientes', description: error.message, variant: 'destructive' });
    } finally {
      setExportingType(null);
    }
  };

  // Export Partners CSV
  const handleExportPartners = async () => {
    if (!profile?.organization_id) return;
    setExportingType('partners');
    try {
      const { data: partners, error } = await supabase
        .from('partner_associations')
        .select(`
          *,
          virtual_account:virtual_accounts(id, holder_name, holder_email, holder_document, balance_cents, pending_balance_cents)
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const partnerTypeLabels: Record<string, string> = {
        affiliate: 'Afiliado',
        coproducer: 'Co-produtor',
        industry: 'Indústria',
        factory: 'Fábrica',
      };

      const headers = [
        'ID', 'Tipo', 'Nome', 'Email', 'CPF/CNPJ', 'Código de Afiliado',
        'Tipo Comissão', 'Valor Comissão (%)', 'Responsável Reembolsos',
        'Responsável Chargebacks', 'Ativo', 'Saldo Disponível (R$)',
        'Saldo Pendente (R$)', 'Data Criação'
      ];

      const rows = (partners || []).map(p => {
        const acc = p.virtual_account;
        return [
          p.id,
          partnerTypeLabels[p.partner_type] || p.partner_type,
          acc?.holder_name || '',
          acc?.holder_email || '',
          acc?.holder_document || '',
          p.affiliate_code || '',
          p.commission_type === 'percentage' ? 'Percentual' : 'Fixo',
          p.commission_type === 'percentage' 
            ? String(p.commission_value || 0) 
            : ((p.commission_value || 0) / 100).toFixed(2).replace('.', ','),
          p.responsible_for_refunds ? 'Sim' : 'Não',
          p.responsible_for_chargebacks ? 'Sim' : 'Não',
          p.is_active ? 'Sim' : 'Não',
          ((acc?.balance_cents || 0) / 100).toFixed(2).replace('.', ','),
          ((acc?.pending_balance_cents || 0) / 100).toFixed(2).replace('.', ','),
          p.created_at ? format(new Date(p.created_at), 'dd/MM/yyyy') : '',
        ];
      });

      downloadCSV(`parceiros_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
      toast({ title: 'Parceiros exportados!', description: `${rows.length} parceiros exportados.` });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar parceiros', description: error.message, variant: 'destructive' });
    } finally {
      setExportingType(null);
    }
  };

  // Export Sales CSV
  const handleExportSales = async () => {
    if (!profile?.organization_id) return;
    setExportingType('sales');
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          *,
          lead:leads(name, whatsapp, email, cpf_cnpj),
          items:sale_items(*, product:lead_products(name))
        `)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const paymentStatusLabels: Record<string, string> = {
        not_paid: 'Não Pago',
        pending: 'Pendente',
        paid: 'Pago',
        refunded: 'Reembolsado',
        chargeback: 'Chargeback',
      };

      const headers = [
        'Nº Venda', 'Data', 'Cliente', 'WhatsApp', 'Email', 'CPF/CNPJ',
        'Produtos', 'Quantidade Total', 'Valor Total (R$)', 'Frete (R$)',
        'Status Pagamento', 'Data Pagamento', 'Forma Pagamento',
        'Status Venda', 'Data Entrega', 'Vendedor', 'Comissão (%)', 'Comissão (R$)',
        'Rastreio', 'Observações'
      ];

      const rows = (sales || []).map((s: any) => {
        const productNames = (s.items || []).map((i: any) => i.product?.name || 'Produto').join(', ');
        const totalQty = (s.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
        const sellerName = s.assigned_to || '';
        
        return [
          s.romaneio_number || s.id?.slice(0, 8) || '',
          s.created_at ? format(new Date(s.created_at), 'dd/MM/yyyy HH:mm') : '',
          s.lead?.name || '',
          s.lead?.whatsapp || '',
          s.lead?.email || '',
          s.lead?.cpf_cnpj || '',
          productNames,
          String(totalQty),
          ((s.total_cents || 0) / 100).toFixed(2).replace('.', ','),
          ((s.shipping_cost_cents || 0) / 100).toFixed(2).replace('.', ','),
          paymentStatusLabels[s.payment_status] || s.payment_status || 'Não Pago',
          s.payment_confirmed_at ? format(new Date(s.payment_confirmed_at), 'dd/MM/yyyy') : '',
          s.payment_method || '',
          s.status || '',
          s.delivered_at ? format(new Date(s.delivered_at), 'dd/MM/yyyy') : '',
          sellerName,
          String(s.seller_commission_percentage || 0).replace('.', ','),
          ((s.seller_commission_cents || 0) / 100).toFixed(2).replace('.', ','),
          s.tracking_code || '',
          s.internal_notes || '',
        ];
      });

      downloadCSV(`vendas_${format(new Date(), 'yyyy-MM-dd')}.csv`, headers, rows);
      toast({ title: 'Vendas exportadas!', description: `${rows.length} vendas exportadas.` });
    } catch (error: any) {
      toast({ title: 'Erro ao exportar vendas', description: error.message, variant: 'destructive' });
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Seus dados estão protegidos</AlertTitle>
        <AlertDescription>
          Todos os dados são armazenados com criptografia e isolamento por empresa.
          Backups automáticos são feitos diariamente. Recomendamos que você também faça backups manuais periodicamente.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-500">Responsabilidade compartilhada</AlertTitle>
        <AlertDescription className="text-amber-200/80">
          Ao utilizar o sistema, você concorda que é responsável por manter cópias de segurança 
          dos seus dados. Recomendamos exportar semanalmente ou após grandes atualizações.
        </AlertDescription>
      </Alert>

      {/* Exportações CSV Individuais */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar CSV (para Excel)
        </h4>
        <p className="text-xs text-muted-foreground">
          Exporte cada tipo de dado em formato CSV compatível com Excel e planilhas.
        </p>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProducts}
            disabled={exportingType !== null}
            className="justify-start"
          >
            {exportingType === 'products' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            Produtos
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLeads}
            disabled={exportingType !== null}
            className="justify-start"
          >
            {exportingType === 'leads' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Clientes
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPartners}
            disabled={exportingType !== null}
            className="justify-start"
          >
            {exportingType === 'partners' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Handshake className="h-4 w-4 mr-2" />
            )}
            Parceiros
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSales}
            disabled={exportingType !== null}
            className="justify-start"
          >
            {exportingType === 'sales' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4 mr-2" />
            )}
            Vendas
          </Button>
        </div>
      </div>

      <Separator />

      {/* Backup Completo JSON */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Backup Completo (JSON)</h4>
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <p className="text-xs text-muted-foreground">O que será exportado:</p>
          <ul className="text-xs text-muted-foreground space-y-1 columns-2">
            <li>• Leads e endereços</li>
            <li>• Vendas e itens</li>
            <li>• Produtos e combos</li>
            <li>• Parceiros</li>
            <li>• Equipe</li>
            <li>• WhatsApp (10k msgs)</li>
            <li>• Pesquisas NPS</li>
            <li>• Tickets SAC</li>
            <li>• Histórico de etapas</li>
            <li>• Mensagens agendadas</li>
          </ul>
        </div>

        <Button 
          onClick={handleExportData} 
          disabled={isExporting || exportingType !== null}
          className="w-full"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exportando dados...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Baixar Backup Completo (JSON)
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          O JSON pode ser aberto em editores de texto ou importado em outras ferramentas.
        </p>
      </div>
    </div>
  );
}

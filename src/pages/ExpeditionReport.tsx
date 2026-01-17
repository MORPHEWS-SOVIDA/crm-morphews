import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, FileText, Package, Truck, Store, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency } from '@/hooks/useSales';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type ShiftFilter = 'morning' | 'afternoon' | 'full_day' | 'all';
type DeliveryTypeFilter = 'motoboy' | 'carrier' | 'pickup' | 'all';
type DateTypeFilter = 'delivery' | 'created';

interface SaleWithDetails {
  id: string;
  romaneio_number: number | null;
  status: string;
  total_cents: number;
  payment_confirmed_at: string | null;
  scheduled_delivery_date: string | null;
  scheduled_delivery_shift: string | null;
  delivery_type: string | null;
  shipping_carrier_id: string | null;
  carrier_tracking_code: string | null;
  carrier_tracking_status: string | null;
  assigned_delivery_user_id: string | null;
  created_at: string;
  lead: {
    name: string;
    whatsapp: string;
    neighborhood: string | null;
    city: string | null;
  } | null;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    total_cents: number;
  }[];
}

export default function ExpeditionReport() {
  const navigate = useNavigate();
  const { tenantId: organizationId } = useTenant();
  const printRef = useRef<HTMLDivElement>(null);

  // Filters
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTypeFilter, setDateTypeFilter] = useState<DateTypeFilter>('delivery');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<DeliveryTypeFilter>('all');
  const [motoboyFilter, setMotoboyFilter] = useState<string>('all');
  const [includeDispatched, setIncludeDispatched] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Fetch delivery users (motoboys)
  const { data: deliveryUsers } = useQuery({
    queryKey: ['delivery-users-list', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name');
      
      return data?.map(u => ({
        id: u.user_id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Usuário'
      })) || [];
    },
    enabled: !!organizationId,
  });

  // Fetch sales for report
  const { data: sales, isLoading } = useQuery({
    queryKey: ['expedition-report', organizationId, startDate, endDate, dateTypeFilter, shiftFilter, deliveryTypeFilter, motoboyFilter, includeDispatched],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          status,
          total_cents,
          payment_confirmed_at,
          scheduled_delivery_date,
          scheduled_delivery_shift,
          delivery_type,
          shipping_carrier_id,
          carrier_tracking_code,
          carrier_tracking_status,
          assigned_delivery_user_id,
          created_at,
          lead:leads(name, whatsapp, neighborhood, city),
          items:sale_items(id, product_name, quantity, total_cents)
        `)
        .eq('organization_id', organizationId)
        .order('romaneio_number', { ascending: true });

      // Filter by date type
      if (dateTypeFilter === 'delivery') {
        query = query
          .gte('scheduled_delivery_date', startDate)
          .lte('scheduled_delivery_date', endDate);
      } else {
        // Created date - use created_at
        const startDateTime = `${startDate}T00:00:00`;
        const endDateTime = `${endDate}T23:59:59`;
        query = query
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime);
      }

      // Filter by status - expedition reports should include pending_expedition orders ready to dispatch
      if (includeDispatched) {
        query = query.in('status', ['pending_expedition', 'dispatched', 'delivered', 'returned']);
      } else {
        query = query.in('status', ['pending_expedition', 'draft']);
      }

      // Filter by shift (only applies to motoboy deliveries with scheduled date)
      if (shiftFilter !== 'all') {
        query = query.eq('scheduled_delivery_shift', shiftFilter);
      }

      // Filter by delivery type
      if (deliveryTypeFilter !== 'all') {
        query = query.eq('delivery_type', deliveryTypeFilter);
      }

      // Filter by motoboy
      if (motoboyFilter !== 'all') {
        query = query.eq('assigned_delivery_user_id', motoboyFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data as unknown as SaleWithDetails[];
    },
    enabled: !!organizationId && showReport,
  });

  // Delivery users map for display
  const deliveryUsersMap = deliveryUsers?.reduce((acc, u) => {
    acc[u.id] = u.name;
    return acc;
  }, {} as Record<string, string>) || {};

  // Fetch carriers
  const { data: carriers } = useQuery({
    queryKey: ['carriers', organizationId],
    queryFn: async () => {
      if (!organizationId) return {};
      
      const { data } = await supabase
        .from('shipping_carriers')
        .select('id, name')
        .eq('organization_id', organizationId);
      
      const carriersMap: Record<string, string> = {};
      data?.forEach(c => {
        carriersMap[c.id] = c.name;
      });
      return carriersMap;
    },
    enabled: !!organizationId,
  });

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    
    setIsGeneratingPdf(true);
    try {
      const element = printRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 5;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const fileName = `relatorio-expedicao-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateReport = () => {
    setShowReport(true);
  };

  const getShiftLabel = (shift: string | null) => {
    if (!shift) return '-';
    const shifts: Record<string, string> = {
      morning: 'Manhã',
      afternoon: 'Tarde',
      full_day: 'Dia Todo',
    };
    return shifts[shift] || shift;
  };

  const getProductsSummary = (items: SaleWithDetails['items']) => {
    return items.map(item => `${item.quantity}x ${item.product_name}`).join(', ');
  };

  // Group by motoboy for motoboy deliveries
  const groupedByMotoboy = sales?.filter(s => s.delivery_type === 'motoboy').reduce((acc, sale) => {
    const motoboyId = sale.assigned_delivery_user_id || 'sem-motoboy';
    if (!acc[motoboyId]) {
      acc[motoboyId] = [];
    }
    acc[motoboyId].push(sale);
    return acc;
  }, {} as Record<string, SaleWithDetails[]>) || {};

  const carrierSales = sales?.filter(s => s.delivery_type === 'carrier') || [];
  const pickupSales = sales?.filter(s => s.delivery_type === 'pickup' || !s.delivery_type) || [];

  const totalValue = sales?.reduce((sum, s) => sum + s.total_cents, 0) || 0;
  const paidCount = sales?.filter(s => s.payment_confirmed_at).length || 0;
  const unpaidCount = (sales?.length || 0) - paidCount;

  return (
    <>
      {/* Controls - Hidden when printing */}
      <div className="print:hidden p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Relatório de Expedição</h1>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Selecionar Romaneios para Entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Type Selection */}
            <div className="space-y-2">
              <Label>Tipo de Data</Label>
              <RadioGroup
                value={dateTypeFilter}
                onValueChange={(value) => setDateTypeFilter(value as DateTypeFilter)}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivery" id="date-delivery" />
                  <Label htmlFor="date-delivery" className="cursor-pointer">Data de Entrega</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="created" id="date-created" />
                  <Label htmlFor="date-created" className="cursor-pointer">Data de Criação</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Shift Filter */}
            <div className="space-y-2">
              <Label>Turno das Entregas</Label>
              <RadioGroup
                value={shiftFilter}
                onValueChange={(value) => setShiftFilter(value as ShiftFilter)}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="morning" id="morning" />
                  <Label htmlFor="morning" className="cursor-pointer">Manhã</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="afternoon" id="afternoon" />
                  <Label htmlFor="afternoon" className="cursor-pointer">Tarde</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full_day" id="full_day" />
                  <Label htmlFor="full_day" className="cursor-pointer">Dia Inteiro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all-shifts" />
                  <Label htmlFor="all-shifts" className="cursor-pointer">Todos</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Delivery Type Filter */}
            <div className="space-y-2">
              <Label>Tipo de Entrega</Label>
              <RadioGroup
                value={deliveryTypeFilter}
                onValueChange={(value) => setDeliveryTypeFilter(value as DeliveryTypeFilter)}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="motoboy" id="motoboy" />
                  <Label htmlFor="motoboy" className="cursor-pointer flex items-center gap-1">
                    <Truck className="w-4 h-4" /> Motoboy
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="carrier" id="carrier" />
                  <Label htmlFor="carrier" className="cursor-pointer flex items-center gap-1">
                    <Package className="w-4 h-4" /> Transportadora
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pickup" id="pickup" />
                  <Label htmlFor="pickup" className="cursor-pointer flex items-center gap-1">
                    <Store className="w-4 h-4" /> Retirada
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all-types" />
                  <Label htmlFor="all-types" className="cursor-pointer">Todos</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Motoboy Filter */}
            {(deliveryTypeFilter === 'motoboy' || deliveryTypeFilter === 'all') && (
              <div className="space-y-2">
                <Label>Filtrar por Motoboy</Label>
                <Select value={motoboyFilter} onValueChange={setMotoboyFilter}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="Todos os motoboys" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Motoboys</SelectItem>
                    {deliveryUsers?.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Include Dispatched */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-dispatched"
                checked={includeDispatched}
                onCheckedChange={(checked) => setIncludeDispatched(!!checked)}
              />
              <Label htmlFor="include-dispatched" className="cursor-pointer">
                Incluir romaneios já despachados (para reimpressão)
              </Label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGenerateReport}>
                <FileText className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
              {showReport && sales && sales.length > 0 && (
                <Button onClick={handleDownloadPdf} variant="default" disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Baixar PDF
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {showReport && (
          <>
            {isLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : sales && sales.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Nenhum romaneio encontrado para os filtros selecionados.
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>

      {/* Printable Report */}
      {showReport && sales && sales.length > 0 && (
        <div ref={printRef} className="expedition-report bg-white text-black p-4 print:p-2 max-w-[1100px] mx-auto print:max-w-none">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-2 mb-4">
            <h1 className="text-xl font-bold">RESUMO DA ENTREGA DE ROMANEIOS</h1>
            <p className="text-sm">
              Período: {format(new Date(startDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })} a {format(new Date(endDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
              {' '}({dateTypeFilter === 'delivery' ? 'Data de Entrega' : 'Data de Criação'})
              {shiftFilter !== 'all' && ` | Turno: ${getShiftLabel(shiftFilter)}`}
            </p>
            <p className="text-xs text-gray-600">
              Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Summary Stats */}
          <div className="flex gap-4 mb-4 text-sm border-b border-gray-300 pb-2">
            <span><strong>Total de Romaneios:</strong> {sales.length}</span>
            <span><strong>Pagos:</strong> {paidCount}</span>
            <span><strong>A Receber:</strong> {unpaidCount}</span>
            <span><strong>Valor Total:</strong> {formatCurrency(totalValue)}</span>
          </div>

          {/* Motoboy Deliveries */}
          {Object.keys(groupedByMotoboy).length > 0 && (deliveryTypeFilter === 'all' || deliveryTypeFilter === 'motoboy') && (
            <div className="mb-6">
              <h2 className="font-bold text-lg bg-gray-200 p-2 mb-2 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                ENTREGAS MOTOBOY
              </h2>
              
              {Object.entries(groupedByMotoboy).map(([motoboyId, motoboysSales]) => {
                const motoboyName = motoboyId === 'sem-motoboy' 
                  ? 'SEM MOTOBOY ATRIBUÍDO' 
                  : (deliveryUsersMap[motoboyId] || 'Motoboy não identificado');
                
                const motoboyTotal = motoboysSales.reduce((sum, s) => sum + s.total_cents, 0);
                
                return (
                  <div key={motoboyId} className="mb-4">
                    <h3 className="font-semibold bg-gray-100 p-1 mb-1 text-sm flex justify-between">
                      <span>🏍️ {motoboyName} ({motoboysSales.length} entregas)</span>
                      <span>Total: {formatCurrency(motoboyTotal)}</span>
                    </h3>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-400 p-1 text-left w-16">ROM.</th>
                          <th className="border border-gray-400 p-1 text-left">CLIENTE / BAIRRO</th>
                          <th className="border border-gray-400 p-1 text-left">PRODUTOS</th>
                          <th className="border border-gray-400 p-1 text-center w-14">PAGO?</th>
                          <th className="border border-gray-400 p-1 text-right w-16">VALOR</th>
                          <th className="border border-gray-400 p-1 text-center w-16">RUBRICA</th>
                          <th className="border border-gray-400 p-1 text-left w-24">OCORRÊNCIA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {motoboysSales.map((sale) => (
                          <tr key={sale.id}>
                            <td className="border border-gray-400 p-1 font-semibold">{sale.romaneio_number}</td>
                            <td className="border border-gray-400 p-1">
                              <span className="font-medium">{sale.lead?.name}</span>
                              {sale.lead?.neighborhood && (
                                <span className="text-gray-600 block text-[10px]">{sale.lead.neighborhood}</span>
                              )}
                            </td>
                            <td className="border border-gray-400 p-1 text-[10px]">{getProductsSummary(sale.items)}</td>
                            <td className="border border-gray-400 p-1 text-center font-bold">
                              {sale.payment_confirmed_at ? '✓ SIM' : 'NÃO'}
                            </td>
                            <td className="border border-gray-400 p-1 text-right">{formatCurrency(sale.total_cents)}</td>
                            <td className="border border-gray-400 p-1"></td>
                            <td className="border border-gray-400 p-1"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {/* Signature line for motoboy */}
                    <div className="mt-2 flex gap-8 text-xs">
                      <div className="flex-1">
                        <p className="mb-4">Assinatura do Motoboy (Saída):</p>
                        <div className="border-t border-black w-48"></div>
                      </div>
                      <div className="flex-1">
                        <p className="mb-4">Assinatura do Motoboy (Retorno):</p>
                        <div className="border-t border-black w-48"></div>
                      </div>
                      <div className="flex-1">
                        <p className="mb-4">Conferência Expedição:</p>
                        <div className="border-t border-black w-48"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Carrier Deliveries */}
          {carrierSales.length > 0 && (deliveryTypeFilter === 'all' || deliveryTypeFilter === 'carrier') && (
            <div className="mb-6">
              <h2 className="font-bold text-lg bg-blue-100 p-2 mb-2 flex items-center gap-2">
                <Package className="w-5 h-5" />
                ENTREGAS TRANSPORTADORA
              </h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border border-gray-400 p-1 text-left w-16">ROM.</th>
                    <th className="border border-gray-400 p-1 text-left">CLIENTE / CIDADE</th>
                    <th className="border border-gray-400 p-1 text-left">PRODUTOS</th>
                    <th className="border border-gray-400 p-1 text-left w-24">TRANSP.</th>
                    <th className="border border-gray-400 p-1 text-left w-28">RASTREIO</th>
                    <th className="border border-gray-400 p-1 text-left w-20">STATUS</th>
                    <th className="border border-gray-400 p-1 text-center w-14">PAGO?</th>
                    <th className="border border-gray-400 p-1 text-right w-16">VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {carrierSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="border border-gray-400 p-1 font-semibold">{sale.romaneio_number}</td>
                      <td className="border border-gray-400 p-1">
                        <span className="font-medium">{sale.lead?.name}</span>
                        {sale.lead?.city && (
                          <span className="text-gray-600 block text-[10px]">{sale.lead.city}</span>
                        )}
                      </td>
                      <td className="border border-gray-400 p-1 text-[10px]">{getProductsSummary(sale.items)}</td>
                      <td className="border border-gray-400 p-1 text-[10px]">
                        {sale.shipping_carrier_id && carriers?.[sale.shipping_carrier_id] 
                          ? carriers[sale.shipping_carrier_id] 
                          : '-'}
                      </td>
                      <td className="border border-gray-400 p-1 text-[10px] font-mono">
                        {sale.carrier_tracking_code || '-'}
                      </td>
                      <td className="border border-gray-400 p-1 text-[10px]">
                        {sale.carrier_tracking_status || 'Pendente'}
                      </td>
                      <td className="border border-gray-400 p-1 text-center font-bold">
                        {sale.payment_confirmed_at ? '✓ SIM' : 'NÃO'}
                      </td>
                      <td className="border border-gray-400 p-1 text-right">{formatCurrency(sale.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Signature line */}
              <div className="mt-2 flex gap-8 text-xs">
                <div className="flex-1">
                  <p className="mb-4">Conferência Expedição:</p>
                  <div className="border-t border-black w-48"></div>
                </div>
              </div>
            </div>
          )}

          {/* Pickup Sales */}
          {pickupSales.length > 0 && (deliveryTypeFilter === 'all' || deliveryTypeFilter === 'pickup') && (
            <div className="mb-6">
              <h2 className="font-bold text-lg bg-green-100 p-2 mb-2 flex items-center gap-2">
                <Store className="w-5 h-5" />
                RETIRADAS NO BALCÃO
              </h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-green-50">
                    <th className="border border-gray-400 p-1 text-left w-16">ROM.</th>
                    <th className="border border-gray-400 p-1 text-left">CLIENTE</th>
                    <th className="border border-gray-400 p-1 text-left">PRODUTOS</th>
                    <th className="border border-gray-400 p-1 text-center w-14">PAGO?</th>
                    <th className="border border-gray-400 p-1 text-right w-16">VALOR</th>
                    <th className="border border-gray-400 p-1 text-center w-20">RETIRADO</th>
                    <th className="border border-gray-400 p-1 text-left w-24">RUBRICA</th>
                  </tr>
                </thead>
                <tbody>
                  {pickupSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="border border-gray-400 p-1 font-semibold">{sale.romaneio_number}</td>
                      <td className="border border-gray-400 p-1 font-medium">{sale.lead?.name}</td>
                      <td className="border border-gray-400 p-1 text-[10px]">{getProductsSummary(sale.items)}</td>
                      <td className="border border-gray-400 p-1 text-center font-bold">
                        {sale.payment_confirmed_at ? '✓ SIM' : 'NÃO'}
                      </td>
                      <td className="border border-gray-400 p-1 text-right">{formatCurrency(sale.total_cents)}</td>
                      <td className="border border-gray-400 p-1 text-center">☐</td>
                      <td className="border border-gray-400 p-1"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 border-t-2 border-black pt-2 text-xs">
            <div className="flex justify-between">
              <span>Total de Romaneios: {sales.length}</span>
              <span>Valor Total: {formatCurrency(totalValue)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .expedition-report, .expedition-report * {
            visibility: visible;
          }
          .expedition-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            font-size: 10px;
          }
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
        }
      `}</style>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/hooks/useSales';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

type PrintFormat = 'a5' | 'a5x2' | 'thermal';

interface SaleData {
  id: string;
  romaneio_number: number;
  total_cents: number;
  created_at: string;
  scheduled_delivery_date: string | null;
  scheduled_delivery_shift: string | null;
  delivery_type: string | null;
  payment_confirmed_at: string | null;
  seller_user_id: string | null;
  assigned_delivery_user_id: string | null;
  delivery_region_id: string | null;
  shipping_carrier_id: string | null;
  lead: {
    name: string;
    whatsapp: string;
    street: string | null;
    street_number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
    google_maps_link: string | null;
    delivery_notes: string | null;
  } | null;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    total_cents: number;
    requisition_number: string | null;
  }>;
  sellerName?: string;
  deliveryUserName?: string;
  regionName?: string;
  carrierName?: string;
}

const MAX_ITEMS_A5 = 10;

export default function RomaneioBatchPrint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sales, setSales] = useState<SaleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const printFormat = (searchParams.get('format') as PrintFormat) || 'a5';
  const autoPrint = searchParams.get('auto') === 'true';
  const saleIds = searchParams.get('ids')?.split(',') || [];

  useEffect(() => {
    const fetchSales = async () => {
      if (saleIds.length === 0) {
        setIsLoading(false);
        return;
      }

      const { data: salesData, error } = await supabase
        .from('sales')
        .select(`
          id,
          romaneio_number,
          total_cents,
          created_at,
          scheduled_delivery_date,
          scheduled_delivery_shift,
          delivery_type,
          payment_confirmed_at,
          seller_user_id,
          assigned_delivery_user_id,
          delivery_region_id,
          shipping_carrier_id,
          shipping_address_id,
          lead:leads(name, whatsapp, street, street_number, complement, neighborhood, city, state, cep, google_maps_link, delivery_notes),
          items:sale_items(id, product_name, quantity, total_cents, requisition_number),
          shipping_address:lead_addresses(id, label, street, street_number, complement, neighborhood, city, state, cep, delivery_notes, google_maps_link)
        `)
        .in('id', saleIds);

      if (error || !salesData) {
        console.error('Error fetching sales:', error);
        setIsLoading(false);
        return;
      }

      // Fetch additional data for all sales
      const enrichedSales = await Promise.all(
        salesData.map(async (sale: any) => {
          const enriched: SaleData = {
            ...sale,
            lead: sale.lead,
            items: sale.items || [],
          };

          // Fetch seller name
          if (sale.seller_user_id) {
            const { data: sellerProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', sale.seller_user_id)
              .maybeSingle();
            if (sellerProfile) {
              enriched.sellerName = `${sellerProfile.first_name} ${sellerProfile.last_name}`;
            }
          }

          // Fetch delivery user name
          if (sale.assigned_delivery_user_id) {
            const { data: deliveryProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', sale.assigned_delivery_user_id)
              .maybeSingle();
            if (deliveryProfile) {
              enriched.deliveryUserName = `${deliveryProfile.first_name} ${deliveryProfile.last_name}`;
            }
          }

          // Fetch region name
          if (sale.delivery_region_id) {
            const { data: region } = await supabase
              .from('delivery_regions')
              .select('name')
              .eq('id', sale.delivery_region_id)
              .maybeSingle();
            if (region) {
              enriched.regionName = region.name;
            }
          }

          // Fetch carrier name
          if (sale.shipping_carrier_id) {
            const { data: carrier } = await supabase
              .from('shipping_carriers')
              .select('name')
              .eq('id', sale.shipping_carrier_id)
              .maybeSingle();
            if (carrier) {
              enriched.carrierName = carrier.name;
            }
          }

          return enriched;
        })
      );

      // Sort by romaneio_number to maintain order
      enrichedSales.sort((a, b) => {
        const indexA = saleIds.indexOf(a.id);
        const indexB = saleIds.indexOf(b.id);
        return indexA - indexB;
      });

      setSales(enrichedSales);
      setIsLoading(false);
    };

    fetchSales();
  }, [saleIds.join(',')]);

  // Auto print on load
  useEffect(() => {
    if (autoPrint && sales.length > 0 && !isLoading) {
      setTimeout(() => {
        window.print();
      }, 800);
    }
  }, [autoPrint, sales, isLoading]);

  const handlePrint = () => {
    window.print();
  };

  const getShiftLabel = (shift: string | null) => {
    if (!shift) return '';
    const shifts: Record<string, string> = {
      morning: 'M',
      afternoon: 'T',
      full_day: 'D',
    };
    return shifts[shift] || '';
  };

  const getDeliveryLabel = (sale: SaleData) => {
    if (!sale.delivery_type || sale.delivery_type === 'pickup') {
      return 'RETIRADA';
    }
    if (sale.delivery_type === 'motoboy') {
      return sale.regionName ? sale.regionName.toUpperCase() : 'ENTREGA';
    }
    if (sale.delivery_type === 'carrier') {
      return sale.carrierName ? sale.carrierName.toUpperCase() : 'TRANSPORTADORA';
    }
    return 'ENTREGA';
  };

  const renderA5Content = (sale: SaleData, isSecondCopy = false) => {
    // Use production URL for QR code
    const saleQrData = `https://sales.morphews.com/vendas/${sale.id}`;
    
    // Use shipping_address if available
    const shippingAddress = (sale as any).shipping_address;
    const addressData = shippingAddress || sale.lead;
    const deliveryNotes = shippingAddress?.delivery_notes || sale.lead?.delivery_notes;
    const items = sale.items || [];
    const needsOverflow = printFormat !== 'thermal' && items.length > MAX_ITEMS_A5;
    const mainPageItems = needsOverflow ? items.slice(0, MAX_ITEMS_A5 - 1) : items;
    const overflowItems = needsOverflow ? items.slice(MAX_ITEMS_A5 - 1) : [];

    const formattedDeliveryDate = sale.scheduled_delivery_date 
      ? format(new Date(sale.scheduled_delivery_date + 'T12:00:00'), 'dd/MM', { locale: ptBR })
      : '___';

    return (
      <div className={`romaneio-a5 bg-white text-black`} style={{ 
        width: '148mm', 
        height: printFormat === 'a5x2' ? '104mm' : 'auto',
        minHeight: printFormat === 'a5x2' ? '104mm' : '200mm',
        maxHeight: printFormat === 'a5x2' ? '104mm' : 'none',
        fontSize: '8px',
        overflow: 'hidden',
        padding: '2mm',
        boxSizing: 'border-box',
      }}>
        {/* Row 1: Header */}
        <div className="flex justify-between items-center border-b border-black pb-1 mb-1" style={{ fontSize: '9px' }}>
          <div className="flex items-center gap-3">
            <span className="font-bold text-base">ROM: #{sale.romaneio_number}</span>
            <span><strong>VEND:</strong> {sale.sellerName || 'N/A'}</span>
            <span><strong>EMISSÃO:</strong> {format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span><strong>ENT:</strong> {formattedDeliveryDate} {getShiftLabel(sale.scheduled_delivery_shift)}</span>
            {sale.deliveryUserName && <span>| {sale.deliveryUserName}</span>}
          </div>
        </div>

        {/* Row 2: Client */}
        <div className="flex justify-between items-start mb-1">
          <div className="flex-1">
            <div className="flex items-center gap-2" style={{ fontSize: '11px' }}>
              <span className="font-bold">{sale.lead?.name}</span>
              <span className="text-gray-700">TEL: {sale.lead?.whatsapp}</span>
            </div>
            
            <div style={{ fontSize: '9px' }} className="mt-0.5">
              {addressData?.street ? (
                <>
                  <span>{addressData.street}, {addressData.street_number}</span>
                  {addressData.complement && <span> - {addressData.complement}</span>}
                  <span className="ml-2"><strong>B:</strong> {addressData.neighborhood}</span>
                  <span className="ml-2"><strong>CEP:</strong> {addressData.cep}</span>
                  <span className="ml-2">{addressData.city}/{addressData.state}</span>
                </>
              ) : (
                <span className="text-gray-500">Endereço não cadastrado</span>
              )}
            </div>
            
            {deliveryNotes && (
              <div style={{ fontSize: '8px' }} className="mt-0.5 bg-gray-100 px-1 py-0.5 inline-block">
                <strong>REF:</strong> {deliveryNotes}
              </div>
            )}
            
            <div className="mt-1">
              <span className="font-bold border border-black px-2 py-0.5" style={{ fontSize: '10px' }}>
                {getDeliveryLabel(sale)}
              </span>
              {sale.payment_confirmed_at && (
                <span className="ml-2 bg-green-600 text-white px-2 py-0.5" style={{ fontSize: '9px' }}>
                  ✓ PAGO
                </span>
              )}
            </div>
          </div>
          
          {/* QR Code - link to sale page */}
          <div className="flex flex-col items-center ml-2">
            <QRCodeSVG value={saleQrData} size={70} />
            <span style={{ fontSize: '6px' }} className="text-gray-500 mt-0.5">Escanear p/ detalhes</span>
          </div>
        </div>

        {/* Products Table */}
        <table className="w-full border-collapse border border-black" style={{ fontSize: '8px' }}>
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-0.5 text-left">PRODUTO</th>
              <th className="border border-black p-0.5 text-center" style={{ width: '25px' }}>QTD</th>
              <th className="border border-black p-0.5 text-right" style={{ width: '55px' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {mainPageItems.map((item) => (
              <tr key={item.id}>
                <td className="border border-black p-0.5">
                  {item.product_name}
                  {item.requisition_number && (
                    <span className="text-amber-700 ml-1" style={{ fontSize: '7px' }}>Req:{item.requisition_number}</span>
                  )}
                </td>
                <td className="border border-black p-0.5 text-center">{item.quantity}</td>
                <td className="border border-black p-0.5 text-right">{formatCurrency(item.total_cents)}</td>
              </tr>
            ))}
            {needsOverflow && (
              <tr className="bg-yellow-100">
                <td colSpan={3} className="border border-black p-0.5 text-center font-bold" style={{ fontSize: '9px' }}>
                  ⚠️ VER FOLHA EM ANEXO (+{overflowItems.length} itens)
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Total row */}
        <div className="flex justify-between items-center border border-black border-t-0 px-1 py-0.5 bg-gray-100">
          <span style={{ fontSize: '9px' }}>
            {!sale.payment_confirmed_at && <strong>PAGO? NÃO</strong>}
          </span>
          <span className="font-bold" style={{ fontSize: '12px' }}>TOTAL: {formatCurrency(sale.total_cents)}</span>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end mt-1 pt-1 border-t border-dashed border-gray-400">
          <div className="flex gap-3" style={{ fontSize: '8px' }}>
            <label>☐ Entregue</label>
            <label>☐ Ausente</label>
            <label>☐ Recusou</label>
            <label>☐ Outro:___</label>
          </div>
          <div className="flex gap-3" style={{ fontSize: '7px' }}>
            <div className="text-center">
              <div className="border-b border-black" style={{ width: '50px', marginBottom: '1px' }}></div>
              <span>Expedição</span>
            </div>
            <div className="text-center">
              <div className="border-b border-black" style={{ width: '50px', marginBottom: '1px' }}></div>
              <span>Cliente</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderThermalContent = (sale: SaleData) => {
    // Use production URL for QR code
    const saleQrData = `https://sales.morphews.com/vendas/${sale.id}`;
    
    // Use shipping_address if available
    const shippingAddress = (sale as any).shipping_address;
    const addressData = shippingAddress || sale.lead;
    const deliveryNotes = shippingAddress?.delivery_notes || sale.lead?.delivery_notes;

    const formattedDeliveryDate = sale.scheduled_delivery_date 
      ? format(new Date(sale.scheduled_delivery_date + 'T12:00:00'), 'dd/MM', { locale: ptBR })
      : '___';

    return (
      <div className="bg-white text-black" style={{ 
        width: '80mm', 
        fontSize: '10px',
        padding: '2mm',
        fontFamily: 'monospace',
      }}>
        <div className="text-center border-b border-dashed border-black pb-1 mb-1">
          <div className="font-bold text-lg">ROM #{sale.romaneio_number}</div>
          <div style={{ fontSize: '8px' }}>{format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</div>
        </div>

        <div className="mb-2">
          <div className="font-bold">{sale.lead?.name}</div>
          <div>{sale.lead?.whatsapp}</div>
          {addressData?.street && (
            <div style={{ fontSize: '9px' }}>
              {addressData.street}, {addressData.street_number}
              {addressData.complement && ` - ${addressData.complement}`}
              <br />
              {addressData.neighborhood} - {addressData.cep}
              <br />
              {addressData.city}/{addressData.state}
            </div>
          )}
          {deliveryNotes && (
            <div style={{ fontSize: '8px' }} className="mt-1">
              <strong>REF:</strong> {deliveryNotes}
            </div>
          )}
        </div>

        <div className="text-center mb-2">
          <span className="font-bold border border-black px-2 py-0.5">
            {getDeliveryLabel(sale)}
          </span>
          <span className="ml-2">ENT: {formattedDeliveryDate}</span>
        </div>

        <table className="w-full" style={{ fontSize: '9px' }}>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td>{item.quantity}x {item.product_name}</td>
                <td className="text-right">{formatCurrency(item.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black mt-2 pt-1 text-right font-bold text-base">
          TOTAL: {formatCurrency(sale.total_cents)}
        </div>

        {sale.payment_confirmed_at && (
          <div className="text-center mt-1 font-bold">✓ PAGO</div>
        )}

        {/* QR Code - larger for easier scanning */}
        <div className="text-center mt-2">
          <QRCodeSVG value={saleQrData} size={80} />
          <p style={{ fontSize: '7px' }} className="mt-1">Escanear p/ detalhes</p>
        </div>

        <div className="text-center mt-2 border-t border-dashed border-black pt-1" style={{ fontSize: '8px' }}>
          ☐ Entregue ☐ Ausente ☐ Recusou
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-[800px] w-full max-w-[800px] mx-auto" />
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="p-8 text-center">
        <p>Nenhuma venda selecionada</p>
        <Button onClick={() => navigate('/expedicao')} className="mt-4">
          Voltar para expedição
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Screen controls - hidden when printing */}
      <div className="print:hidden p-4 bg-background border-b flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/expedicao')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex-1 text-center text-sm text-muted-foreground">
          {sales.length} romaneios para impressão
        </div>
        <Button onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Todos
        </Button>
      </div>

      {/* Print content */}
      <div className="print:p-0 p-4">
        {printFormat === 'thermal' ? (
          // Thermal: one per page
          sales.map((sale, index) => (
            <div key={sale.id} className="print:break-after-page">
              {renderThermalContent(sale)}
            </div>
          ))
        ) : printFormat === 'a5x2' ? (
          // A5x2: two romaneios per A4 page
          <div className="flex flex-col">
            {Array.from({ length: Math.ceil(sales.length / 1) }).map((_, pageIndex) => {
              const sale = sales[pageIndex];
              if (!sale) return null;
              return (
                <div key={sale.id} className="print:break-after-page" style={{ 
                  width: '210mm',
                  height: '297mm',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                }}>
                  {renderA5Content(sale, false)}
                  <div className="border-t border-dashed border-gray-400 my-0.5" />
                  {renderA5Content(sale, true)}
                </div>
              );
            })}
          </div>
        ) : (
          // A5: one romaneio per page
          sales.map((sale) => (
            <div key={sale.id} className="print:break-after-page mb-4 print:mb-0">
              {renderA5Content(sale)}
            </div>
          ))
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: ${printFormat === 'thermal' ? '80mm auto' : 'A4'};
            margin: ${printFormat === 'thermal' ? '0' : '5mm'};
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:break-after-page {
            break-after: page;
          }
        }
      `}</style>
    </>
  );
}

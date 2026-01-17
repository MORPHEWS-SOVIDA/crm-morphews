import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer, MapPin, Package, Truck, Store } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSale, formatCurrency, getStatusLabel } from '@/hooks/useSales';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

type PrintFormat = 'a5' | 'a5x2' | 'thermal';

// Maximum items that fit on a single A5 page
const MAX_ITEMS_A5 = 6;

export default function RomaneioPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: sale, isLoading } = useSale(id);
  const { profile } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  const printFormat = (searchParams.get('format') as PrintFormat) || 'a5';
  const autoPrint = searchParams.get('auto') === 'true';
  
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [deliveryUserName, setDeliveryUserName] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string | null>(null);
  const [carrierName, setCarrierName] = useState<string | null>(null);

  // Fetch seller, delivery user, region and carrier names
  useEffect(() => {
    const fetchAdditionalData = async () => {
      if (!sale) return;

      // Fetch seller name
      if (sale.seller_user_id) {
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', sale.seller_user_id)
          .maybeSingle();
        
        if (sellerProfile) {
          setSellerName(`${sellerProfile.first_name} ${sellerProfile.last_name}`);
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
          setDeliveryUserName(`${deliveryProfile.first_name} ${deliveryProfile.last_name}`);
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
          setRegionName(region.name);
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
          setCarrierName(carrier.name);
        }
      }
    };

    fetchAdditionalData();
  }, [sale]);

  const handlePrint = (format?: PrintFormat) => {
    if (format && format !== printFormat) {
      navigate(`/vendas/${id}/romaneio?format=${format}&auto=true`);
    } else {
      window.print();
    }
  };

  // Auto print on load
  useEffect(() => {
    if (autoPrint && sale) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [autoPrint, sale]);

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-[800px] w-full max-w-[800px] mx-auto" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-8 text-center">
        <p>Venda não encontrada</p>
        <Button onClick={() => navigate('/vendas')} className="mt-4">
          Voltar para vendas
        </Button>
      </div>
    );
  }

  const saleQrData = `${window.location.origin}/vendas/${sale.id}`;
  const googleMapsLink = sale.lead?.google_maps_link;
  const deliveryNotes = sale.lead?.delivery_notes;

  // Format delivery date and shift
  const getShiftLabel = (shift: string | null) => {
    if (!shift) return '';
    const shifts: Record<string, string> = {
      morning: 'MANHÃ',
      afternoon: 'TARDE',
      full_day: 'DIA TODO',
    };
    return shifts[shift] || shift.toUpperCase();
  };

  const formattedDeliveryDate = sale.scheduled_delivery_date 
    ? format(new Date(sale.scheduled_delivery_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
    : null;

  // Determine delivery type label and icon
  const getDeliveryInfo = () => {
    if (!sale.delivery_type || sale.delivery_type === 'pickup') {
      return { label: 'RETIRADA', icon: Store };
    }
    if (sale.delivery_type === 'motoboy') {
      return { label: `MOTOBOY${regionName ? ` - ${regionName}` : ''}`, icon: Truck };
    }
    if (sale.delivery_type === 'carrier') {
      return { label: `TRANSP.${carrierName ? ` ${carrierName}` : ''}`, icon: Package };
    }
    return { label: 'ENTREGA', icon: Truck };
  };

  const deliveryInfo = getDeliveryInfo();
  const DeliveryIcon = deliveryInfo.icon;

  // Check if we need overflow page for A5 format
  const items = sale.items || [];
  const needsOverflow = printFormat !== 'thermal' && items.length > MAX_ITEMS_A5;
  const mainPageItems = needsOverflow ? items.slice(0, MAX_ITEMS_A5 - 1) : items;
  const overflowItems = needsOverflow ? items.slice(MAX_ITEMS_A5 - 1) : [];

  // Render A5 content (single romaneio)
  const renderA5Content = (isSecondCopy = false) => (
    <div className={`romaneio-a5 bg-white text-black p-3 ${isSecondCopy ? 'mt-0' : ''}`} style={{ 
      width: '148mm', 
      minHeight: printFormat === 'a5x2' ? '105mm' : '210mm',
      maxHeight: printFormat === 'a5x2' ? '105mm' : '210mm',
      fontSize: '9px',
      overflow: 'hidden',
      pageBreakInside: 'avoid'
    }}>
      {/* Header */}
      <div className="border border-black p-2 mb-2">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold">ROM: #{sale.romaneio_number}</h1>
            <p className="text-[8px]">
              <strong>VEND:</strong> {sellerName || `${profile?.first_name} ${profile?.last_name}`}
            </p>
            <p className="text-[8px]">
              <strong>EMISSÃO:</strong> {format(new Date(sale.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
            </p>
          </div>
          <div className="text-right text-[8px]">
            {deliveryUserName && <p><strong>ENTREG:</strong> {deliveryUserName}</p>}
            <p><strong>ENTREGA:</strong> {formattedDeliveryDate || '___/___/___'}</p>
            <p><strong>TURNO:</strong> {getShiftLabel(sale.scheduled_delivery_shift) || '______'}</p>
          </div>
        </div>
      </div>

      {/* Client Info */}
      <div className="border border-black p-2 mb-2">
        <p className="font-bold text-sm">{sale.lead?.name}</p>
        <p className="text-[8px]"><strong>TEL:</strong> {sale.lead?.whatsapp}</p>
      </div>

      {/* Address - Compact */}
      <div className="border border-black p-2 mb-2">
        {sale.lead?.street ? (
          <>
            <p className="text-[8px]">{sale.lead.street}, {sale.lead.street_number} {sale.lead.complement && `- ${sale.lead.complement}`}</p>
            <p className="text-[8px]"><strong>BAIRRO:</strong> {sale.lead.neighborhood} | <strong>CEP:</strong> {sale.lead.cep}</p>
            <p className="text-[8px]">{sale.lead.city}/{sale.lead.state}</p>
          </>
        ) : (
          <p className="text-gray-500 text-[8px]">Endereço não cadastrado</p>
        )}
        {deliveryNotes && <p className="text-[8px] mt-1 bg-gray-100 p-1 rounded">{deliveryNotes}</p>}
      </div>

      {/* Delivery Type + QR Codes */}
      <div className="border border-black p-2 mb-2 flex justify-between items-center">
        <div className="flex items-center gap-1">
          <DeliveryIcon className="w-4 h-4" />
          <span className="font-semibold text-[10px]">{deliveryInfo.label}</span>
        </div>
        <div className="flex gap-2">
          <QRCodeSVG value={saleQrData} size={35} />
          {googleMapsLink && <QRCodeSVG value={googleMapsLink} size={35} />}
        </div>
      </div>

      {/* Products Table - Compact */}
      <div className="border border-black mb-2">
        <table className="w-full text-[8px]">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="p-1 text-left">PRODUTO</th>
              <th className="p-1 text-center w-10">QTD</th>
              <th className="p-1 text-right w-16">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {mainPageItems.map((item, index) => (
              <tr key={item.id} className={index < mainPageItems.length - 1 ? 'border-b border-gray-300' : ''}>
                <td className="p-1">
                  {item.product_name}
                  {item.requisition_number && <span className="text-[7px] text-amber-700 block">Req: {item.requisition_number}</span>}
                </td>
                <td className="p-1 text-center">{item.quantity}</td>
                <td className="p-1 text-right">{formatCurrency(item.total_cents)}</td>
              </tr>
            ))}
            {needsOverflow && (
              <tr className="border-t border-black bg-yellow-50">
                <td colSpan={3} className="p-1 text-center font-semibold text-[9px]">
                  ⚠️ VER FOLHA EM ANEXO (+{overflowItems.length} itens)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment & Total */}
      <div className="border border-black p-2 mb-2">
        <div className="flex justify-between items-center text-[9px]">
          <span><strong>PAGO?</strong> {sale.payment_confirmed_at ? '✓ SIM' : 'NÃO'}</span>
          <span className="font-bold text-sm">TOTAL: {formatCurrency(sale.total_cents)}</span>
        </div>
      </div>

      {/* Delivery Status - Compact */}
      <div className="border border-black p-2 mb-2">
        <div className="flex flex-wrap gap-2 text-[7px]">
          <label className="flex items-center gap-1">
            <span className="w-2 h-2 border border-black inline-block"></span>Entregue
          </label>
          <label className="flex items-center gap-1">
            <span className="w-2 h-2 border border-black inline-block"></span>Ausente
          </label>
          <label className="flex items-center gap-1">
            <span className="w-2 h-2 border border-black inline-block"></span>Recusou
          </label>
          <label className="flex items-center gap-1">
            <span className="w-2 h-2 border border-black inline-block"></span>Outro:___
          </label>
        </div>
      </div>

      {/* Signatures - Compact */}
      <div className="border border-black p-2">
        <div className="grid grid-cols-3 gap-2 text-[7px]">
          <div>
            <p className="mb-4">Expedição:</p>
            <div className="border-t border-black"></div>
          </div>
          <div>
            <p className="mb-4">Recebido:</p>
            <div className="border-t border-black"></div>
          </div>
          <div>
            <p className="mb-4">Entregador:</p>
            <div className="border-t border-black"></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render overflow page with remaining items
  const renderOverflowPage = () => (
    <div className="romaneio-overflow bg-white text-black p-3" style={{ 
      width: '148mm', 
      minHeight: '210mm',
      fontSize: '9px',
      pageBreakBefore: 'always'
    }}>
      <div className="border border-black p-2 mb-2">
        <h1 className="text-lg font-bold">ROM: #{sale.romaneio_number} - ITENS ADICIONAIS</h1>
        <p className="text-[8px]">{sale.lead?.name}</p>
      </div>

      <div className="border border-black">
        <table className="w-full text-[8px]">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="p-1 text-left">PRODUTO</th>
              <th className="p-1 text-center w-10">QTD</th>
              <th className="p-1 text-right w-16">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {overflowItems.map((item, index) => (
              <tr key={item.id} className={index < overflowItems.length - 1 ? 'border-b border-gray-300' : ''}>
                <td className="p-1">
                  {item.product_name}
                  {item.requisition_number && <span className="text-[7px] text-amber-700 block">Req: {item.requisition_number}</span>}
                </td>
                <td className="p-1 text-center">{item.quantity}</td>
                <td className="p-1 text-right">{formatCurrency(item.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render thermal format (80mm receipt style)
  const renderThermalContent = () => (
    <div className="romaneio-thermal bg-white text-black p-2" style={{ 
      width: '80mm',
      fontSize: '10px',
      fontFamily: 'monospace'
    }}>
      {/* Header */}
      <div className="text-center border-b-2 border-black border-dashed pb-2 mb-2">
        <p className="font-bold text-lg">ROMANEIO #{sale.romaneio_number}</p>
        <p className="text-[9px]">{format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</p>
      </div>

      {/* Seller/Delivery Info */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-[9px]">
        <p><strong>VEND:</strong> {sellerName || `${profile?.first_name} ${profile?.last_name}`}</p>
        {deliveryUserName && <p><strong>ENTREG:</strong> {deliveryUserName}</p>}
        <p><strong>ENTREGA:</strong> {formattedDeliveryDate || '-'} {getShiftLabel(sale.scheduled_delivery_shift)}</p>
      </div>

      {/* Client */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <p className="font-bold">{sale.lead?.name}</p>
        <p className="text-[9px]">TEL: {sale.lead?.whatsapp}</p>
      </div>

      {/* Address */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-[9px]">
        {sale.lead?.street ? (
          <>
            <p>{sale.lead.street}, {sale.lead.street_number}</p>
            {sale.lead.complement && <p>{sale.lead.complement}</p>}
            <p>{sale.lead.neighborhood}</p>
            <p>{sale.lead.city}/{sale.lead.state} - {sale.lead.cep}</p>
          </>
        ) : (
          <p>Endereço não cadastrado</p>
        )}
        {deliveryNotes && <p className="mt-1 p-1 bg-gray-100">REF: {deliveryNotes}</p>}
      </div>

      {/* Delivery Type */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-center">
        <p className="font-bold">{deliveryInfo.label}</p>
      </div>

      {/* Products */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <p className="font-bold text-center mb-1">PRODUTOS</p>
        <div className="border-t border-b border-gray-300 py-1">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-[9px] py-0.5">
              <span className="flex-1">
                {item.quantity}x {item.product_name}
                {item.requisition_number && <span className="text-[8px] block text-amber-700">Req:{item.requisition_number}</span>}
              </span>
              <span className="ml-2">{formatCurrency(item.total_cents)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment & Total */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <div className="flex justify-between text-[10px]">
          <span>PAGO:</span>
          <span className="font-bold">{sale.payment_confirmed_at ? 'SIM ✓' : 'NÃO'}</span>
        </div>
        {sale.discount_cents > 0 && (
          <div className="flex justify-between text-[9px]">
            <span>Desconto:</span>
            <span>-{formatCurrency(sale.discount_cents)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg mt-1 pt-1 border-t border-black">
          <span>TOTAL:</span>
          <span>{formatCurrency(sale.total_cents)}</span>
        </div>
      </div>

      {/* Delivery Status Checkboxes */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-[9px]">
        <p className="font-bold mb-1">OCORRÊNCIA:</p>
        <div className="space-y-0.5">
          <p>[ ] Entregue</p>
          <p>[ ] Ausente</p>
          <p>[ ] Recusou</p>
          <p>[ ] End. não encontrado</p>
          <p>[ ] Outro: ________</p>
        </div>
      </div>

      {/* QR Code */}
      <div className="text-center py-2">
        <QRCodeSVG value={saleQrData} size={50} />
        <p className="text-[8px] mt-1">Escaneie para detalhes</p>
      </div>

      {/* Signatures */}
      <div className="pt-2 text-[9px] space-y-3">
        <div>
          <p>Recebido por:</p>
          <div className="border-b border-black mt-4"></div>
        </div>
        <div>
          <p>Entregador:</p>
          <div className="border-b border-black mt-4"></div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden fixed top-4 left-4 right-4 z-50 flex items-center justify-between bg-background p-4 rounded-lg shadow-lg border">
        <Button variant="ghost" onClick={() => navigate(`/vendas/${sale.id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant={printFormat === 'a5' ? 'default' : 'outline'} size="sm" onClick={() => handlePrint('a5')}>
            A5
          </Button>
          <Button variant={printFormat === 'a5x2' ? 'default' : 'outline'} size="sm" onClick={() => handlePrint('a5x2')}>
            A5x2
          </Button>
          <Button variant={printFormat === 'thermal' ? 'default' : 'outline'} size="sm" onClick={() => handlePrint('thermal')}>
            T
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Printable Content */}
      <div ref={printRef} className="romaneio-print mx-auto mt-20 print:mt-0">
        {printFormat === 'thermal' ? (
          renderThermalContent()
        ) : printFormat === 'a5x2' ? (
          <div className="a5x2-container">
            {renderA5Content(false)}
            <div className="a5-divider border-t-2 border-dashed border-gray-400 my-0" style={{ width: '148mm' }}></div>
            {renderA5Content(true)}
          </div>
        ) : (
          <>
            {renderA5Content(false)}
            {needsOverflow && renderOverflowPage()}
          </>
        )}
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .romaneio-print, .romaneio-print * {
            visibility: visible;
          }
          .romaneio-print {
            position: absolute;
            left: 0;
            top: 0;
          }
          
          ${printFormat === 'a5' ? `
            @page {
              size: A5 portrait;
              margin: 5mm;
            }
          ` : ''}
          
          ${printFormat === 'a5x2' ? `
            @page {
              size: A4 portrait;
              margin: 5mm;
            }
            .a5x2-container {
              display: flex;
              flex-direction: column;
            }
            .a5-divider {
              height: 0;
              border-top: 1px dashed #999;
            }
          ` : ''}
          
          ${printFormat === 'thermal' ? `
            @page {
              size: 80mm auto;
              margin: 2mm;
            }
            .romaneio-thermal {
              width: 76mm !important;
            }
          ` : ''}
        }
        
        /* Preview styles */
        .romaneio-print {
          background: white;
          padding: 10px;
        }
      `}</style>
    </>
  );
}

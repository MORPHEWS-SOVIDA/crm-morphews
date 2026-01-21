import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSale, formatCurrency } from '@/hooks/useSales';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

type PrintFormat = 'a5' | 'a5x2' | 'thermal';

// Maximum items that fit on a single A5 page (optimized layout)
const MAX_ITEMS_A5 = 10;

// Helper to format item display with kit info for romaneio
// Example outputs: "Kit 12 × 1 = 12 frascos" or "5 unidades"
interface RomaneioItem {
  id: string;
  product_name: string;
  quantity: number;
  total_cents: number;
  requisition_number?: string | null;
  kit_id?: string | null;
  kit_quantity?: number;
  multiplier?: number;
}

function formatRomaneioQuantity(item: RomaneioItem): { label: string; tooltip: string } {
  const kitQty = item.kit_quantity || 1;
  const mult = item.multiplier || item.quantity;
  const totalUnits = kitQty * mult;
  
  if (kitQty > 1) {
    // Has kit: show "Kit X × Y" format
    return {
      label: mult > 1 ? `Kit ${kitQty}×${mult}` : `Kit ${kitQty}`,
      tooltip: `${totalUnits} frascos`,
    };
  } else {
    // No kit: just show quantity
    return {
      label: `${totalUnits}`,
      tooltip: `${totalUnits} ${totalUnits === 1 ? 'unidade' : 'unidades'}`,
    };
  }
}

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

  // Use production URL for QR code so it works when scanned
  const saleQrData = `https://sales.morphews.com/vendas/${sale.id}`;
  
  // Use shipping_address if available, otherwise use lead address
  const shippingAddress = (sale as any).shipping_address;
  const addressData = shippingAddress || sale.lead;
  const deliveryNotes = shippingAddress?.delivery_notes || sale.lead?.delivery_notes;
  const observation1 = (sale as any).observation_1;
  const observation2 = (sale as any).observation_2;

  // Format delivery date and shift
  const getShiftLabel = (shift: string | null) => {
    if (!shift) return '';
    const shifts: Record<string, string> = {
      morning: 'M',
      afternoon: 'T',
      full_day: 'D',
    };
    return shifts[shift] || '';
  };

  const formattedDeliveryDate = sale.scheduled_delivery_date 
    ? format(new Date(sale.scheduled_delivery_date + 'T12:00:00'), 'dd/MM', { locale: ptBR })
    : '___';

  // Determine delivery type label
  const getDeliveryLabel = () => {
    if (!sale.delivery_type || sale.delivery_type === 'pickup') {
      return 'RETIRADA';
    }
    if (sale.delivery_type === 'motoboy') {
      return regionName ? regionName.toUpperCase() : 'ENTREGA';
    }
    if (sale.delivery_type === 'carrier') {
      return carrierName ? carrierName.toUpperCase() : 'TRANSPORTADORA';
    }
    return 'ENTREGA';
  };

  // Check if we need overflow page for A5 format
  const items = sale.items || [];
  const needsOverflow = printFormat !== 'thermal' && items.length > MAX_ITEMS_A5;
  const mainPageItems = needsOverflow ? items.slice(0, MAX_ITEMS_A5 - 1) : items;
  const overflowItems = needsOverflow ? items.slice(MAX_ITEMS_A5 - 1) : [];

  // Render optimized A5 content (single romaneio)
  const renderA5Content = (isSecondCopy = false) => (
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
      {/* Row 1: Header - ROM, VEND, EMISSÃO all in one line + ENTREGA date */}
      <div className="flex justify-between items-center border-b border-black pb-1 mb-1" style={{ fontSize: '9px' }}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-base">ROM: #{sale.romaneio_number}</span>
          <span><strong>VEND:</strong> {sellerName || `${profile?.first_name} ${profile?.last_name}`}</span>
          <span><strong>EMISSÃO:</strong> {format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span><strong>ENT:</strong> {formattedDeliveryDate} {getShiftLabel(sale.scheduled_delivery_shift)}</span>
          {deliveryUserName && <span>| {deliveryUserName}</span>}
        </div>
      </div>

      {/* Row 2: Client name + TEL in one line, with QR codes on the right */}
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1">
          <div className="flex items-center gap-2" style={{ fontSize: '11px' }}>
            <span className="font-bold">{sale.lead?.name}</span>
            <span className="text-gray-700">TEL: {sale.lead?.whatsapp}</span>
          </div>
          
          {/* Address - compact single/dual line */}
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
          
          {/* Delivery notes if any */}
          {deliveryNotes && (
            <div style={{ fontSize: '8px' }} className="mt-0.5 bg-gray-100 px-1 py-0.5 inline-block">
              <strong>REF:</strong> {deliveryNotes}
            </div>
          )}
          
          {/* Integration observations - important for expedition */}
          {(observation1 || observation2) && (
            <div style={{ fontSize: '8px' }} className="mt-0.5 bg-yellow-100 px-1 py-0.5 border border-yellow-500">
              <strong>⚠️ ATENÇÃO EXPEDIÇÃO:</strong>
              {observation1 && <span className="ml-1">{observation1}</span>}
              {observation2 && <span className="ml-1">| {observation2}</span>}
            </div>
          )}
          
          {/* Delivery type badge */}
          <div className="mt-1">
            <span className="font-bold border border-black px-2 py-0.5" style={{ fontSize: '10px' }}>
              {getDeliveryLabel()}
            </span>
            {sale.payment_confirmed_at && (
              <span className="ml-2 bg-green-600 text-white px-2 py-0.5" style={{ fontSize: '9px' }}>
                ✓ PAGO
              </span>
            )}
          </div>
        </div>
        
        {/* QR Code - link to sale page for quick access */}
        <div className="flex flex-col items-center ml-2">
          <QRCodeSVG value={saleQrData} size={70} />
          <span style={{ fontSize: '6px' }} className="text-gray-500 mt-0.5">Escanear p/ detalhes</span>
        </div>
      </div>

      {/* Products Table - Compact */}
      <table className="w-full border-collapse border border-black" style={{ fontSize: '8px' }}>
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-0.5 text-left">PRODUTO</th>
            <th className="border border-black p-0.5 text-center" style={{ width: '25px' }}>QTD</th>
            <th className="border border-black p-0.5 text-right" style={{ width: '55px' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {mainPageItems.map((item) => {
            const qtyInfo = formatRomaneioQuantity(item as RomaneioItem);
            return (
              <tr key={item.id}>
                <td className="border border-black p-0.5">
                  {item.product_name}
                  {item.requisition_number && (
                    <span className="text-amber-700 ml-1" style={{ fontSize: '7px' }}>Req:{item.requisition_number}</span>
                  )}
                </td>
                <td className="border border-black p-0.5 text-center font-bold" title={qtyInfo.tooltip}>
                  {qtyInfo.label}
                </td>
                <td className="border border-black p-0.5 text-right">{formatCurrency(item.total_cents)}</td>
              </tr>
            );
          })}
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

      {/* Footer: Status checkboxes + Signatures - all compact */}
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
            <span>Recebido</span>
          </div>
          <div className="text-center">
            <div className="border-b border-black" style={{ width: '50px', marginBottom: '1px' }}></div>
            <span>Entregador</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Render overflow page with remaining items
  const renderOverflowPage = () => (
    <div className="romaneio-overflow bg-white text-black" style={{ 
      width: '148mm', 
      minHeight: '200mm',
      fontSize: '8px',
      padding: '2mm',
      pageBreakBefore: 'always'
    }}>
      <div className="flex justify-between items-center border-b border-black pb-1 mb-2" style={{ fontSize: '9px' }}>
        <span className="font-bold text-base">ROM: #{sale.romaneio_number} - ITENS ADICIONAIS</span>
        <span>{sale.lead?.name}</span>
      </div>

      <table className="w-full border-collapse border border-black" style={{ fontSize: '8px' }}>
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-0.5 text-left">PRODUTO</th>
            <th className="border border-black p-0.5 text-center" style={{ width: '25px' }}>QTD</th>
            <th className="border border-black p-0.5 text-right" style={{ width: '55px' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {overflowItems.map((item) => {
            const qtyInfo = formatRomaneioQuantity(item as RomaneioItem);
            return (
              <tr key={item.id}>
                <td className="border border-black p-0.5">
                  {item.product_name}
                  {item.requisition_number && (
                    <span className="text-amber-700 ml-1" style={{ fontSize: '7px' }}>Req:{item.requisition_number}</span>
                  )}
                </td>
                <td className="border border-black p-0.5 text-center font-bold" title={qtyInfo.tooltip}>
                  {qtyInfo.label}
                </td>
                <td className="border border-black p-0.5 text-right">{formatCurrency(item.total_cents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Render thermal format (80mm receipt style)
  const renderThermalContent = () => (
    <div className="romaneio-thermal bg-white text-black p-1" style={{ 
      width: '80mm',
      fontSize: '10px',
      fontFamily: 'monospace'
    }}>
      {/* Header */}
      <div className="text-center border-b-2 border-black border-dashed pb-1 mb-1">
        <p className="font-bold text-base">ROM #{sale.romaneio_number}</p>
        <p style={{ fontSize: '9px' }}>{sellerName || `${profile?.first_name} ${profile?.last_name}`} | {format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</p>
      </div>

      {/* Delivery Info */}
      <div className="border-b border-dashed border-gray-400 pb-1 mb-1" style={{ fontSize: '9px' }}>
        <p><strong>ENT:</strong> {formattedDeliveryDate} {getShiftLabel(sale.scheduled_delivery_shift)} {deliveryUserName && `| ${deliveryUserName}`}</p>
      </div>

      {/* Client */}
      <div className="border-b border-dashed border-gray-400 pb-1 mb-1">
        <p className="font-bold">{sale.lead?.name}</p>
        <p style={{ fontSize: '9px' }}>TEL: {sale.lead?.whatsapp}</p>
      </div>

      {/* Address */}
      <div className="border-b border-dashed border-gray-400 pb-1 mb-1" style={{ fontSize: '9px' }}>
        {addressData?.street ? (
          <>
            <p>{addressData.street}, {addressData.street_number}</p>
            {addressData.complement && <p>{addressData.complement}</p>}
            <p>{addressData.neighborhood} - {addressData.cep}</p>
            <p>{addressData.city}/{addressData.state}</p>
          </>
        ) : (
          <p>Endereço não cadastrado</p>
        )}
        {deliveryNotes && <p className="mt-1 p-1 bg-gray-100">REF: {deliveryNotes}</p>}
        {(observation1 || observation2) && (
          <p className="mt-1 p-1 bg-yellow-100 border border-yellow-400">
            <strong>⚠️ ATENÇÃO:</strong> {observation1}{observation2 && ` | ${observation2}`}
          </p>
        )}
      </div>

      {/* Delivery Type */}
      <div className="border-b border-dashed border-gray-400 pb-1 mb-1 text-center">
        <p className="font-bold">{getDeliveryLabel()}</p>
      </div>

      {/* Products */}
      <div className="border-b border-dashed border-gray-400 pb-1 mb-1">
        <p className="font-bold text-center mb-1">PRODUTOS</p>
        <div className="border-t border-b border-gray-300 py-1">
          {items.map((item) => {
            const qtyInfo = formatRomaneioQuantity(item as RomaneioItem);
            return (
              <div key={item.id} className="flex justify-between py-0.5" style={{ fontSize: '9px' }}>
                <span className="flex-1">
                  <span className="font-bold">{qtyInfo.label}</span> {item.product_name}
                  {item.requisition_number && <span style={{ fontSize: '8px' }} className="block text-amber-700">Req:{item.requisition_number}</span>}
                </span>
                <span className="ml-2">{formatCurrency(item.total_cents)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment & Total */}
      <div className="border-b border-dashed border-gray-400 pb-1 mb-1">
        <div className="flex justify-between" style={{ fontSize: '10px' }}>
          <span>PAGO:</span>
          <span className="font-bold">{sale.payment_confirmed_at ? 'SIM ✓' : 'NÃO'}</span>
        </div>
        {sale.discount_cents > 0 && (
          <div className="flex justify-between" style={{ fontSize: '9px' }}>
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
      <div className="border-b border-dashed border-gray-400 pb-1 mb-1" style={{ fontSize: '9px' }}>
        <p className="font-bold mb-1">OCORRÊNCIA:</p>
        <div className="space-y-0.5">
          <p>[ ] Entregue</p>
          <p>[ ] Ausente</p>
          <p>[ ] Recusou</p>
          <p>[ ] Outro: ________</p>
        </div>
      </div>

      {/* QR Code - larger for easier scanning */}
      <div className="text-center py-2">
        <QRCodeSVG value={saleQrData} size={80} />
        <p style={{ fontSize: '8px' }} className="mt-1">Escaneie para detalhes</p>
      </div>

      {/* Signatures */}
      <div className="pt-2 space-y-3" style={{ fontSize: '9px' }}>
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
          <div className="a5x2-container" style={{ width: '148mm' }}>
            {renderA5Content(false)}
            <div className="a5-divider" style={{ 
              width: '148mm', 
              borderTop: '1px dashed #666',
              margin: '0'
            }}></div>
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
              margin: 3mm;
            }
            .romaneio-a5 {
              width: 142mm !important;
              min-height: auto !important;
            }
          ` : ''}
          
          ${printFormat === 'a5x2' ? `
            @page {
              size: A4 portrait;
              margin: 3mm;
            }
            .a5x2-container {
              width: 148mm !important;
            }
            .romaneio-a5 {
              width: 144mm !important;
              height: 102mm !important;
              min-height: 102mm !important;
              max-height: 102mm !important;
              overflow: hidden !important;
            }
            .a5-divider {
              height: 0 !important;
              border-top: 1px dashed #666 !important;
              margin: 0 !important;
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
        }
      `}</style>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer, MapPin, Package, Truck, Store } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSale, formatCurrency, getStatusLabel } from '@/hooks/useSales';
import { useAuth } from '@/hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

export default function RomaneioPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: sale, isLoading } = useSale(id);
  const { profile } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
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

  const handlePrint = () => {
    window.print();
  };

  // Auto print on load if coming from print button
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auto') === 'true' && sale) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [sale]);

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
      return { label: 'RETIRADA NO BALCÃO', icon: Store };
    }
    if (sale.delivery_type === 'motoboy') {
      return { label: `TELE-ENTREGA (MOTOBOY)${regionName ? ` - ${regionName}` : ''}`, icon: Truck };
    }
    if (sale.delivery_type === 'carrier') {
      return { label: `TRANSPORTADORA${carrierName ? ` - ${carrierName}` : ''}`, icon: Package };
    }
    return { label: 'TELE-ENTREGA', icon: Truck };
  };

  const deliveryInfo = getDeliveryInfo();
  const DeliveryIcon = deliveryInfo.icon;

  return (
    <>
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden fixed top-4 left-4 right-4 z-50 flex items-center justify-between bg-background p-4 rounded-lg shadow-lg border">
        <Button variant="ghost" onClick={() => navigate(`/vendas/${sale.id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Printable Content */}
      <div ref={printRef} className="romaneio-print max-w-[800px] mx-auto p-8 print:p-4 print:max-w-none bg-white text-black">
        {/* Header */}
        <div className="border-2 border-black p-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">ROMANEIO: #{sale.romaneio_number}</h1>
              <p className="text-sm mt-1">
                <strong>VENDEDOR:</strong> {sellerName || profile?.first_name + ' ' + profile?.last_name}
              </p>
              <p className="text-sm">
                <strong>DATA DE EMISSÃO:</strong> {format(new Date(sale.created_at), "dd/MM/yyyy - HH:mm:ss", { locale: ptBR })}
              </p>
              <p className="text-sm">
                <strong>Status:</strong> {getStatusLabel(sale.status).toUpperCase()}
              </p>
            </div>
            <div className="text-right text-sm">
              {deliveryUserName && (
                <p className="font-semibold"><strong>ENTREGADOR:</strong> {deliveryUserName}</p>
              )}
              <p><strong>DATA DE ENTREGA:</strong> {formattedDeliveryDate || '___/___/______'}</p>
              <p><strong>TURNO:</strong> {getShiftLabel(sale.scheduled_delivery_shift) || '_________________'}</p>
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-lg border-b border-black pb-1 mb-2"># CLIENTE</h2>
          <p className="font-semibold">{sale.lead?.name}</p>
          <p className="text-sm">
            <strong>FONE/CEL:</strong> {sale.lead?.whatsapp}
            {sale.lead?.secondary_phone && <span> / {sale.lead.secondary_phone}</span>}
            {sale.lead?.email && <span> - <strong>EMAIL:</strong> {sale.lead.email}</span>}
          </p>
        </div>

        {/* Address */}
        <div className="border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-lg border-b border-black pb-1 mb-2"># ENDEREÇO</h2>
          {sale.lead?.street ? (
            <>
              <p>{sale.lead.street}, {sale.lead.street_number} {sale.lead.complement && `- ${sale.lead.complement}`}</p>
              <p><strong>BAIRRO:</strong> {sale.lead.neighborhood}</p>
              <p><strong>CEP:</strong> {sale.lead.cep} - {sale.lead.city}/{sale.lead.state} - Brasil</p>
            </>
          ) : (
            <p className="text-gray-500">Endereço não cadastrado</p>
          )}
        </div>

        {/* Delivery Reference & QR Codes */}
        <div className="border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-lg border-b border-black pb-1 mb-2"># REFERÊNCIA PARA ENTREGA</h2>
          
          {deliveryNotes ? (
            <p className="mb-3 p-2 bg-gray-100 rounded">{deliveryNotes}</p>
          ) : (
            <p className="text-sm text-gray-500 mb-3">_________________________________</p>
          )}

          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold mb-1">LINK DA VENDA:</p>
              <div className="flex items-center gap-2">
                <QRCodeSVG value={saleQrData} size={60} />
                <p className="text-xs text-gray-500">Aponte para ver detalhes da venda</p>
              </div>
            </div>
            
            {googleMapsLink && (
              <div className="flex-1">
                <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  LOCALIZAÇÃO NO MAPA:
                </p>
                <div className="flex items-center gap-2">
                  <QRCodeSVG value={googleMapsLink} size={60} />
                  <p className="text-xs text-gray-500">Aponte para abrir no Google Maps</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Type */}
        <div className="border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-lg"># TIPO DE ENTREGA</h2>
          <div className="flex items-center gap-2 mt-1">
            <DeliveryIcon className="w-5 h-5" />
            <p className="font-semibold">{deliveryInfo.label}</p>
          </div>
          {sale.shipping_cost_cents && sale.shipping_cost_cents > 0 && (
            <p className="text-sm mt-1"><strong>FRETE:</strong> {formatCurrency(sale.shipping_cost_cents)}</p>
          )}
        </div>

        {/* Products Table */}
        <div className="border-2 border-black mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black bg-gray-100">
                <th className="p-2 text-left border-r border-black">PRODUTO</th>
                <th className="p-2 text-center border-r border-black w-20">QTD</th>
                <th className="p-2 text-right border-r border-black w-24">UNIT.</th>
                <th className="p-2 text-right w-24">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, index) => (
                <tr key={item.id} className={index < (sale.items?.length || 0) - 1 ? 'border-b border-black' : ''}>
                  <td className="p-2 border-r border-black">
                    {item.product_name}
                    {item.requisition_number && (
                      <span className="text-xs font-semibold block text-amber-700">
                        Requisição: {item.requisition_number}
                      </span>
                    )}
                    {item.notes && <span className="text-xs text-gray-500 block">({item.notes})</span>}
                  </td>
                  <td className="p-2 text-center border-r border-black">{item.quantity}</td>
                  <td className="p-2 text-right border-r border-black">{formatCurrency(item.unit_price_cents)}</td>
                  <td className="p-2 text-right">{formatCurrency(item.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment Info */}
        <div className="border-2 border-black p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span><strong>VENDA ESTÁ PAGA?:</strong> {sale.payment_confirmed_at ? 'SIM ✓' : 'NÃO'}</span>
            {sale.payment_method && <span><strong>FORMA:</strong> {sale.payment_method}</span>}
          </div>
          {sale.discount_cents > 0 && (
            <div className="text-sm mb-1">
              <span><strong>DESCONTO:</strong> -{formatCurrency(sale.discount_cents)}</span>
            </div>
          )}
          <div className="text-right text-xl font-bold border-t border-black pt-2 mt-2">
            TOTAL DO ROMANEIO: {formatCurrency(sale.total_cents)}
          </div>
        </div>

        {/* Delivery Status Options */}
        <div className="border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-sm mb-2">OCORRÊNCIAS DE ENTREGA:</h2>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-1">
              <span className="w-3 h-3 border border-black inline-block"></span>
              Entregue
            </label>
            <label className="flex items-center gap-1">
              <span className="w-3 h-3 border border-black inline-block"></span>
              Ausente
            </label>
            <label className="flex items-center gap-1">
              <span className="w-3 h-3 border border-black inline-block"></span>
              Recusou
            </label>
            <label className="flex items-center gap-1">
              <span className="w-3 h-3 border border-black inline-block"></span>
              Endereço não encontrado
            </label>
            <label className="flex items-center gap-1">
              <span className="w-3 h-3 border border-black inline-block"></span>
              Fora do horário
            </label>
            <label className="flex items-center gap-1">
              <span className="w-3 h-3 border border-black inline-block"></span>
              Reagendado
            </label>
          </div>
          <div className="mt-2 text-xs">
            <label className="flex items-center gap-1">
              <span className="w-3 h-3 border border-black inline-block"></span>
              Outro: _______________________________________________
            </label>
          </div>
        </div>

        {/* Signatures */}
        <div className="border-2 border-black p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="mb-8">Conferência (Expedição):</p>
              <div className="border-t border-black"></div>
            </div>
            <div>
              <p className="mb-8">Recebido por:</p>
              <div className="border-t border-black"></div>
            </div>
            <div>
              <p className="mb-8">Entregador:</p>
              <div className="border-t border-black"></div>
            </div>
          </div>
        </div>
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
            width: 100%;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </>
  );
}
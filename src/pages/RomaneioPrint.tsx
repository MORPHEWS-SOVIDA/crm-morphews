import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer } from 'lucide-react';
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

  // Fetch seller and delivery user names
  useEffect(() => {
    const fetchUserNames = async () => {
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
    };

    fetchUserNames();
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

  const qrData = `${window.location.origin}/vendas/${sale.id}`;

  // Determine delivery type label
  const getDeliveryTypeLabel = () => {
    if (!sale.delivery_type || sale.delivery_type === 'pickup') return 'RETIRADA NO BALCÃO';
    if (sale.delivery_type === 'motoboy') return 'TELE-ENTREGA (MOTOBOY)';
    if (sale.delivery_type === 'carrier') return 'TRANSPORTADORA';
    return 'TELE-ENTREGA';
  };

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
                <strong>DIGITADOR:</strong> {profile?.first_name} {profile?.last_name}
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
                <p><strong>ENTREGADOR:</strong> {deliveryUserName}</p>
              )}
              <p><strong>DATA DE ENTREGA:</strong> ___/___/______</p>
              <p><strong>TURNO:</strong> _________________</p>
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-lg border-b border-black pb-1 mb-2"># CLIENTE</h2>
          <p className="font-semibold">{sale.lead?.name}</p>
          <p className="text-sm">
            <strong>FONE/CEL:</strong> {sale.lead?.whatsapp}
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
            <p className="text-muted-foreground">Endereço não cadastrado</p>
          )}
        </div>

        {/* QR Code and Reference */}
        <div className="border-2 border-black p-4 mb-4 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg mb-2"># REFERÊNCIA PARA ENTREGA</h2>
            <p className="text-sm text-muted-foreground">_________________________________</p>
            <p className="text-xs mt-2">APONTE SEU CELULAR PARA ESTE CÓDIGO:</p>
          </div>
          <div className="flex-shrink-0">
            <QRCodeSVG value={qrData} size={80} />
          </div>
        </div>

        {/* Delivery Type */}
        <div className="border-2 border-black p-4 mb-4">
          <h2 className="font-bold text-lg"># TIPO DE ENTREGA</h2>
          <p className="font-semibold">{getDeliveryTypeLabel()}</p>
        </div>

        {/* Products Table */}
        <div className="border-2 border-black mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black bg-gray-100">
                <th className="p-2 text-left border-r border-black">PRODUTO</th>
                <th className="p-2 text-left border-r border-black">DESCRIÇÃO</th>
                <th className="p-2 text-center border-r border-black">QUANTIDADE</th>
                <th className="p-2 text-right border-r border-black">VALOR UNIT.</th>
                <th className="p-2 text-right">VALOR TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, index) => (
                <tr key={item.id} className={index < (sale.items?.length || 0) - 1 ? 'border-b border-black' : ''}>
                  <td className="p-2 border-r border-black">{item.product_id.slice(0, 6)}</td>
                  <td className="p-2 border-r border-black">{item.product_name}</td>
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
            <span><strong>EXIGE RECEITA:</strong> NÃO</span>
            <span><strong>VENDA ESTA PAGA, É SÓ ENTREGAR?:</strong> {sale.payment_confirmed_at ? 'SIM' : 'NÃO'}</span>
          </div>
          <div className="text-right text-xl font-bold">
            TOTAL DO ROMANEIO: {formatCurrency(sale.total_cents)}
          </div>
        </div>

        {/* Delivery Status Options */}
        <div className="border-2 border-black p-4 mb-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Sem receita
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Sem notificação
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Sem dinheiro
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Endereço insuficiente
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Fora do horário
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Ausente
            </label>
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Recusou
            </label>
          </div>
          <div className="mt-2 text-sm">
            <label className="flex items-center gap-1">
              <span className="w-4 h-4 border border-black inline-block"></span>
              Outro: _______________________________________________
            </label>
          </div>
        </div>

        {/* Signatures */}
        <div className="border-2 border-black p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="mb-8">Conferência:</p>
              <div className="border-t border-black"></div>
            </div>
            <div>
              <p className="mb-8">Destinatário:</p>
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
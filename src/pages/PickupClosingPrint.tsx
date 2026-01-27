import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/hooks/useSales';
import { formatPaymentMethod } from '@/hooks/usePickupClosings';
import { Loader2 } from 'lucide-react';

export default function PickupClosingPrint() {
  const { closingId } = useParams<{ closingId: string }>();

  // Fetch closing data
  const { data: closing, isLoading: loadingClosing } = useQuery({
    queryKey: ['pickup-closing-print', closingId],
    queryFn: async () => {
      if (!closingId) return null;

      const { data, error } = await supabase
        .from('pickup_closings')
        .select('*')
        .eq('id', closingId)
        .single();

      if (error) throw error;

      // Fetch creator profile
      let creatorName = 'Sistema';
      if (data.created_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', data.created_by)
          .single();
        if (profile) {
          creatorName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        }
      }

      return { ...data, creator_name: creatorName };
    },
    enabled: !!closingId,
  });

  // Fetch sales in this closing
  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['pickup-closing-sales-print', closingId],
    queryFn: async () => {
      if (!closingId) return [];

      const { data, error } = await supabase
        .from('pickup_closing_sales')
        .select('*')
        .eq('closing_id', closingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!closingId,
  });

  // Group sales by payment method
  const groupedSales = React.useMemo(() => {
    const groups: Record<string, typeof sales> = {
      card: [],
      pix: [],
      cash: [],
      other: [],
    };

    sales.forEach(sale => {
      const method = (sale.payment_method || '').toLowerCase();
      if (method.includes('cartao') || method.includes('cartão') || method.includes('card') || method.includes('credito') || method.includes('débito') || method.includes('debito')) {
        groups.card.push(sale);
      } else if (method.includes('pix')) {
        groups.pix.push(sale);
      } else if (method.includes('dinheiro') || method.includes('cash') || method.includes('especie')) {
        groups.cash.push(sale);
      } else {
        groups.other.push(sale);
      }
    });

    return groups;
  }, [sales]);

  // Auto-print on load
  useEffect(() => {
    if (closing && sales.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [closing, sales]);

  if (loadingClosing || loadingSales) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!closing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Fechamento não encontrado</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          font-family: 'Segoe UI', system-ui, sans-serif;
          font-size: 12px;
          line-height: 1.4;
        }
        .print-container {
          max-width: 210mm;
          margin: 0 auto;
          padding: 10mm;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: 600;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .total-row { background-color: #f0f0f0; }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          margin: 20px 0 10px;
          padding-bottom: 5px;
          border-bottom: 2px solid #333;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #333;
        }
        .header h1 {
          font-size: 20px;
          margin: 0 0 5px;
        }
        .header h2 {
          font-size: 16px;
          margin: 0 0 10px;
          color: #666;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 20px 0;
        }
        .summary-box {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: center;
          border-radius: 4px;
        }
        .summary-box .label {
          font-size: 11px;
          color: #666;
        }
        .summary-box .value {
          font-size: 16px;
          font-weight: 700;
        }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          font-size: 10px;
          color: #666;
        }
        .signature-area {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }
        .signature-line {
          border-top: 1px solid #333;
          padding-top: 5px;
          text-align: center;
          font-size: 11px;
        }
      `}</style>

      <div className="print-container">
        {/* Header */}
        <div className="header">
          <h1>📋 FECHAMENTO DE CAIXA BALCÃO</h1>
          <h2>Redução Z - Nº {closing.closing_number}</h2>
          <div style={{ fontSize: '12px' }}>
            <strong>Data:</strong> {format(parseISO(closing.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            <span style={{ margin: '0 10px' }}>|</span>
            <strong>Operador:</strong> {closing.creator_name}
          </div>
        </div>

        {/* Summary */}
        <div className="summary-grid">
          <div className="summary-box" style={{ backgroundColor: '#f0f0ff' }}>
            <div className="label">Total Vendas</div>
            <div className="value">{closing.total_sales}</div>
          </div>
          <div className="summary-box" style={{ backgroundColor: '#e8f5e9' }}>
            <div className="label">Valor Total</div>
            <div className="value" style={{ color: '#2e7d32' }}>{formatCurrency(closing.total_amount_cents)}</div>
          </div>
          <div className="summary-box">
            <div className="label">Data Fechamento</div>
            <div className="value" style={{ fontSize: '14px' }}>{format(parseISO(closing.closing_date), "dd/MM/yyyy")}</div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="section-title">📊 RESUMO POR FORMA DE PAGAMENTO</div>
        <table>
          <thead>
            <tr>
              <th>Forma de Pagamento</th>
              <th className="text-center">Qtd</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>💳 Cartão (Crédito/Débito)</td>
              <td className="text-center">{groupedSales.card.length}</td>
              <td className="text-right font-bold">{formatCurrency(closing.total_card_cents)}</td>
            </tr>
            <tr>
              <td>📱 PIX</td>
              <td className="text-center">{groupedSales.pix.length}</td>
              <td className="text-right font-bold">{formatCurrency(closing.total_pix_cents)}</td>
            </tr>
            <tr>
              <td>💵 Dinheiro</td>
              <td className="text-center">{groupedSales.cash.length}</td>
              <td className="text-right font-bold">{formatCurrency(closing.total_cash_cents)}</td>
            </tr>
            {closing.total_other_cents > 0 && (
              <tr>
                <td>📄 Outros</td>
                <td className="text-center">{groupedSales.other.length}</td>
                <td className="text-right font-bold">{formatCurrency(closing.total_other_cents)}</td>
              </tr>
            )}
            <tr className="total-row">
              <td className="font-bold">TOTAL</td>
              <td className="text-center font-bold">{closing.total_sales}</td>
              <td className="text-right font-bold">{formatCurrency(closing.total_amount_cents)}</td>
            </tr>
          </tbody>
        </table>

        {/* Cash Sales Detail (individual listing for audit) */}
        {groupedSales.cash.length > 0 && (
          <>
            <div className="section-title">💵 DETALHAMENTO - VENDAS EM DINHEIRO</div>
            <table>
              <thead>
                <tr>
                  <th>Nº Venda</th>
                  <th>Cliente</th>
                  <th>Entrega</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {groupedSales.cash.map(sale => (
                  <tr key={sale.id}>
                    <td className="font-bold">#{sale.sale_number}</td>
                    <td>{sale.lead_name || 'Cliente'}</td>
                    <td>{sale.delivered_at ? format(parseISO(sale.delivered_at), "dd/MM HH:mm") : '-'}</td>
                    <td className="text-right font-bold">{formatCurrency(sale.total_cents || 0)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={3} className="font-bold">SUBTOTAL DINHEIRO</td>
                  <td className="text-right font-bold">{formatCurrency(closing.total_cash_cents)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* All Sales List */}
        <div className="section-title">📋 LISTA COMPLETA DE VENDAS</div>
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Cliente</th>
              <th>Pagamento</th>
              <th>Entrega</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale, index) => (
              <tr key={sale.id}>
                <td className="font-bold">#{sale.sale_number}</td>
                <td>{sale.lead_name || 'Cliente'}</td>
                <td>{formatPaymentMethod(sale.payment_method)}</td>
                <td>{sale.delivered_at ? format(parseISO(sale.delivered_at), "dd/MM HH:mm") : '-'}</td>
                <td className="text-right">{formatCurrency(sale.total_cents || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signature Area */}
        <div className="signature-area">
          <div>
            <div className="signature-line">
              Conferido por (Auxiliar)<br/>
              Data: ____/____/____
            </div>
          </div>
          <div>
            <div className="signature-line">
              Conferência Final (Responsável)<br/>
              Data: ____/____/____
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Fechamento #{closing.closing_number} • Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</span>
            <span>Sistema de Gestão</span>
          </div>
        </div>
      </div>

      {/* Print button (no-print) */}
      <div className="no-print fixed bottom-4 right-4">
        <button 
          onClick={() => window.print()}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-purple-700 flex items-center gap-2"
        >
          🖨️ Imprimir
        </button>
      </div>
    </>
  );
}

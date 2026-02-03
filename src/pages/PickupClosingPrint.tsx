import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/hooks/useSales';
import { formatPaymentMethod } from '@/hooks/usePickupClosings';
import { Loader2 } from 'lucide-react';
import { getCategoryConfig, PAYMENT_CATEGORIES, type PaymentCategory } from '@/lib/paymentCategories';

// Map closing_type to display title
const closingTypeLabels: Record<string, { title: string; emoji: string }> = {
  balcao: { title: 'FECHAMENTO DE CAIXA BALCÃO', emoji: '🏪' },
  motoboy: { title: 'FECHAMENTO MOTOBOY', emoji: '🏍️' },
  transportadora: { title: 'FECHAMENTO TRANSPORTADORA', emoji: '🚚' },
};

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

  // Fetch sales in this closing - join with actual sales to get payment info
  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['pickup-closing-sales-print', closingId],
    queryFn: async () => {
      if (!closingId) return [];

      // Get closing sales with sale_ids
      const { data: closingSalesData, error: csError } = await supabase
        .from('pickup_closing_sales')
        .select('*')
        .eq('closing_id', closingId)
        .order('created_at', { ascending: true });

      if (csError) throw csError;
      if (!closingSalesData || closingSalesData.length === 0) return [];

      // Get actual sales data with payment info
      const saleIds = closingSalesData.map(cs => cs.sale_id);
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          payment_method,
          payment_method_id,
          payment_methods:payment_method_id (
            id,
            name,
            category
          )
        `)
        .in('id', saleIds);

      if (salesError) throw salesError;

      // Create a map for quick lookup
      const salesMap = new Map(salesData?.map(s => [s.id, s]));

      // Enrich closing sales with payment info from sales table
      return closingSalesData.map(cs => {
        const saleData = salesMap.get(cs.sale_id);
        const paymentMethod = saleData?.payment_methods as { id: string; name: string; category: string } | null;
        
        return {
          ...cs,
          payment_method: paymentMethod?.name || saleData?.payment_method || cs.payment_method,
          payment_category: paymentMethod?.category || null,
        };
      });
    },
    enabled: !!closingId,
  });

  // Group sales by payment category (use category from payment_methods table if available)
  const groupedByCategory = React.useMemo(() => {
    const groups: Record<PaymentCategory, typeof sales> = {
      cash: [],
      pix: [],
      card_machine: [],
      payment_link: [],
      ecommerce: [],
      boleto_prepaid: [],
      boleto_postpaid: [],
      boleto_installment: [],
      gift: [],
      other: [],
    };

    sales.forEach(sale => {
      // First, try to use the category from payment_methods table
      if (sale.payment_category && sale.payment_category in groups) {
        groups[sale.payment_category as PaymentCategory].push(sale);
        return;
      }
      
      // Fallback: infer from payment_method text
      const method = (sale.payment_method || '').toLowerCase();
      
      // Match to categories based on keywords
      if (method.includes('cartao') || method.includes('cartão') || method.includes('card') || 
          method.includes('credito') || method.includes('crédito') || method.includes('débito') || 
          method.includes('debito') || method.includes('maquininha')) {
        groups.card_machine.push(sale);
      } else if (method.includes('pix')) {
        groups.pix.push(sale);
      } else if (method.includes('dinheiro') || method.includes('cash') || method.includes('especie') || method.includes('espécie')) {
        groups.cash.push(sale);
      } else if (method.includes('link') && method.includes('pagamento')) {
        groups.payment_link.push(sale);
      } else if (method.includes('ecommerce') || method.includes('e-commerce') || method.includes('loja virtual')) {
        groups.ecommerce.push(sale);
      } else if (method.includes('boleto') && (method.includes('pré') || method.includes('pre') || method.includes('antes') || method.includes('antecip'))) {
        groups.boleto_prepaid.push(sale);
      } else if (method.includes('boleto') && (method.includes('pós') || method.includes('pos') || method.includes('depois') || method.includes('faturado'))) {
        groups.boleto_postpaid.push(sale);
      } else if (method.includes('boleto') && method.includes('parcel')) {
        groups.boleto_installment.push(sale);
      } else if (method.includes('boleto')) {
        // Generic boleto - put in prepaid by default
        groups.boleto_prepaid.push(sale);
      } else if (method.includes('vale') || method.includes('presente') || method.includes('gift')) {
        groups.gift.push(sale);
      } else {
        groups.other.push(sale);
      }
    });

    return groups;
  }, [sales]);

  // Calculate totals by category
  const categoryTotals = React.useMemo(() => {
    const totals: Record<PaymentCategory, number> = {
      cash: 0,
      pix: 0,
      card_machine: 0,
      payment_link: 0,
      ecommerce: 0,
      boleto_prepaid: 0,
      boleto_postpaid: 0,
      boleto_installment: 0,
      gift: 0,
      other: 0,
    };

    Object.entries(groupedByCategory).forEach(([cat, salesList]) => {
      totals[cat as PaymentCategory] = salesList.reduce((sum, s) => sum + (s.total_cents || 0), 0);
    });

    return totals;
  }, [groupedByCategory]);

  // Get closing type info
  const closingTypeInfo = closing?.closing_type 
    ? closingTypeLabels[closing.closing_type] || closingTypeLabels.balcao
    : closingTypeLabels.balcao;

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

  // Render a sales block for a category
  const renderCategoryBlock = (category: PaymentCategory, salesList: typeof sales) => {
    if (salesList.length === 0) return null;
    
    const config = getCategoryConfig(category);
    const total = categoryTotals[category];

    return (
      <div key={category} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
        <div className="category-title" style={{ 
          fontSize: '13px', 
          fontWeight: 600, 
          marginBottom: '8px',
          padding: '6px 10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{config.emoji} {config.label.toUpperCase()}</span>
          <span style={{ color: '#2e7d32' }}>{salesList.length} vendas • {formatCurrency(total)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Cliente</th>
              <th>Entrega</th>
              <th className="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {salesList.map(sale => (
              <tr key={sale.id}>
                <td className="font-bold">#{sale.sale_number}</td>
                <td>{sale.lead_name || 'Cliente'}</td>
                <td>{sale.delivered_at ? format(parseISO(sale.delivered_at), "dd/MM HH:mm") : '-'}</td>
                <td className="text-right">{formatCurrency(sale.total_cents || 0)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan={3} className="font-bold">SUBTOTAL {config.label.toUpperCase()}</td>
              <td className="text-right font-bold">{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Order for rendering: card_machine, pix, cash, then others
  const renderOrder: PaymentCategory[] = [
    'card_machine',
    'pix',
    'cash',
    'payment_link',
    'ecommerce',
    'boleto_prepaid',
    'boleto_postpaid',
    'boleto_installment',
    'gift',
    'other',
  ];

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
          padding: 5px 8px;
          text-align: left;
        }
        th {
          background-color: #f5f5f5;
          font-weight: 600;
          font-size: 11px;
        }
        td {
          font-size: 11px;
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
          <h1>{closingTypeInfo.emoji} {closingTypeInfo.title}</h1>
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
            {PAYMENT_CATEGORIES.map(cat => {
              const count = groupedByCategory[cat.key]?.length || 0;
              const total = categoryTotals[cat.key] || 0;
              if (count === 0) return null;
              return (
                <tr key={cat.key}>
                  <td>{cat.emoji} {cat.label}</td>
                  <td className="text-center">{count}</td>
                  <td className="text-right font-bold">{formatCurrency(total)}</td>
                </tr>
              );
            })}
            <tr className="total-row">
              <td className="font-bold">TOTAL</td>
              <td className="text-center font-bold">{closing.total_sales}</td>
              <td className="text-right font-bold">{formatCurrency(closing.total_amount_cents)}</td>
            </tr>
          </tbody>
        </table>

        {/* Grouped Sales by Payment Category */}
        <div className="section-title">📋 VENDAS AGRUPADAS POR FORMA DE PAGAMENTO</div>
        {renderOrder.map(cat => renderCategoryBlock(cat, groupedByCategory[cat]))}

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

// Helpers to interpret payment proof sources for sales

export type ProofSource =
  | 'webhook_payt'
  | 'webhook_mercadopago'
  | 'webhook_shopify'
  | 'external_system'
  | 'pos_terminal'
  | 'manual_upload'
  | string;

export interface SaleProofInput {
  payment_proof_url?: string | null;
  proof_source?: string | null;
  external_order_id?: string | null;
  external_order_url?: string | null;
  external_source?: string | null;
  pos_transaction_id?: string | null;
  payment_status?: string | null;
  status?: string | null;
}

/** A sale is considered to have a valid proof if any of these are true. */
export function hasPaymentProof(sale: SaleProofInput): boolean {
  if (!sale) return false;
  if (sale.payment_proof_url) return true;
  if (sale.proof_source) return true;
  if (sale.pos_transaction_id) return true;
  if (sale.external_order_id && sale.payment_status === 'confirmed') return true;
  return false;
}

/** Resolve the effective proof source even when the column was not backfilled. */
export function resolveProofSource(sale: SaleProofInput): ProofSource | null {
  if (!sale) return null;
  if (sale.proof_source) return sale.proof_source;
  if (sale.payment_proof_url) return 'manual_upload';
  if (sale.pos_transaction_id) return 'pos_terminal';
  if (sale.external_order_id && sale.payment_status === 'confirmed') {
    const src = (sale.external_source || sale.external_order_url || '').toLowerCase();
    if (src.includes('payt')) return 'webhook_payt';
    if (src.includes('mercado') || src.includes('mp')) return 'webhook_mercadopago';
    if (src.includes('shopify')) return 'webhook_shopify';
    return 'external_system';
  }
  return null;
}

export interface ProofBadge {
  label: string;
  /** Tailwind utility classes for the badge */
  className: string;
  /** Single emoji icon */
  icon: string;
}

export function getProofBadge(source: ProofSource | null): ProofBadge | null {
  if (!source) return null;
  switch (source) {
    case 'webhook_payt':
      return { label: 'Comprovante Payt', icon: '🔗', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'webhook_mercadopago':
      return { label: 'Comprovante Mercado Pago', icon: '🔗', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'webhook_shopify':
      return { label: 'Comprovante Shopify', icon: '🔗', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'external_system':
      return { label: 'Comprovante sistema externo', icon: '🌐', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'pos_terminal':
      return { label: 'Comprovante maquininha', icon: '💳', className: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'manual_upload':
      return { label: 'Comprovante anexado', icon: '📎', className: 'bg-green-50 text-green-700 border-green-200' };
    default:
      return { label: 'Comprovante registrado', icon: '✅', className: 'bg-green-50 text-green-700 border-green-200' };
  }
}

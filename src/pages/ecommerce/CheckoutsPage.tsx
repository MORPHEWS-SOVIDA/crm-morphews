import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { CheckoutsManager } from '@/components/ecommerce/checkout/CheckoutsManager';

export default function CheckoutsPage() {
  return (
    <EcommerceLayout
      title="Checkouts"
      description="Crie páginas de pagamento personalizadas com link direto"
    >
      <CheckoutsManager />
    </EcommerceLayout>
  );
}

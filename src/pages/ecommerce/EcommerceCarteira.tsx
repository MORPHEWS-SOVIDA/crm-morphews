import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { VirtualAccountPanel } from '@/components/ecommerce/VirtualAccountPanel';

export default function EcommerceCarteira() {
  return (
    <EcommerceLayout 
      title="Carteira Virtual" 
      description="Acompanhe seu saldo e transações"
    >
      <VirtualAccountPanel />
    </EcommerceLayout>
  );
}

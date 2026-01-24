import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { IndustriesManager } from '@/components/ecommerce/IndustriesManager';

export default function EcommerceIndustrias() {
  return (
    <EcommerceLayout 
      title="Indústrias" 
      description="Configure custos de produção e fornecedores"
    >
      <IndustriesManager />
    </EcommerceLayout>
  );
}

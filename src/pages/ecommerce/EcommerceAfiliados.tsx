import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { AffiliatesManager } from '@/components/ecommerce/AffiliatesManager';

export default function EcommerceAfiliados() {
  return (
    <EcommerceLayout 
      title="Afiliados" 
      description="Gerencie seu programa de afiliados"
    >
      <AffiliatesManager />
    </EcommerceLayout>
  );
}

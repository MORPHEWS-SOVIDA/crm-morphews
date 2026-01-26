import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { PartnersManager } from '@/components/ecommerce/partners/PartnersManager';

export default function EcommerceParceiros() {
  return (
    <EcommerceLayout 
      title="Parceiros" 
      description="Gerencie afiliados, co-produtores, indústrias e fábricas"
    >
      <PartnersManager />
    </EcommerceLayout>
  );
}

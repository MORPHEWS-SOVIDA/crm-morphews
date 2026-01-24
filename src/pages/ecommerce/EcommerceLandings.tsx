import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { LandingPagesManager } from '@/components/ecommerce/LandingPagesManager';

export default function EcommerceLandings() {
  return (
    <EcommerceLayout 
      title="Landing Pages" 
      description="Crie páginas de venda para seus produtos"
    >
      <LandingPagesManager />
    </EcommerceLayout>
  );
}

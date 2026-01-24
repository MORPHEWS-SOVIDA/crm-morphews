import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { StorefrontsManager } from '@/components/ecommerce/StorefrontsManager';

export default function EcommerceLojas() {
  return (
    <EcommerceLayout 
      title="Lojas Online" 
      description="Crie e gerencie suas lojas virtuais com seus produtos"
    >
      <StorefrontsManager />
    </EcommerceLayout>
  );
}

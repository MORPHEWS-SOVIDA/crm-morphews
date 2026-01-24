import { EcommerceLayout } from '@/components/ecommerce/EcommerceLayout';
import { EmailMarketingManager } from '@/pages/ecommerce/EmailMarketingManager';

export default function EcommerceEmails() {
  return (
    <EcommerceLayout 
      title="E-mail Marketing" 
      description="Configure campanhas de e-mail para seus clientes"
    >
      <EmailMarketingManager />
    </EcommerceLayout>
  );
}

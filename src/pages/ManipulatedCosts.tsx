import { SmartLayout } from '@/components/layout/SmartLayout';
import { ManipulatedCostsManager } from '@/components/products/ManipulatedCostsManager';
import { useNavigate } from 'react-router-dom';

export default function ManipulatedCosts() {
  const navigate = useNavigate();

  return (
    <SmartLayout>
      <ManipulatedCostsManager onClose={() => navigate('/produtos')} />
    </SmartLayout>
  );
}

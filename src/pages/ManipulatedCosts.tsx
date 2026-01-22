import { useEffect } from 'react';
import { SmartLayout } from '@/components/layout/SmartLayout';
import { ManipulatedCostsManager } from '@/components/products/ManipulatedCostsManager';
import { useNavigate } from 'react-router-dom';
import { useOrgHasFeature } from '@/hooks/usePlanFeatures';
import { Loader2 } from 'lucide-react';

export default function ManipulatedCosts() {
  const navigate = useNavigate();
  const { data: hasFeature, isLoading } = useOrgHasFeature("manipulated_costs");

  useEffect(() => {
    // Redirect if feature is not enabled (after loading)
    if (!isLoading && hasFeature === false) {
      navigate('/produtos', { replace: true });
    }
  }, [hasFeature, isLoading, navigate]);

  if (isLoading) {
    return (
      <SmartLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SmartLayout>
    );
  }

  if (!hasFeature) {
    return null; // Will redirect
  }

  return (
    <SmartLayout>
      <ManipulatedCostsManager onClose={() => navigate('/produtos')} />
    </SmartLayout>
  );
}

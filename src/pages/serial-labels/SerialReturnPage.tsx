import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ReturnScanPanel } from '@/components/serial-labels/ReturnScanPanel';
import { ArrowLeft, RotateCcw } from 'lucide-react';

export default function SerialReturnPage() {
  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <RotateCcw className="h-5 w-5 text-purple-600" />
        <h1 className="text-xl font-bold">Devolução ao Estoque</h1>
      </div>
      <ReturnScanPanel />
    </div>
  );
}

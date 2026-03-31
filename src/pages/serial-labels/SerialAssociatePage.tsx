import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AssignSerialsToProduct } from '@/components/serial-labels/AssignSerialsToProduct';
import { ArrowLeft, QrCode } from 'lucide-react';

export default function SerialAssociatePage() {
  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <QrCode className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Associar Etiquetas ao Produto</h1>
      </div>
      <AssignSerialsToProduct />
    </div>
  );
}

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Printer, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RomaneioPrintButtonsProps {
  saleId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function RomaneioPrintButtons({ 
  saleId, 
  variant = 'outline', 
  size = 'sm',
  showLabel = true 
}: RomaneioPrintButtonsProps) {
  const navigate = useNavigate();

  const handlePrint = (format: 'a5' | 'a5x2' | 'thermal') => {
    navigate(`/vendas/${saleId}/romaneio?format=${format}&auto=true`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1">
          <Printer className="w-4 h-4" />
          {showLabel && <span className="hidden sm:inline">Imprimir</span>}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handlePrint('a5')}>
          <span className="font-semibold mr-2">A5</span>
          <span className="text-muted-foreground text-xs">Meia folha</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePrint('a5x2')}>
          <span className="font-semibold mr-2">A5x2</span>
          <span className="text-muted-foreground text-xs">2 cópias (A4)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handlePrint('thermal')}>
          <span className="font-semibold mr-2">T</span>
          <span className="text-muted-foreground text-xs">Térmica 80mm</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

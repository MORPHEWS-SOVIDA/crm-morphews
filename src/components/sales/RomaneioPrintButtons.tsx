import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';

interface RomaneioPrintButtonsProps {
  saleId: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function RomaneioPrintButtons({ 
  saleId, 
  size = 'sm'
}: RomaneioPrintButtonsProps) {
  const navigate = useNavigate();

  const handlePrint = (format: 'a5' | 'a5x2' | 'thermal') => {
    navigate(`/vendas/${saleId}/romaneio?format=${format}&auto=true`);
  };

  return (
    <TooltipProvider>
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size={size} 
              onClick={() => handlePrint('a5')}
              className="min-w-[40px] font-semibold"
            >
              A5
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Meia folha A4</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size={size} 
              onClick={() => handlePrint('a5x2')}
              className="min-w-[40px] font-semibold"
            >
              A5x2
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>2 cópias em folha A4 (para cortar)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size={size} 
              onClick={() => handlePrint('thermal')}
              className="min-w-[32px] font-semibold"
            >
              T
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Térmica 80mm (cupom)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

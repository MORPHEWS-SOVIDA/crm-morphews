import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Selecione...',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-start font-normal min-h-10 h-auto',
            !selected.length && 'text-muted-foreground',
            className
          )}
        >
          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selected.map((value) => {
                const option = options.find((o) => o.value === value);
                return (
                  <Badge
                    key={value}
                    variant="secondary"
                    className="mr-1"
                  >
                    {option?.label || value}
                    <button
                      className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => handleRemove(value, e)}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          ) : (
            placeholder
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-2 bg-popover" align="start">
        <div className="max-h-60 overflow-auto space-y-1">
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
              onClick={() => handleToggle(option.value)}
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => handleToggle(option.value)}
              />
              <span className="text-sm">{option.label}</span>
            </div>
          ))}
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground p-2">
              Nenhuma opção disponível
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

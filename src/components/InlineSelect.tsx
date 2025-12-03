import { useState } from 'react';
import { Check, X, Pencil, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface InlineSelectOption {
  value: string;
  label: string;
}

interface InlineSelectProps {
  value: string | null;
  options: InlineSelectOption[];
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
}

export function InlineSelect({
  value,
  options,
  onSave,
  placeholder = 'Selecione...',
  className,
  displayClassName,
}: InlineSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');

  const handleSave = () => {
    if (editValue) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const displayLabel = options.find((opt) => opt.value === value)?.label || value || placeholder;

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Select
          value={editValue}
          onValueChange={(val) => setEditValue(val)}
        >
          <SelectTrigger className="h-8 min-w-[200px]">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
            onClick={handleSave}
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
            onClick={handleCancel}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        'group cursor-pointer flex items-center gap-2 rounded-md px-2 py-1 -mx-2 -my-1 hover:bg-muted/50 transition-colors',
        displayClassName
      )}
    >
      <span className={cn(!value && 'text-muted-foreground italic')}>
        {displayLabel}
      </span>
      <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addHours, addMinutes, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowupDateTimeEditorProps {
  suggestedHours: number;
  onConfirm: (scheduledAt: Date) => void;
  disabled?: boolean;
}

export function FollowupDateTimeEditor({ 
  suggestedHours, 
  onConfirm,
  disabled = false 
}: FollowupDateTimeEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => addHours(new Date(), suggestedHours));
  const [timeValue, setTimeValue] = useState(() => format(addHours(new Date(), suggestedHours), 'HH:mm'));
  
  // Calculate the scheduled date based on suggested hours
  const suggestedDate = addHours(new Date(), suggestedHours);
  
  const handleTimeChange = (value: string) => {
    setTimeValue(value);
    const [hours, minutes] = value.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const newDate = setMinutes(setHours(selectedDate, hours), minutes);
      setSelectedDate(newDate);
    }
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      const newDate = setMinutes(setHours(date, hours || 0), minutes || 0);
      setSelectedDate(newDate);
    }
  };
  
  const handleConfirmEdit = () => {
    onConfirm(selectedDate);
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setSelectedDate(suggestedDate);
    setTimeValue(format(suggestedDate, 'HH:mm'));
    setIsEditing(false);
  };
  
  const handleAcceptSuggestion = () => {
    onConfirm(suggestedDate);
  };

  // Quick options
  const quickOptions = [
    { label: '30 min', addFn: () => addMinutes(new Date(), 30) },
    { label: '1h', addFn: () => addHours(new Date(), 1) },
    { label: '2h', addFn: () => addHours(new Date(), 2) },
    { label: '4h', addFn: () => addHours(new Date(), 4) },
    { label: 'Amanhã 9h', addFn: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }},
  ];

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <Clock className="w-4 h-4 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Follow-up sugerido:</p>
          <p className="text-xs text-muted-foreground">
            {format(suggestedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            <span className="ml-1 text-blue-600">({suggestedHours}h a partir de agora)</span>
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            disabled={disabled}
            className="h-8 px-2"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Editar
          </Button>
          <Button
            size="sm"
            onClick={handleAcceptSuggestion}
            disabled={disabled}
            className="h-8 px-2 bg-blue-600 hover:bg-blue-700"
          >
            <Check className="w-3 h-3 mr-1" />
            Aceitar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          Quando fazer o follow-up?
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancelEdit}
          className="h-6 px-2 text-muted-foreground"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
      
      {/* Quick options */}
      <div className="flex flex-wrap gap-1">
        {quickOptions.map((option) => (
          <Button
            key={option.label}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const newDate = option.addFn();
              setSelectedDate(newDate);
              setTimeValue(format(newDate, 'HH:mm'));
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
      
      {/* Custom date/time */}
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              locale={ptBR}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>
        
        <Input
          type="time"
          value={timeValue}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="w-28"
        />
      </div>
      
      {/* Preview */}
      <div className="text-xs text-muted-foreground">
        Follow-up será agendado para: <span className="font-medium text-foreground">{format(selectedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
      </div>
      
      {/* Confirm */}
      <Button
        className="w-full bg-blue-600 hover:bg-blue-700"
        onClick={handleConfirmEdit}
        disabled={disabled}
      >
        <Check className="w-4 h-4 mr-2" />
        Confirmar Data/Hora
      </Button>
    </div>
  );
}
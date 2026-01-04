import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useContinuousMedications, 
  useCreateContinuousMedication, 
  filterMedicationSuggestions,
  ContinuousMedication 
} from '@/hooks/useContinuousMedications';

interface MedicationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MedicationAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Digite o nome do medicamento...",
  className 
}: MedicationAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedMedications, setSelectedMedications] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: medications = [] } = useContinuousMedications();
  const createMedication = useCreateContinuousMedication();

  // Parse initial value into selected medications
  useEffect(() => {
    if (value && selectedMedications.length === 0) {
      const meds = value.split(',').map(m => m.trim()).filter(Boolean);
      setSelectedMedications(meds);
    }
  }, [value]);

  // Update parent value when selected medications change
  useEffect(() => {
    const newValue = selectedMedications.join(', ');
    if (newValue !== value) {
      onChange(newValue);
    }
  }, [selectedMedications, onChange, value]);

  const suggestions = filterMedicationSuggestions(medications, inputValue);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelectMedication = async (medication: ContinuousMedication) => {
    if (!selectedMedications.includes(medication.name)) {
      setSelectedMedications([...selectedMedications, medication.name]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleAddNew = async () => {
    if (!inputValue.trim()) return;
    
    // Check if already selected
    if (selectedMedications.some(m => m.toLowerCase() === inputValue.trim().toLowerCase())) {
      setInputValue('');
      return;
    }

    try {
      const result = await createMedication.mutateAsync(inputValue.trim());
      setSelectedMedications([...selectedMedications, result.name]);
      setInputValue('');
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error creating medication:', error);
    }
  };

  const handleRemoveMedication = (medication: string) => {
    setSelectedMedications(selectedMedications.filter(m => m !== medication));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSelectMedication(suggestions[0]);
      } else if (inputValue.trim()) {
        handleAddNew();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Selected medications */}
      {selectedMedications.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedMedications.map((med, index) => (
            <Badge key={index} variant="secondary" className="text-xs pl-2 pr-1 py-1">
              <Pill className="w-3 h-3 mr-1" />
              {med}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                onClick={() => handleRemoveMedication(med)}
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="text-sm"
        />

        {/* Suggestions dropdown */}
        {showSuggestions && inputValue.trim() && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
            {suggestions.length > 0 ? (
              <>
                {suggestions.map((med) => (
                  <button
                    key={med.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                    onClick={() => handleSelectMedication(med)}
                  >
                    <span className="flex items-center gap-2">
                      <Pill className="w-3 h-3 text-muted-foreground" />
                      {med.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {med.usage_count}x
                    </span>
                  </button>
                ))}
                {!suggestions.some(m => m.name.toLowerCase() === inputValue.trim().toLowerCase()) && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent border-t flex items-center gap-2 text-primary"
                    onClick={handleAddNew}
                    disabled={createMedication.isPending}
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar "{inputValue.trim()}"
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 text-primary"
                onClick={handleAddNew}
                disabled={createMedication.isPending}
              >
                <Plus className="w-3 h-3" />
                Adicionar "{inputValue.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

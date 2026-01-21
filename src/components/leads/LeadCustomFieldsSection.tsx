import { useState, useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCustomFieldDefinitions,
  useLeadCustomFieldValues,
  useSaveCustomFieldValue,
} from '@/hooks/useLeadCustomFields';

interface LeadCustomFieldsSectionProps {
  leadId: string;
}

export function LeadCustomFieldsSection({ leadId }: LeadCustomFieldsSectionProps) {
  const { data: definitions = [], isLoading: loadingDefs } = useCustomFieldDefinitions();
  const { data: values = [], isLoading: loadingValues } = useLeadCustomFieldValues(leadId);
  const saveValue = useSaveCustomFieldValue();
  
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [editingField, setEditingField] = useState<string | null>(null);

  // Initialize local values from fetched data
  useEffect(() => {
    const initialValues: Record<string, string> = {};
    values.forEach(v => {
      initialValues[v.field_definition_id] = v.value || '';
    });
    setLocalValues(initialValues);
  }, [values]);

  if (loadingDefs || loadingValues) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold text-foreground">Campos Personalizados</h2>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (definitions.length === 0) {
    return null; // Don't show section if no custom fields defined
  }

  const handleSave = async (fieldDefId: string, value: string) => {
    await saveValue.mutateAsync({
      leadId,
      fieldDefinitionId: fieldDefId,
      value: value || null,
    });
    setEditingField(null);
  };

  const getValue = (fieldDefId: string) => {
    return localValues[fieldDefId] || '';
  };

  const handleChange = (fieldDefId: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [fieldDefId]: value }));
  };

  const handleBlur = (fieldDefId: string) => {
    const currentValue = getValue(fieldDefId);
    const originalValue = values.find(v => v.field_definition_id === fieldDefId)?.value || '';
    
    if (currentValue !== originalValue) {
      handleSave(fieldDefId, currentValue);
    }
    setEditingField(null);
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-semibold text-foreground">Campos Personalizados</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {definitions.map((def) => (
          <div key={def.id} className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">{def.field_label}</Label>
            
            {def.field_type === 'boolean' ? (
              <div className="flex items-center gap-2 h-10">
                <Switch
                  checked={getValue(def.id) === 'true'}
                  onCheckedChange={(checked) => {
                    const value = checked ? 'true' : 'false';
                    setLocalValues(prev => ({ ...prev, [def.id]: value }));
                    handleSave(def.id, value);
                  }}
                />
                <span className="text-sm">
                  {getValue(def.id) === 'true' ? 'Sim' : 'Não'}
                </span>
              </div>
            ) : def.field_type === 'date' ? (
              <Input
                type="date"
                value={getValue(def.id)}
                onChange={(e) => handleChange(def.id, e.target.value)}
                onBlur={() => handleBlur(def.id)}
                className="h-10"
              />
            ) : def.field_type === 'number' ? (
              <Input
                type="number"
                value={getValue(def.id)}
                onChange={(e) => handleChange(def.id, e.target.value)}
                onBlur={() => handleBlur(def.id)}
                placeholder="Clique para preencher"
                className="h-10"
              />
            ) : (
              <Input
                type="text"
                value={getValue(def.id)}
                onChange={(e) => handleChange(def.id, e.target.value)}
                onBlur={() => handleBlur(def.id)}
                placeholder="Clique para preencher"
                className="h-10"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { Lead } from '@/types/lead';
import { MobileLeadCard } from './MobileLeadCard';
import { User } from 'lucide-react';

interface MobileLeadsListProps {
  leads: Lead[];
  title: string;
}

export function MobileLeadsList({ leads, title }: MobileLeadsListProps) {
  if (leads.length === 0) {
    return (
      <div className="bg-card rounded-xl p-8 shadow-card text-center">
        <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum lead encontrado</h3>
        <p className="text-muted-foreground">Não há leads nesta categoria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="text-sm text-muted-foreground">{leads.length} leads</span>
      </div>
      
      <div className="space-y-3">
        {leads.map((lead) => (
          <MobileLeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

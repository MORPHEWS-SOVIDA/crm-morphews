import { Calendar, Clock, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  title: string;
  time: string;
  date: string;
  type: 'call' | 'meeting' | 'follow-up';
}

const mockEvents: Event[] = [
  { id: '1', title: 'Call com Roberto Almeida', time: '15:00', date: 'Sexta', type: 'call' },
  { id: '2', title: 'Follow-up Beatriz Lima', time: '10:00', date: 'Segunda', type: 'follow-up' },
  { id: '3', title: 'Reunião equipe vendas', time: '14:00', date: 'Segunda', type: 'meeting' },
  { id: '4', title: 'Demo para Camila Ferreira', time: '11:00', date: 'Terça', type: 'call' },
];

export function CalendarWidget() {
  const getTypeIcon = (type: Event['type']) => {
    switch (type) {
      case 'call': return <Video className="w-4 h-4" />;
      case 'meeting': return <Calendar className="w-4 h-4" />;
      case 'follow-up': return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: Event['type']) => {
    switch (type) {
      case 'call': return 'bg-funnel-scheduled text-funnel-scheduled-foreground';
      case 'meeting': return 'bg-primary text-primary-foreground';
      case 'follow-up': return 'bg-funnel-convincing text-funnel-convincing-foreground';
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Agenda da Semana</h3>
        <button className="text-sm text-primary hover:underline font-medium">
          Conectar Google Agenda
        </button>
      </div>

      <div className="space-y-3">
        {mockEvents.map((event, index) => (
          <div
            key={event.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors animate-slide-in-right"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg',
              getTypeColor(event.type)
            )}>
              {getTypeIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{event.title}</p>
              <p className="text-sm text-muted-foreground">{event.date} às {event.time}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Em breve:</span> Integração com Google Calendar para sincronizar automaticamente suas calls e reuniões.
        </p>
      </div>
    </div>
  );
}

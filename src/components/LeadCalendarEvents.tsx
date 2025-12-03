import { useState, useEffect } from 'react';
import { Calendar, Plus, Loader2, Clock, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadCalendarEventsProps {
  leadId: string;
  leadName: string;
  leadEmail?: string | null;
}

interface LeadEvent {
  id: string;
  lead_id: string;
  google_event_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_link: string | null;
  synced_to_google: boolean;
}

export function LeadCalendarEvents({ leadId, leadName, leadEmail }: LeadCalendarEventsProps) {
  const { isConnected, isLoading: isCheckingConnection, createEvent, connect } = useGoogleCalendar();
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    title: `Reunião com ${leadName}`,
    description: '',
    date: '',
    startTime: '10:00',
    endTime: '11:00',
    location: '',
  });

  useEffect(() => {
    loadEvents();
  }, [leadId]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const startDateTime = `${formData.date}T${formData.startTime}:00`;
      const endDateTime = `${formData.date}T${formData.endTime}:00`;

      let googleEventId = null;
      let meetingLink = null;

      // Create event in Google Calendar if connected
      if (isConnected) {
        const googleEvent = await createEvent({
          summary: formData.title,
          description: formData.description || `Lead: ${leadName}`,
          start: new Date(startDateTime).toISOString(),
          end: new Date(endDateTime).toISOString(),
          location: formData.location || undefined,
          attendees: leadEmail ? [leadEmail] : undefined,
        });

        googleEventId = googleEvent.id;
        meetingLink = googleEvent.htmlLink;
      }

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          user_id: user?.id,
          google_event_id: googleEventId,
          title: formData.title,
          description: formData.description,
          start_time: startDateTime,
          end_time: endDateTime,
          location: formData.location || null,
          meeting_link: meetingLink,
          synced_to_google: isConnected,
        });

      if (error) throw error;

      toast({
        title: 'Evento criado!',
        description: isConnected 
          ? 'O evento foi adicionado ao seu Google Calendar' 
          : 'O evento foi salvo localmente',
      });

      setIsOpen(false);
      loadEvents();
      
      // Reset form
      setFormData({
        title: `Reunião com ${leadName}`,
        description: '',
        date: '',
        startTime: '10:00',
        endTime: '11:00',
        location: '',
      });
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o evento',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const formatEventDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM, HH:mm", { locale: ptBR });
  };

  const upcomingEvents = events.filter(e => new Date(e.start_time) >= new Date());
  const pastEvents = events.filter(e => new Date(e.start_time) < new Date());

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Agenda
        </h2>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Agendar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar evento com {leadName}</DialogTitle>
            </DialogHeader>
            
            {!isConnected && !isCheckingConnection && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                <p className="text-sm text-amber-600">
                  Conecte seu Google Calendar em Configurações para sincronizar automaticamente os eventos.
                </p>
                <Button variant="link" size="sm" className="p-0 h-auto mt-1" onClick={connect}>
                  Conectar agora
                </Button>
              </div>
            )}
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(f => ({ ...f, date: e.target.value }))}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(f => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(f => ({ ...f, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Local / Link da reunião</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                  placeholder="Zoom, Google Meet, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Pauta da reunião..."
                  rows={3}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Calendar className="w-4 h-4 mr-2" />
                )}
                {isConnected ? 'Criar e sincronizar' : 'Criar evento'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {isLoadingEvents ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum evento agendado</p>
          <p className="text-sm">Clique em "Agendar" para criar um evento</p>
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingEvents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Próximos</p>
              <div className="space-y-2">
                {upcomingEvents.map(event => (
                  <div key={event.id} className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="font-medium text-foreground">{event.title}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatEventDate(event.start_time)}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                    {event.meeting_link && (
                      <a 
                        href={event.meeting_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver no Google Calendar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {pastEvents.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Passados</p>
              <div className="space-y-2">
                {pastEvents.slice(0, 3).map(event => (
                  <div key={event.id} className="p-3 rounded-lg bg-muted/50 opacity-60">
                    <p className="font-medium text-foreground">{event.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatEventDate(event.start_time)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

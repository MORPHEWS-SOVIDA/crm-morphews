import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, ExternalLink, ChevronRight, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Lead } from '@/hooks/useLeads';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UpcomingMeetingsProps {
  leads: Lead[];
}

export function UpcomingMeetings({ leads }: UpcomingMeetingsProps) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  // Filter leads with meeting date and time, then sort by date/time
  const leadsWithMeetings = leads
    .filter((lead) => lead.meeting_date && lead.meeting_time)
    .map((lead) => {
      const meetingDateTime = new Date(`${lead.meeting_date}T${lead.meeting_time}`);
      return { ...lead, meetingDateTime };
    })
    .sort((a, b) => a.meetingDateTime.getTime() - b.meetingDateTime.getTime());

  const now = new Date();

  // Get upcoming meetings (future or today)
  const upcomingMeetings = leadsWithMeetings.filter(
    (lead) => lead.meetingDateTime >= new Date(now.setHours(0, 0, 0, 0))
  );

  // Get next 5 upcoming meetings
  const next5Meetings = upcomingMeetings.slice(0, 5);

  // Get past meetings
  const pastMeetings = leadsWithMeetings.filter(
    (lead) => lead.meetingDateTime < new Date(new Date().setHours(0, 0, 0, 0))
  ).reverse();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) {
      return 'Hoje';
    }
    if (date.getTime() === tomorrow.getTime()) {
      return 'Amanhã';
    }
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5);
  };

  const MeetingItem = ({ lead, isPast = false }: { lead: typeof leadsWithMeetings[0]; isPast?: boolean }) => (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
        isPast ? 'bg-muted/30 opacity-70' : 'bg-muted/50 hover:bg-muted'
      }`}
      onClick={() => navigate(`/leads/${lead.id}`)}
    >
      <div className={`p-2 rounded-lg ${isPast ? 'bg-muted' : 'bg-primary/10'}`}>
        <Video className={`w-4 h-4 ${isPast ? 'text-muted-foreground' : 'text-primary'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{lead.name}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatDate(lead.meeting_date!)}</span>
          <span>•</span>
          <span>{formatTime(lead.meeting_time!)}</span>
        </div>
        {lead.assigned_to && (
          <p className="text-xs text-primary mt-0.5">
            {lead.assigned_to}
          </p>
        )}
      </div>
      {lead.meeting_link && (
        <a
          href={lead.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-primary" />
        </a>
      )}
    </div>
  );

  return (
    <div className="bg-card rounded-xl p-6 shadow-card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Próximas Reuniões
        </h3>
        <Dialog open={showAll} onOpenChange={setShowAll}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              Ver todas
              <ChevronRight className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Todas as Reuniões
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {upcomingMeetings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Próximas ({upcomingMeetings.length})
                    </h4>
                    <div className="space-y-2">
                      {upcomingMeetings.map((lead) => (
                        <MeetingItem key={lead.id} lead={lead} />
                      ))}
                    </div>
                  </div>
                )}
                {pastMeetings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Anteriores ({pastMeetings.length})
                    </h4>
                    <div className="space-y-2">
                      {pastMeetings.map((lead) => (
                        <MeetingItem key={lead.id} lead={lead} isPast />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {next5Meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhuma reunião agendada</p>
          <p className="text-sm text-muted-foreground/70">
            Agende reuniões nos leads para vê-las aqui
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {next5Meetings.map((lead) => (
            <MeetingItem key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
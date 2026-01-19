import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, AlertCircle, MessageCircle, RefreshCw, DollarSign, Clock, User, ShoppingCart, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSacTickets, SacTicket, SAC_STATUS_LABELS, SAC_PRIORITY_LABELS, SAC_CATEGORIES, SacTicketStatus, useUpdateSacTicketStatus } from '@/hooks/useSacTickets';
import { SacTicketForm } from '@/components/sac/SacTicketForm';
import { SacTicketDetail } from '@/components/sac/SacTicketDetail';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const KANBAN_COLUMNS: { status: SacTicketStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Não Tratados', color: 'border-purple-500' },
  { status: 'open', label: 'Aberto', color: 'border-blue-500' },
  { status: 'in_progress', label: 'Em Atendimento', color: 'border-yellow-500' },
  { status: 'resolved', label: 'Resolvido', color: 'border-green-500' },
  { status: 'closed', label: 'Fechado', color: 'border-gray-500' },
];

const CATEGORY_ICONS = {
  complaint: AlertCircle,
  question: MessageCircle,
  request: RefreshCw,
  financial: DollarSign,
};

function TicketCard({ ticket, onClick }: { ticket: SacTicket; onClick: () => void }) {
  const CategoryIcon = CATEGORY_ICONS[ticket.category];
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CategoryIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs font-medium truncate">
              {SAC_CATEGORIES[ticket.category].label}
            </span>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs flex-shrink-0",
              ticket.priority === 'high' && "border-red-500 text-red-500",
              ticket.priority === 'normal' && "border-blue-500 text-blue-500",
              ticket.priority === 'low' && "border-gray-500 text-gray-500"
            )}
          >
            {SAC_PRIORITY_LABELS[ticket.priority].label}
          </Badge>
        </div>
        
        {/* Subcategory */}
        <p className="text-sm font-medium line-clamp-1">{ticket.subcategory}</p>
        
        {/* Lead name */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate">{ticket.lead?.name || 'Lead não encontrado'}</span>
        </div>
        
        {/* Sale reference */}
        {ticket.sale && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShoppingCart className="h-3 w-3" />
            <span>Venda vinculada</span>
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(ticket.created_at), { 
                addSuffix: true, 
                locale: ptBR 
              })}
            </span>
          </div>
          {ticket.creator && (
            <span className="text-xs text-muted-foreground">
              {ticket.creator.first_name}
            </span>
          )}
        </div>
        
        {/* Involved users */}
        {ticket.involved_users && ticket.involved_users.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Envolvidos:</span>
            <span className="font-medium">
              {ticket.involved_users.map(u => u.profile?.first_name).filter(Boolean).join(', ')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanColumn({ 
  status, 
  label, 
  color, 
  tickets,
  onTicketClick,
  onDrop,
}: { 
  status: SacTicketStatus;
  label: string;
  color: string;
  tickets: SacTicket[];
  onTicketClick: (ticket: SacTicket) => void;
  onDrop: (ticketId: string, newStatus: SacTicketStatus) => void;
}) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    if (ticketId) {
      onDrop(ticketId, status);
    }
  };
  
  return (
    <div 
      className={cn("flex flex-col min-w-[280px] max-w-[320px] border-t-4 bg-muted/30 rounded-lg", color)}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{label}</h3>
          <Badge variant="secondary" className="text-xs">
            {tickets.length}
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {tickets.map(ticket => (
            <div
              key={ticket.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('ticketId', ticket.id);
              }}
            >
              <TicketCard 
                ticket={ticket} 
                onClick={() => onTicketClick(ticket)}
              />
            </div>
          ))}
          {tickets.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">
              Nenhum chamado
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function SAC() {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useSacTickets();
  const updateStatus = useUpdateSacTicketStatus();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SacTicket | null>(null);
  
  const ticketsByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.status] = tickets.filter(t => t.status === col.status);
    return acc;
  }, {} as Record<SacTicketStatus, SacTicket[]>);
  
  const handleDrop = (ticketId: string, newStatus: SacTicketStatus) => {
    updateStatus.mutate({ ticketId, status: newStatus });
  };
  
  const handleTicketClick = (ticket: SacTicket) => {
    setSelectedTicket(ticket);
  };
  
  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">SAC - Atendimento ao Cliente</h1>
            <p className="text-muted-foreground">
              Gerencie chamados e solicitações de clientes
            </p>
          </div>
          
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Chamado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Abrir Novo Chamado</DialogTitle>
              </DialogHeader>
              <SacTicketForm onSuccess={() => setIsFormOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-h-[calc(100vh-250px)]">
            {KANBAN_COLUMNS.map(col => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                color={col.color}
                tickets={ticketsByStatus[col.status] || []}
                onTicketClick={handleTicketClick}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>
        
        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedTicket && (
              <SacTicketDetail 
                ticket={selectedTicket} 
                onClose={() => setSelectedTicket(null)}
                onViewLead={() => {
                  setSelectedTicket(null);
                  navigate(`/leads/${selectedTicket.lead_id}`);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

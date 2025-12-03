import { useNavigate } from 'react-router-dom';
import { Instagram, Mail, User } from 'lucide-react';
import { Lead, FUNNEL_STAGES } from '@/types/lead';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface LeadsTableProps {
  leads: Lead[];
  title: string;
}

export function LeadsTable({ leads, title }: LeadsTableProps) {
  const navigate = useNavigate();

  const formatFollowers = (num: number | null) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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
    <div className="bg-card rounded-xl shadow-card overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{leads.length} leads</p>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Instagram</TableHead>
              <TableHead className="text-center">Seguidores</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead className="text-center">Estrelas</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Contato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => {
              const stageInfo = FUNNEL_STAGES[lead.stage];
              
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.specialty}</TableCell>
                  <TableCell>
                    <a
                      href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-pink-500 hover:text-pink-600"
                    >
                      <Instagram className="w-4 h-4" />
                      {lead.instagram}
                    </a>
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {formatFollowers(lead.followers)}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(stageInfo.color, stageInfo.textColor, 'border-0')}>
                      {stageInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <StarRating rating={lead.stars as 1 | 2 | 3 | 4 | 5} size="sm" />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.assigned_to}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(lead.negotiated_value)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <WhatsAppButton phone={lead.whatsapp} variant="icon" />
                      {lead.email && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200 hover:scale-110"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

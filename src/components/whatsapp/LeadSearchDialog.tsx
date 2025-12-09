import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, Loader2, User, Phone, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  stars: number;
  stage: string;
}

interface LeadSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationPhone: string;
  contactName: string | null;
  onLeadSelected: (leadId: string) => void;
  onCreateNew: (name: string, phone: string) => void;
}

export function LeadSearchDialog({
  open,
  onOpenChange,
  conversationPhone,
  contactName,
  onLeadSelected,
  onCreateNew,
}: LeadSearchDialogProps) {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [matchingLead, setMatchingLead] = useState<Lead | null>(null);
  const [newLeadName, setNewLeadName] = useState('');

  // Search for matching lead by phone on dialog open
  useEffect(() => {
    if (open && conversationPhone) {
      findMatchingLead();
      setNewLeadName(contactName || '');
    }
  }, [open, conversationPhone]);

  // Normalize phone for comparison
  const normalizePhone = (phone: string) => {
    return phone.replace(/\D/g, '').replace(/^55/, '');
  };

  const findMatchingLead = async () => {
    if (!profile?.organization_id) return;
    
    const cleanPhone = normalizePhone(conversationPhone);
    
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, whatsapp, email, stars, stage')
      .eq('organization_id', profile.organization_id);

    if (!error && data) {
      const match = data.find(lead => {
        const leadPhone = normalizePhone(lead.whatsapp);
        return leadPhone === cleanPhone || 
               leadPhone.endsWith(cleanPhone) || 
               cleanPhone.endsWith(leadPhone);
      });
      
      if (match) {
        setMatchingLead(match);
      }
    }
  };

  // Search leads
  useEffect(() => {
    const searchLeads = async () => {
      if (!searchTerm || searchTerm.length < 2 || !profile?.organization_id) {
        setLeads([]);
        return;
      }

      setIsLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, whatsapp, email, stars, stage')
        .eq('organization_id', profile.organization_id)
        .or(`name.ilike.%${searchTerm}%,whatsapp.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(10);

      if (!error && data) {
        setLeads(data);
      }
      setIsLoading(false);
    };

    const debounce = setTimeout(searchLeads, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, profile?.organization_id]);

  const handleSelectLead = (lead: Lead) => {
    onLeadSelected(lead.id);
    onOpenChange(false);
  };

  const handleCreateNew = () => {
    if (newLeadName.trim()) {
      onCreateNew(newLeadName.trim(), conversationPhone);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Vincular Lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auto-matched lead */}
          {matchingLead && (
            <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
              <p className="text-sm text-green-700 dark:text-green-400 mb-2 font-medium">
                ✓ Lead encontrado com este número:
              </p>
              <div 
                className="flex items-center gap-3 p-2 rounded-lg bg-background cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleSelectLead(matchingLead)}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {matchingLead.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{matchingLead.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {matchingLead.whatsapp}
                    <div className="flex items-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i} 
                          className={cn(
                            "h-3 w-3",
                            i < matchingLead.stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="default">
                  Vincular
                </Button>
              </div>
            </div>
          )}

          {/* Search existing leads */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Buscar lead existente:
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Search results */}
          {searchTerm && (
            <ScrollArea className="max-h-48">
              {isLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </div>
              ) : leads.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Nenhum lead encontrado
                </p>
              ) : (
                <div className="space-y-2">
                  {leads.map(lead => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => handleSelectLead(lead)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/20 text-primary text-sm">
                          {lead.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{lead.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.whatsapp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}

          {/* Create new lead */}
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Ou criar novo lead:
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do lead"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleCreateNew} disabled={!newLeadName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Criar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Telefone: {conversationPhone}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

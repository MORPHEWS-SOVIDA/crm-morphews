import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, AlertCircle, MessageCircle, RefreshCw, DollarSign, X, User, Package, Calendar, Truck, CreditCard, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateSacTicket, SAC_CATEGORIES, SacCategory, SacTicketPriority } from '@/hooks/useSacTickets';
import { useLeads } from '@/hooks/useLeads';
import { useSales } from '@/hooks/useSales';
import { useUsers } from '@/hooks/useUsers';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CATEGORY_ICONS = {
  complaint: AlertCircle,
  question: MessageCircle,
  request: RefreshCw,
  financial: DollarSign,
};

interface SacTicketFormProps {
  onSuccess?: () => void;
  preselectedLeadId?: string;
}

export function SacTicketForm({ onSuccess, preselectedLeadId }: SacTicketFormProps) {
  const createTicket = useCreateSacTicket();
  const { data: leadsData } = useLeads();
  const leads = leadsData || [];
  const { data: users = [] } = useUsers();
  
  // Form state
  const [leadId, setLeadId] = useState(preselectedLeadId || '');
  const [saleId, setSaleId] = useState('');
  const [category, setCategory] = useState<SacCategory | ''>('');
  const [subcategory, setSubcategory] = useState('');
  const [priority, setPriority] = useState<SacTicketPriority>('normal');
  const [description, setDescription] = useState('');
  const [involvedUserIds, setInvolvedUserIds] = useState<string[]>([]);
  
  // UI state
  const [leadOpen, setLeadOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  
  // Get sales for selected lead
  const { data: salesData } = useSales();
  const sales = salesData || [];
  const leadSales = sales?.filter(s => s.lead_id === leadId) || [];
  
  const selectedLead = leads.find(l => l.id === leadId);
  const selectedSale = useMemo(() => leadSales.find(s => s.id === saleId), [leadSales, saleId]);
  
  // Get seller name for selected sale
  const sellerName = useMemo(() => {
    // First try to use the joined seller_profile
    if (selectedSale?.seller_profile) {
      return `${selectedSale.seller_profile.first_name} ${selectedSale.seller_profile.last_name}`;
    }
    // Fallback to looking up in users list
    if (!selectedSale?.seller_user_id) return null;
    const seller = users.find(u => u.user_id === selectedSale.seller_user_id);
    return seller ? `${seller.first_name} ${seller.last_name}` : null;
  }, [selectedSale, users]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leadId || !category || !subcategory || !description) {
      return;
    }
    
    createTicket.mutate({
      lead_id: leadId,
      sale_id: saleId || undefined,
      category: category as SacCategory,
      subcategory,
      priority,
      description,
      involved_user_ids: involvedUserIds,
    }, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };
  
  const toggleUser = (userId: string) => {
    setInvolvedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };
  
  const removeUser = (userId: string) => {
    setInvolvedUserIds(prev => prev.filter(id => id !== userId));
  };
  
  // Format delivery type for display
  const formatDeliveryType = (type: string | null) => {
    if (!type) return 'Não informado';
    const types: Record<string, string> = {
      delivery: 'Entrega',
      pickup: 'Retirada',
      shipping: 'Correios/Transportadora',
    };
    return types[type] || type;
  };
  
  // Get product names from sale items
  const getProductNames = (sale: typeof selectedSale) => {
    if (!sale?.items || sale.items.length === 0) return [];
    return sale.items.map(item => {
      const productName = item.product_name || 'Produto';
      return `${productName} (${item.quantity}x)`;
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Lead Selection */}
      <div className="space-y-2">
        <Label>Lead / Cliente *</Label>
        <Popover open={leadOpen} onOpenChange={setLeadOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={leadOpen}
              className="w-full justify-between"
              disabled={!!preselectedLeadId}
            >
              {selectedLead ? selectedLead.name : "Selecione o lead..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar lead..." />
              <CommandList>
                <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                <CommandGroup>
                  {leads.map((lead) => (
                    <CommandItem
                      key={lead.id}
                      value={lead.name}
                      onSelect={() => {
                        setLeadId(lead.id);
                        setSaleId(''); // Reset sale selection
                        setLeadOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          leadId === lead.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{lead.name}</span>
                        <span className="text-xs text-muted-foreground">{lead.whatsapp}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Sale Selection (optional) */}
      {leadId && leadSales.length > 0 && (
        <div className="space-y-2">
          <Label>Venda relacionada (opcional)</Label>
          <Select 
            value={saleId || "none"} 
            onValueChange={(v) => setSaleId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma venda..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma venda específica</SelectItem>
              {leadSales.map((sale) => (
                <SelectItem key={sale.id} value={sale.id}>
                  #{sale.romaneio_number || '—'} • {format(new Date(sale.created_at), 'dd/MM/yyyy', { locale: ptBR })} • R$ {(sale.total_cents / 100).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Sale Summary Card */}
          {selectedSale && (
            <Card className="mt-3 border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Resumo da Venda #{selectedSale.romaneio_number || '—'}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {selectedSale.status === 'delivered' ? 'Entregue' : 
                     selectedSale.status === 'pending_expedition' ? 'Aguardando Expedição' :
                     selectedSale.status === 'dispatched' ? 'Despachado' :
                     selectedSale.status === 'payment_confirmed' ? 'Pago' :
                     selectedSale.status === 'payment_pending' ? 'Aguardando Pagamento' :
                     selectedSale.status === 'cancelled' ? 'Cancelado' : 
                     selectedSale.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs">Data da Venda</p>
                      <p className="font-medium">{format(new Date(selectedSale.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs">Valor Total</p>
                      <p className="font-medium">R$ {(selectedSale.total_cents / 100).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <UserCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs">Vendedor</p>
                      <p className="font-medium">{sellerName || 'Não informado'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground text-xs">Tipo de Entrega</p>
                      <p className="font-medium">{formatDeliveryType(selectedSale.delivery_type)}</p>
                    </div>
                  </div>
                </div>
                
                {/* Products */}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Produtos</p>
                  <div className="flex flex-wrap gap-1">
                    {getProductNames(selectedSale).length > 0 ? (
                      getProductNames(selectedSale).map((name, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum produto</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {/* Category Selection */}
      <div className="space-y-3">
        <Label>Categoria *</Label>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(SAC_CATEGORIES) as [SacCategory, typeof SAC_CATEGORIES[SacCategory]][]).map(([key, cat]) => {
            const Icon = CATEGORY_ICONS[key];
            return (
              <Card 
                key={key}
                className={cn(
                  "cursor-pointer transition-all",
                  category === key 
                    ? "ring-2 ring-primary bg-primary/5" 
                    : "hover:bg-muted/50"
                )}
                onClick={() => {
                  setCategory(key);
                  setSubcategory('');
                }}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    key === 'complaint' && "bg-red-100 text-red-600",
                    key === 'question' && "bg-blue-100 text-blue-600",
                    key === 'request' && "bg-purple-100 text-purple-600",
                    key === 'financial' && "bg-green-100 text-green-600",
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.subcategories.length} tipos</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      
      {/* Subcategory Selection */}
      {category && (
        <div className="space-y-2">
          <Label>Tipo do Problema *</Label>
          <Select value={subcategory} onValueChange={setSubcategory}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo..." />
            </SelectTrigger>
            <SelectContent>
              {SAC_CATEGORIES[category].subcategories.map((sub) => (
                <SelectItem key={sub} value={sub}>
                  {sub}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Priority */}
      <div className="space-y-3">
        <Label>Prioridade</Label>
        <RadioGroup 
          value={priority} 
          onValueChange={(v) => setPriority(v as SacTicketPriority)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="low" id="low" />
            <Label htmlFor="low" className="font-normal cursor-pointer">Baixa</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="normal" id="normal" />
            <Label htmlFor="normal" className="font-normal cursor-pointer">Normal</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="high" id="high" />
            <Label htmlFor="high" className="font-normal cursor-pointer">Alta</Label>
          </div>
        </RadioGroup>
      </div>
      
      {/* Involved Users */}
      <div className="space-y-2">
        <Label>Usuários envolvidos (opcional)</Label>
        <Popover open={usersOpen} onOpenChange={setUsersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              Selecionar usuários...
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar usuário..." />
              <CommandList>
                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                <CommandGroup>
                  {users.map((user) => (
                    <CommandItem
                      key={user.user_id}
                      value={`${user.first_name} ${user.last_name}`}
                      onSelect={() => toggleUser(user.user_id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          involvedUserIds.includes(user.user_id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {user.first_name} {user.last_name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        
        {involvedUserIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {involvedUserIds.map(userId => {
              const user = users.find(u => u.user_id === userId);
              return user ? (
                <Badge key={userId} variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  {user.first_name} {user.last_name}
                  <button
                    type="button"
                    onClick={() => removeUser(userId)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
          </div>
        )}
      </div>
      
      {/* Description */}
      <div className="space-y-2">
        <Label>Descrição do Problema *</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva detalhadamente a situação relatada pelo cliente..."
          rows={4}
          minLength={10}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Mínimo 10 caracteres. {description.length}/500
        </p>
      </div>
      
      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="submit" 
          disabled={!leadId || !category || !subcategory || description.length < 10 || createTicket.isPending}
        >
          {createTicket.isPending ? 'Abrindo...' : 'Abrir Chamado'}
        </Button>
      </div>
    </form>
  );
}

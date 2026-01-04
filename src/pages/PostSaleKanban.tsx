import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { 
  usePostSaleSales, 
  useUpdatePostSaleStatus, 
  POST_SALE_COLUMNS,
  PostSaleContactStatus,
  PostSaleSale
} from '@/hooks/usePostSaleKanban';
import { useTenantMembers } from '@/hooks/multi-tenant';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ClipboardList, 
  Loader2, 
  Phone, 
  User, 
  Calendar,
  Search,
  ChevronRight,
  MessageSquare,
  Filter,
  X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SaleCardProps {
  sale: PostSaleSale;
  onDragStart: (e: React.DragEvent, sale: PostSaleSale) => void;
  onClick: () => void;
}

function SaleCard({ sale, onDragStart, onClick }: SaleCardProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, sale)}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{sale.lead?.name}</p>
              {sale.romaneio_number && (
                <p className="text-xs font-mono text-primary">#{sale.romaneio_number}</p>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{formatCurrency(sale.total_cents)}</span>
          {sale.delivered_at && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(sale.delivered_at), "dd/MM", { locale: ptBR })}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          {sale.seller && (
            <span className="text-xs text-muted-foreground">
              {sale.seller.first_name}
            </span>
          )}
          {sale.lead?.whatsapp && (
            <div onClick={(e) => e.stopPropagation()}>
              <WhatsAppButton phone={sale.lead.whatsapp} variant="icon" className="h-7 w-7" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  column: typeof POST_SALE_COLUMNS[0];
  sales: PostSaleSale[];
  onDragStart: (e: React.DragEvent, sale: PostSaleSale) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: PostSaleContactStatus) => void;
  onSaleClick: (sale: PostSaleSale) => void;
}

function KanbanColumn({ column, sales, onDragStart, onDragOver, onDrop, onSaleClick }: KanbanColumnProps) {
  return (
    <div 
      className={cn(
        "flex-shrink-0 w-72 rounded-lg border border-border",
        column.bgColor
      )}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, column.id)}
    >
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className={cn("font-semibold text-sm", column.color)}>
            {column.label}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {sales.length}
          </Badge>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-340px)]">
        <div className="p-2 space-y-2">
          {sales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Nenhuma venda
            </div>
          ) : (
            sales.map((sale) => (
              <SaleCard 
                key={sale.id} 
                sale={sale} 
                onDragStart={onDragStart}
                onClick={() => onSaleClick(sale)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function PostSaleKanban() {
  const navigate = useNavigate();
  const { data: sales = [], isLoading } = usePostSaleSales();
  const { data: members = [] } = useTenantMembers();
  const updateStatus = useUpdatePostSaleStatus();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedSale, setDraggedSale] = useState<PostSaleSale | null>(null);
  
  // Filter states - default to current month
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedSeller, setSelectedSeller] = useState<string>('all');

  // Get unique sellers from members
  const sellers = useMemo(() => {
    return members.filter(m => m.profile).map(m => ({
      id: m.user_id,
      name: `${m.profile!.first_name} ${m.profile!.last_name}`.trim()
    }));
  }, [members]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          sale.lead?.name.toLowerCase().includes(term) ||
          sale.lead?.whatsapp.includes(term) ||
          sale.lead?.specialty?.toLowerCase().includes(term) ||
          sale.romaneio_number?.toString().includes(term);
        if (!matchesSearch) return false;
      }
      
      // Date filter (use created_at as the sale date)
      if (startDate && sale.created_at) {
        const saleDate = parseISO(sale.created_at);
        const start = parseISO(startDate);
        const end = endDate ? parseISO(endDate) : new Date();
        end.setHours(23, 59, 59, 999);
        
        if (!isWithinInterval(saleDate, { start, end })) return false;
      }
      
      // Seller filter
      if (selectedSeller && selectedSeller !== 'all') {
        if (sale.seller_user_id !== selectedSeller) return false;
      }
      
      return true;
    });
  }, [sales, searchTerm, startDate, endDate, selectedSeller]);

  // Group sales by status
  const salesByStatus = useMemo(() => {
    const grouped: Record<PostSaleContactStatus, PostSaleSale[]> = {
      pending: [],
      attempted_1: [],
      attempted_2: [],
      attempted_3: [],
      sent_whatsapp: [],
      callback_later: [],
      completed_call: [],
      completed_whatsapp: [],
      refused: [],
      not_needed: [],
    };
    
    filteredSales.forEach(sale => {
      const status = sale.post_sale_contact_status || 'pending';
      if (grouped[status]) {
        grouped[status].push(sale);
      }
    });
    
    return grouped;
  }, [filteredSales]);

  // Stats
  const stats = useMemo(() => {
    const pending = salesByStatus.pending.length;
    const inProgress = 
      salesByStatus.attempted_1.length + 
      salesByStatus.attempted_2.length + 
      salesByStatus.attempted_3.length +
      salesByStatus.sent_whatsapp.length +
      salesByStatus.callback_later.length;
    const completed = 
      salesByStatus.completed_call.length + 
      salesByStatus.completed_whatsapp.length;
    const closed = 
      salesByStatus.refused.length + 
      salesByStatus.not_needed.length;
    
    return { pending, inProgress, completed, closed };
  }, [salesByStatus]);

  const handleDragStart = (e: React.DragEvent, sale: PostSaleSale) => {
    setDraggedSale(sale);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: PostSaleContactStatus) => {
    e.preventDefault();
    
    if (draggedSale && draggedSale.post_sale_contact_status !== newStatus) {
      updateStatus.mutate({ 
        saleId: draggedSale.id, 
        status: newStatus 
      });
    }
    
    setDraggedSale(null);
  };

  const handleSaleClick = (sale: PostSaleSale) => {
    navigate(`/vendas/${sale.id}`);
  };

  const clearFilters = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    setSelectedSeller('all');
    setSearchTerm('');
  };

  const hasActiveFilters = selectedSeller !== 'all' || searchTerm;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              Pós-Venda
            </h1>
            <p className="text-muted-foreground text-sm">
              Acompanhe o contato com clientes após entrega
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou romaneio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Venda de:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-36"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 w-36"
                />
              </div>
              
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Aguardando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">Em andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.closed}</p>
                  <p className="text-xs text-muted-foreground">Encerrados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kanban Board */}
        <Card>
          <CardContent className="p-4">
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-4">
                {POST_SALE_COLUMNS.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    sales={salesByStatus[column.id]}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onSaleClick={handleSaleClick}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
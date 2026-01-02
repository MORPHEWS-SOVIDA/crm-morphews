import React, { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Truck, 
  MapPin, 
  Package,
  CheckCircle,
  Clock,
  Navigation,
  User,
  Calendar,
  Sun,
  Sunset,
  XCircle,
  MessageCircle,
  Filter,
  Search,
  Phone,
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO, startOfDay, endOfDay, subDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useAllDeliveries, 
  formatCurrency, 
  Sale
} from '@/hooks/useSales';
import { useUsers } from '@/hooks/useUsers';

export default function AllDeliveries() {
  const { data: deliveries = [], isLoading } = useAllDeliveries();
  const { data: users = [] } = useUsers();
  
  // Filters
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [customDate, setCustomDate] = useState<string>('');
  const [motoboyFilter, setMotoboyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get delivery users (motoboys) - all users who have been assigned deliveries
  const deliveryUsers = useMemo(() => {
    const userIdsWithDeliveries = new Set(
      deliveries.map(d => d.assigned_delivery_user_id).filter(Boolean)
    );
    return users.filter(u => userIdsWithDeliveries.has(u.user_id));
  }, [users, deliveries]);

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    let filtered = [...deliveries];

    // Date filter
    const today = startOfDay(new Date());
    switch(dateFilter) {
      case 'today':
        filtered = filtered.filter(d => {
          const date = d.scheduled_delivery_date ? parseISO(d.scheduled_delivery_date) : null;
          return date && isToday(date);
        });
        break;
      case 'tomorrow':
        filtered = filtered.filter(d => {
          const date = d.scheduled_delivery_date ? parseISO(d.scheduled_delivery_date) : null;
          return date && isTomorrow(date);
        });
        break;
      case 'week':
        const weekEnd = addDays(today, 7);
        filtered = filtered.filter(d => {
          const date = d.scheduled_delivery_date ? parseISO(d.scheduled_delivery_date) : null;
          return date && date >= today && date <= weekEnd;
        });
        break;
      case 'custom':
        if (customDate) {
          const targetDate = parseISO(customDate);
          filtered = filtered.filter(d => {
            const date = d.scheduled_delivery_date ? parseISO(d.scheduled_delivery_date) : null;
            return date && format(date, 'yyyy-MM-dd') === format(targetDate, 'yyyy-MM-dd');
          });
        }
        break;
      // 'all' shows everything
    }

    // Motoboy filter
    if (motoboyFilter !== 'all') {
      filtered = filtered.filter(d => d.assigned_delivery_user_id === motoboyFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.lead?.name?.toLowerCase().includes(query) ||
        d.lead?.whatsapp?.includes(query) ||
        d.romaneio_number?.toString().includes(query)
      );
    }

    // Sort by date, shift, then position
    return filtered.sort((a, b) => {
      const dateA = a.scheduled_delivery_date || '9999-12-31';
      const dateB = b.scheduled_delivery_date || '9999-12-31';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      
      const shiftOrder: Record<string, number> = { morning: 0, afternoon: 1, full_day: 2 };
      const shiftA = shiftOrder[a.scheduled_delivery_shift || 'full_day'] ?? 2;
      const shiftB = shiftOrder[b.scheduled_delivery_shift || 'full_day'] ?? 2;
      if (shiftA !== shiftB) return shiftA - shiftB;
      
      return (a.delivery_position || 0) - (b.delivery_position || 0);
    });
  }, [deliveries, dateFilter, customDate, motoboyFilter, statusFilter, searchQuery]);

  // Group by motoboy for overview
  const statsByMotoboy = useMemo(() => {
    const stats: Record<string, { pending: number; delivered: number; returned: number; name: string }> = {};
    
    filteredDeliveries.forEach(d => {
      const id = d.assigned_delivery_user_id || 'unassigned';
      if (!stats[id]) {
        const user = deliveryUsers.find(u => u.user_id === id);
        stats[id] = { 
          pending: 0, 
          delivered: 0, 
          returned: 0, 
          name: user ? `${user.first_name} ${user.last_name}` : 'Não atribuído'
        };
      }
      if (d.status === 'dispatched') stats[id].pending++;
      else if (d.status === 'delivered') stats[id].delivered++;
      else if (d.status === 'returned') stats[id].returned++;
    });
    
    return stats;
  }, [filteredDeliveries, deliveryUsers]);

  const getShiftIcon = (shift: string | null) => {
    switch(shift) {
      case 'morning': return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'afternoon': return <Sunset className="w-3.5 h-3.5 text-orange-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getShiftLabel = (shift: string | null) => {
    switch(shift) {
      case 'morning': return 'Manhã';
      case 'afternoon': return 'Tarde';
      case 'full_day': return 'Dia todo';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'dispatched':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Pendente</Badge>;
      case 'delivered':
        return <Badge className="bg-green-500 text-white">Entregue</Badge>;
      case 'returned':
        return <Badge variant="destructive">Voltou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const openMaps = (sale: Sale) => {
    if (sale.lead?.google_maps_link) {
      window.open(sale.lead.google_maps_link, '_blank');
      return;
    }
    
    if (!sale.lead?.street) return;
    const address = encodeURIComponent(
      `${sale.lead.street}, ${sale.lead.street_number}, ${sale.lead.neighborhood}, ${sale.lead.city}, ${sale.lead.state}`
    );
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const getMotoName = (userId: string | null) => {
    if (!userId) return 'Não atribuído';
    const user = deliveryUsers.find(u => u.user_id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Desconhecido';
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4 p-4">
          <Skeleton className="h-12 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </Layout>
    );
  }

  const pendingCount = filteredDeliveries.filter(d => d.status === 'dispatched').length;
  const deliveredCount = filteredDeliveries.filter(d => d.status === 'delivered').length;
  const returnedCount = filteredDeliveries.filter(d => d.status === 'returned').length;

  return (
    <Layout>
      <div className="space-y-4 pb-24 lg:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Todas as Entregas
            </h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe todas as entregas em tempo real
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pendingCount}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{deliveredCount}</p>
              <p className="text-xs text-green-600 dark:text-green-400">Entregues</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{returnedCount}</p>
              <p className="text-xs text-red-600 dark:text-red-400">Voltaram</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Filtros</span>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Date Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="tomorrow">Amanhã</SelectItem>
                    <SelectItem value="week">Próximos 7 dias</SelectItem>
                    <SelectItem value="custom">Data específica</SelectItem>
                    <SelectItem value="all">Todas</SelectItem>
                  </SelectContent>
                </Select>
                {dateFilter === 'custom' && (
                  <Input 
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="h-9 mt-1"
                  />
                )}
              </div>

              {/* Motoboy Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Motoboy</Label>
                <Select value={motoboyFilter} onValueChange={setMotoboyFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {deliveryUsers.map(user => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Situação</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="dispatched">Pendente</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                    <SelectItem value="returned">Voltou</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-1.5">
                <Label className="text-xs">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome ou WhatsApp..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats by Motoboy */}
        {Object.keys(statsByMotoboy).length > 1 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(statsByMotoboy).map(([id, stats]) => (
              <Card key={id} className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm truncate">{stats.name}</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-blue-600">{stats.pending} pend.</span>
                    <span className="text-green-600">{stats.delivered} entr.</span>
                    <span className="text-red-600">{stats.returned} volt.</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Deliveries List */}
        {filteredDeliveries.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Nenhuma entrega encontrada</h3>
              <p className="text-muted-foreground text-sm">
                Ajuste os filtros para ver mais resultados
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredDeliveries.map((sale) => {
              const isDelivered = sale.status === 'delivered';
              const isReturned = sale.status === 'returned';
              
              return (
                <Card 
                  key={sale.id} 
                  className={`transition-all ${
                    isDelivered 
                      ? 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20' 
                      : isReturned 
                        ? 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20' 
                        : ''
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{sale.lead?.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            #{sale.romaneio_number?.toString().padStart(5, '0')}
                          </Badge>
                          {getStatusBadge(sale.status)}
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {getMotoName(sale.assigned_delivery_user_id)}
                          </span>
                          {sale.scheduled_delivery_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(parseISO(sale.scheduled_delivery_date), 'dd/MM', { locale: ptBR })}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            {getShiftIcon(sale.scheduled_delivery_shift)}
                            {getShiftLabel(sale.scheduled_delivery_shift)}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(sale.total_cents)}
                          </span>
                        </div>

                        {/* Address */}
                        {sale.lead?.street && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {sale.lead.street}, {sale.lead.street_number} - {sale.lead.neighborhood}, {sale.lead.city}
                          </p>
                        )}

                        {/* Products */}
                        {sale.items && sale.items.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <Package className="w-3 h-3 inline mr-1" />
                            {sale.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}
                          </p>
                        )}

                        {/* Return info */}
                        {isReturned && sale.return_notes && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                            "{sale.return_notes}"
                          </p>
                        )}

                        {/* Delivery time */}
                        {(sale.delivered_at || sale.returned_at) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {isDelivered ? 'Entregue' : 'Retornou'} às {format(new Date(sale.delivered_at || sale.returned_at!), "HH:mm 'de' dd/MM")}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openMaps(sale)}
                          disabled={!sale.lead?.street && !sale.lead?.google_maps_link}
                        >
                          <Navigation className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openWhatsApp(sale.lead?.whatsapp || '')}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        {sale.lead?.whatsapp && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`tel:${sale.lead?.whatsapp}`, '_blank')}
                          >
                            <Phone className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

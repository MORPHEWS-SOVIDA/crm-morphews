import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMyWhiteLabelConfig, useWhiteLabelCustomers, useWhiteLabelPlans, useCreateWhiteLabelCustomer, useUpdateWhiteLabelCustomer } from '@/hooks/useWhiteAdmin';
import { Building2, Plus, Search, MoreHorizontal, Mail, Phone } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function WhiteAdminOrganizations() {
  const { data: wlData } = useMyWhiteLabelConfig();
  const configId = wlData?.white_label_configs?.id;
  const { data: customers, isLoading } = useWhiteLabelCustomers(configId);
  const { data: plans } = useWhiteLabelPlans(configId);
  const createCustomer = useCreateWhiteLabelCustomer();
  const updateCustomer = useUpdateWhiteLabelCustomer();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: '',
    email: '',
    phone: '',
    planId: '',
  });
  
  const primaryColor = wlData?.white_label_configs?.primary_color || '#8B5CF6';
  
  // Filter customers
  const filteredCustomers = customers?.filter(c => 
    c.organization?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.organization?.owner_email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAddCustomer = async () => {
    // TODO: This should create the org first via edge function
    // For now, just show a toast
    setIsAddDialogOpen(false);
  };

  const handleStatusChange = (customerId: string, newStatus: 'active' | 'suspended' | 'cancelled') => {
    updateCustomer.mutate({ id: customerId, updates: { status: newStatus } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Organizações</h1>
          <p className="text-muted-foreground">Gerencie seus clientes e suas assinaturas</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input 
                  value={newOrg.name}
                  onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  placeholder="Ex: Empresa ABC"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail do Responsável</Label>
                <Input 
                  type="email"
                  value={newOrg.email}
                  onChange={(e) => setNewOrg({ ...newOrg, email: e.target.value })}
                  placeholder="contato@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input 
                  value={newOrg.phone}
                  onChange={(e) => setNewOrg({ ...newOrg, phone: e.target.value })}
                  placeholder="5511999998888"
                />
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={newOrg.planId} onValueChange={(v) => setNewOrg({ ...newOrg, planId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - {formatCurrency(plan.price_cents)}/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleAddCustomer}
                className="w-full"
                style={{ backgroundColor: primaryColor }}
                disabled={!newOrg.name || !newOrg.email}
              >
                Criar Cliente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Customers List */}
      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Nenhum cliente ainda</h3>
            <p className="text-muted-foreground mb-4">
              Comece adicionando seu primeiro cliente à sua franquia.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} style={{ backgroundColor: primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {customer.organization?.name?.[0] || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold">{customer.organization?.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {customer.organization?.owner_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {customer.organization.owner_email}
                          </span>
                        )}
                        {customer.organization?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.organization.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                        {customer.status === 'active' ? 'Ativo' : customer.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {customer.plan?.name || 'Sem plano'}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(customer.contracted_price_cents || customer.plan?.price_cents || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        por mês
                      </p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                        <DropdownMenuItem>Editar Plano</DropdownMenuItem>
                        {customer.status === 'active' ? (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(customer.id, 'suspended')}
                            className="text-amber-600"
                          >
                            Suspender
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(customer.id, 'active')}
                          >
                            Reativar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => handleStatusChange(customer.id, 'cancelled')}
                          className="text-destructive"
                        >
                          Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Criado em {format(new Date(customer.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  {customer.activated_at && (
                    <span>
                      • Ativado em {format(new Date(customer.activated_at), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

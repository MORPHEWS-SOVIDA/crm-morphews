import React, { useState, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Webhook, 
  FileCode, 
  Plug2, 
  Activity, 
  Settings, 
  Trash2, 
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  FileWarning
} from 'lucide-react';
import { 
  useIntegrations, 
  useIntegrationLogs,
  useDeleteIntegration,
  Integration,
  IntegrationLog,
  getWebhookUrl
} from '@/hooks/useIntegrations';
import { IntegrationDialog } from '@/components/integrations/IntegrationDialog';
import { IntegrationDetailDialog } from '@/components/integrations/IntegrationDetailDialog';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';

const typeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  webhook_inbound: { label: 'Webhook Entrada', icon: <Webhook className="h-4 w-4" /> },
  webhook_outbound: { label: 'Webhook Saída', icon: <Webhook className="h-4 w-4 rotate-180" /> },
  api: { label: 'API', icon: <FileCode className="h-4 w-4" /> },
  native: { label: 'Nativa', icon: <Plug2 className="h-4 w-4" /> },
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  inactive: 'bg-gray-400',
};

const logStatusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  success: { 
    icon: <CheckCircle2 className="h-4 w-4" />, 
    label: 'Sucesso', 
    color: 'text-green-500 bg-green-500/10' 
  },
  error: { 
    icon: <XCircle className="h-4 w-4" />, 
    label: 'Erro', 
    color: 'text-red-500 bg-red-500/10' 
  },
  test: { 
    icon: <Eye className="h-4 w-4" />, 
    label: 'Teste', 
    color: 'text-blue-500 bg-blue-500/10' 
  },
  ping: { 
    icon: <Activity className="h-4 w-4" />, 
    label: 'Ping', 
    color: 'text-blue-500 bg-blue-500/10' 
  },
  rejected: { 
    icon: <AlertTriangle className="h-4 w-4" />, 
    label: 'Rejeitado', 
    color: 'text-yellow-500 bg-yellow-500/10' 
  },
  rate_limited: { 
    icon: <Clock className="h-4 w-4" />, 
    label: 'Rate Limited', 
    color: 'text-orange-500 bg-orange-500/10' 
  },
  pending: { 
    icon: <Clock className="h-4 w-4" />, 
    label: 'Pendente', 
    color: 'text-yellow-500 bg-yellow-500/10' 
  },
};

export default function Integrations() {
  const { data: integrations, isLoading: loadingIntegrations, refetch: refetchIntegrations } = useIntegrations();
  const { data: allLogs, isLoading: loadingLogs, refetch: refetchLogs } = useIntegrationLogs(undefined, 200);
  const deleteIntegration = useDeleteIntegration();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  
  // Log filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [integrationFilter, setIntegrationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Calculate log statistics
  const logStats = useMemo(() => {
    if (!allLogs) return { total: 0, success: 0, error: 0, test: 0, other: 0 };
    
    return {
      total: allLogs.length,
      success: allLogs.filter(l => (l.status as string) === 'success').length,
      error: allLogs.filter(l => (l.status as string) === 'error').length,
      test: allLogs.filter(l => (l.status as string) === 'test' || (l.status as string) === 'ping').length,
      other: allLogs.filter(l => !['success', 'error', 'test', 'ping'].includes(l.status as string)).length,
    };
  }, [allLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!allLogs) return [];
    
    return allLogs.filter(log => {
      const logStatus = log.status as string;
      
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'problems') {
          if (!['error', 'rejected', 'rate_limited'].includes(logStatus)) return false;
        } else if (statusFilter === 'tests') {
          if (!['test', 'ping'].includes(logStatus)) return false;
        } else if (logStatus !== statusFilter) {
          return false;
        }
      }
      
      // Integration filter
      if (integrationFilter !== 'all' && log.integration_id !== integrationFilter) {
        return false;
      }
      
      // Search query
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const integration = integrations?.find(i => i.id === log.integration_id);
        const matchesIntegration = integration?.name.toLowerCase().includes(search);
        const matchesError = log.error_message?.toLowerCase().includes(search);
        const matchesEvent = log.event_type?.toLowerCase().includes(search);
        const matchesPayload = JSON.stringify(log.request_payload).toLowerCase().includes(search);
        
        if (!matchesIntegration && !matchesError && !matchesEvent && !matchesPayload) {
          return false;
        }
      }
      
      return true;
    });
  }, [allLogs, statusFilter, integrationFilter, searchQuery, integrations]);

  const handleCopyUrl = (token: string) => {
    const url = getWebhookUrl(token);
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteIntegration.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleRefreshLogs = () => {
    refetchLogs();
    refetchIntegrations();
    toast.success('Logs atualizados!');
  };

  const renderLogStatus = (status: string) => {
    const config = logStatusConfig[status] || logStatusConfig.pending;
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        <span>{config.label}</span>
      </div>
    );
  };

  const formatPayload = (payload: any) => {
    if (!payload) return null;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Integrações</h1>
            <p className="text-muted-foreground">
              Conecte plataformas externas via webhooks e API
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Integração
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <Plug2 className="h-4 w-4" />
              Integrações
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {loadingIntegrations ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : integrations?.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Plug2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma integração configurada</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Crie sua primeira integração para conectar sistemas externos
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Integração
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {integrations?.map(integration => {
                  const typeInfo = typeLabels[integration.type] || { label: integration.type, icon: <Plug2 className="h-4 w-4" /> };
                  const recentLogs = allLogs?.filter(l => l.integration_id === integration.id).slice(0, 5) || [];
                  const successCount = recentLogs.filter(l => l.status === 'success').length;
                  const errorCount = recentLogs.filter(l => l.status === 'error').length;

                  return (
                    <Card 
                      key={integration.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedIntegration(integration)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {typeInfo.icon}
                            <CardTitle className="text-lg">{integration.name}</CardTitle>
                          </div>
                          <Badge 
                            variant="secondary"
                            className={`${statusColors[integration.status]} text-white`}
                          >
                            {integration.status === 'active' ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <CardDescription>{integration.description || typeInfo.label}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {integration.type === 'webhook_inbound' && (
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-muted px-2 py-1 rounded truncate">
                              {getWebhookUrl(integration.auth_token).substring(0, 50)}...
                            </code>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyUrl(integration.auth_token);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            {recentLogs.length > 0 && (
                              <>
                                <span className="text-green-600">{successCount} ✓</span>
                                <span className="text-red-600">{errorCount} ✗</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIntegration(integration);
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(integration.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('all')}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{logStats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('success')}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-500">{logStats.success}</div>
                  <div className="text-xs text-muted-foreground">Sucesso</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('problems')}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-500">{logStats.error}</div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('tests')}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-500">{logStats.test}</div>
                  <div className="text-xs text-muted-foreground">Testes</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter('all')}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-500">{logStats.other}</div>
                  <div className="text-xs text-muted-foreground">Outros</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filtros:</span>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="success">✓ Sucesso</SelectItem>
                      <SelectItem value="problems">✗ Com problemas</SelectItem>
                      <SelectItem value="tests">◉ Testes</SelectItem>
                      <SelectItem value="error">Apenas erros</SelectItem>
                      <SelectItem value="rejected">Rejeitados</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={integrationFilter} onValueChange={setIntegrationFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Integração" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as integrações</SelectItem>
                      {integrations?.map(i => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex-1 min-w-48">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar em logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  <Button variant="outline" size="sm" onClick={handleRefreshLogs}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Logs List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Histórico de Webhooks
                    </CardTitle>
                    <CardDescription>
                      {filteredLogs.length} de {logStats.total} logs 
                      {statusFilter !== 'all' && ` (filtrado por ${statusFilter})`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileWarning className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {allLogs?.length === 0 
                        ? 'Nenhum webhook recebido ainda' 
                        : 'Nenhum log corresponde aos filtros'
                      }
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2 pr-4">
                      {filteredLogs.map(log => {
                        const integration = integrations?.find(i => i.id === log.integration_id);
                        const isExpanded = expandedLogId === log.id;
                        const logStatus = log.status as string;
                        
                        return (
                          <Collapsible key={log.id} open={isExpanded} onOpenChange={() => setExpandedLogId(isExpanded ? null : log.id)}>
                            <div className={`rounded-lg border ${
                              logStatus === 'error' ? 'border-red-500/30 bg-red-500/5' :
                              logStatus === 'rejected' ? 'border-yellow-500/30 bg-yellow-500/5' :
                              ''
                            }`}>
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                  {renderLogStatus(logStatus)}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium">
                                        {integration?.name || 'Integração removida'}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {log.direction === 'inbound' ? 'Entrada' : 'Saída'}
                                      </Badge>
                                      {log.event_type && (
                                        <Badge variant="secondary" className="text-xs">
                                          {log.event_type}
                                        </Badge>
                                      )}
                                    </div>
                                    {log.error_message && (
                                      <p className="text-sm text-red-500 mt-1">
                                        {log.error_message}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                    {log.processing_time_ms && (
                                      <span className="hidden sm:inline">{log.processing_time_ms}ms</span>
                                    )}
                                    <span className="hidden sm:inline">
                                      {format(new Date(log.created_at), 'dd/MM HH:mm')}
                                    </span>
                                    <span className="sm:hidden">
                                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                                    </span>
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              
                              <CollapsibleContent>
                                <div className="border-t p-4 space-y-4 bg-muted/30">
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                        <FileCode className="h-4 w-4" />
                                        Payload Recebido
                                      </h4>
                                      <ScrollArea className="h-48">
                                        <pre className="text-xs bg-background p-3 rounded-lg border overflow-x-auto">
                                          {formatPayload(log.request_payload) || 'Sem payload'}
                                        </pre>
                                      </ScrollArea>
                                    </div>
                                    <div>
                                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                        <FileCode className="h-4 w-4" />
                                        Resposta do Sistema
                                      </h4>
                                      <ScrollArea className="h-48">
                                        <pre className="text-xs bg-background p-3 rounded-lg border overflow-x-auto">
                                          {formatPayload(log.response_payload) || 'Sem resposta'}
                                        </pre>
                                      </ScrollArea>
                                    </div>
                                  </div>
                                  
                                  {logStatus === 'error' && integration && (
                                    <div className="flex items-center gap-2 pt-2 border-t">
                                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                      <span className="text-sm text-muted-foreground">
                                        Precisa corrigir o mapeamento?
                                      </span>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => setSelectedIntegration(integration)}
                                      >
                                        <Settings className="h-4 w-4 mr-1" />
                                        Configurar Integração
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <IntegrationDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedIntegration && (
        <IntegrationDetailDialog
          integration={selectedIntegration}
          open={!!selectedIntegration}
          onOpenChange={(open) => !open && setSelectedIntegration(null)}
        />
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir integração?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os logs e configurações serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

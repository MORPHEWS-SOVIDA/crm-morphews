import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Clock
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
import { formatDistanceToNow } from 'date-fns';
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

export default function Integrations() {
  const { data: integrations, isLoading: loadingIntegrations } = useIntegrations();
  const { data: allLogs, isLoading: loadingLogs } = useIntegrationLogs(undefined, 100);
  const deleteIntegration = useDeleteIntegration();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('list');

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

  const renderLogStatus = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
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
            <Card>
              <CardHeader>
                <CardTitle>Logs de Integração</CardTitle>
                <CardDescription>Últimas 100 execuções de webhooks e APIs</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : allLogs?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum log registrado ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {allLogs?.map(log => {
                      const integration = integrations?.find(i => i.id === log.integration_id);
                      
                      return (
                        <div 
                          key={log.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          {renderLogStatus(log.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
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
                              <p className="text-sm text-red-500 truncate">
                                {log.error_message}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {log.processing_time_ms && (
                              <span>{log.processing_time_ms}ms</span>
                            )}
                            <span>
                              {formatDistanceToNow(new Date(log.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, RefreshCw, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ErrorLog {
  id: string;
  organization_id: string | null;
  error_type: string;
  error_message: string;
  error_details: Record<string, unknown> | null;
  source: string | null;
  user_id: string | null;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
}

export function ErrorLogsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);

  // Fetch organizations for filter
  const { data: organizations } = useQuery({
    queryKey: ["super-admin-orgs-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Organization[];
    },
  });

  // Fetch error logs
  const { data: errorLogs, isLoading, refetch } = useQuery({
    queryKey: ["super-admin-error-logs", selectedSource, selectedOrg, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (selectedSource && selectedSource !== "all") {
        query = query.eq("source", selectedSource);
      }
      if (selectedOrg && selectedOrg !== "all") {
        query = query.eq("organization_id", selectedOrg);
      }
      if (searchTerm) {
        query = query.or(`error_message.ilike.%${searchTerm}%,error_type.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ErrorLog[];
    },
    refetchInterval: 30000, // Refetch every 30s
  });

  // Get unique sources from logs
  const sources = [...new Set(errorLogs?.map(log => log.source).filter(Boolean))];

  const getSourceBadge = (source: string | null) => {
    switch (source) {
      case "whatsapp":
        return <Badge variant="outline" className="bg-green-100 text-green-800">WhatsApp</Badge>;
      case "api":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">API</Badge>;
      case "client":
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Client</Badge>;
      case "edge-function":
        return <Badge variant="outline" className="bg-orange-100 text-orange-800">Edge</Badge>;
      default:
        return <Badge variant="outline">{source || "N/A"}</Badge>;
    }
  };

  const getOrgName = (orgId: string | null) => {
    if (!orgId) return "Sistema";
    const org = organizations?.find(o => o.id === orgId);
    return org?.name || orgId.slice(0, 8);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Logs de Erros
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por mensagem ou tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas fontes</SelectItem>
              {sources.map(source => (
                <SelectItem key={source} value={source || "unknown"}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Organização" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas organizações</SelectItem>
              {organizations?.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando logs...</div>
        ) : !errorLogs?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum erro registrado</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data/Hora</TableHead>
                  <TableHead className="w-[100px]">Fonte</TableHead>
                  <TableHead className="w-[150px]">Organização</TableHead>
                  <TableHead className="w-[150px]">Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/50">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getSourceBadge(log.source)}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">
                      {getOrgName(log.organization_id)}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {log.error_type}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[300px]">
                      {log.error_message}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        
        {errorLogs && errorLogs.length >= 200 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Mostrando os 200 erros mais recentes
          </p>
        )}
      </CardContent>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Detalhes do Erro
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">
                    {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fonte</p>
                  {getSourceBadge(selectedLog.source)}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Organização</p>
                  <p className="font-medium">{getOrgName(selectedLog.organization_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de Erro</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {selectedLog.error_type}
                  </code>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{selectedLog.error_message}</p>
                </div>
              </div>
              
              {selectedLog.error_details && Object.keys(selectedLog.error_details).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Detalhes Técnicos</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.error_details, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedLog.user_id && (
                <div>
                  <p className="text-xs text-muted-foreground">ID do Usuário</p>
                  <code className="text-xs">{selectedLog.user_id}</code>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

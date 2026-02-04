import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Phone, Plus, RefreshCw, Settings, Building2, 
  Loader2, Check, X, AlertCircle, MapPin, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/format";

interface PhoneNumber {
  id: string;
  phone_number: string;
  phone_number_sid: string | null;
  friendly_name: string | null;
  country_code: string;
  region: string | null;
  locality: string | null;
  capabilities: unknown;
  monthly_cost_cents: number;
  twilio_monthly_cost_cents: number | null;
  status: 'available' | 'allocated' | 'pending' | 'released';
  allocated_to_org_id: string | null;
  allocated_at: string | null;
  voice_bot_id: string | null;
  created_at: string;
  organizations?: { name: string } | null;
}

interface NumberRequest {
  id: string;
  organization_id: string;
  requested_by: string;
  preferred_region: string | null;
  preferred_locality: string | null;
  purpose: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  admin_notes: string | null;
  created_at: string;
  organizations?: { name: string };
  requester_profile?: { first_name: string; last_name: string };
}

export function VoicePhoneNumbersTab() {
  const queryClient = useQueryClient();
  const [isAddingNumber, setIsAddingNumber] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<NumberRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [selectedNumberForAllocation, setSelectedNumberForAllocation] = useState<string>("");

  const [newNumber, setNewNumber] = useState({
    phone_number: "",
    friendly_name: "",
    phone_number_sid: "",
    region: "",
    locality: "",
    monthly_cost_cents: 5000,
  });

  // Fetch phone numbers
  const { data: phoneNumbers, isLoading: loadingNumbers } = useQuery({
    queryKey: ["voice-phone-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_phone_numbers")
        .select(`
          *,
          organizations:allocated_to_org_id (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PhoneNumber[];
    },
  });

  // Fetch number requests
  const { data: requests, isLoading: loadingRequests } = useQuery({
    queryKey: ["voice-number-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_number_requests")
        .select(`
          *,
          organizations:organization_id (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch requester profiles separately
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (req) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", req.requested_by)
            .maybeSingle();
          return { ...req, requester_profile: profile };
        })
      );
      
      return requestsWithProfiles as NumberRequest[];
    },
  });

  // Fetch organizations for allocation
  const { data: organizations } = useQuery({
    queryKey: ["organizations-for-allocation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Add number mutation
  const addNumberMutation = useMutation({
    mutationFn: async (numberData: typeof newNumber) => {
      const { data, error } = await supabase
        .from("voice_phone_numbers")
        .insert({
          phone_number: numberData.phone_number,
          friendly_name: numberData.friendly_name || null,
          phone_number_sid: numberData.phone_number_sid || null,
          region: numberData.region || null,
          locality: numberData.locality || null,
          monthly_cost_cents: numberData.monthly_cost_cents,
          status: 'available',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-phone-numbers"] });
      toast.success("Número adicionado com sucesso!");
      setIsAddingNumber(false);
      setNewNumber({
        phone_number: "",
        friendly_name: "",
        phone_number_sid: "",
        region: "",
        locality: "",
        monthly_cost_cents: 5000,
      });
    },
    onError: (error: any) => {
      toast.error("Erro ao adicionar número: " + error.message);
    },
  });

  // Sync with Twilio
  const syncWithTwilio = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-sync-numbers");
      
      if (error) throw error;
      
      toast.success(`Sincronizado! ${data.imported || 0} números importados.`);
      queryClient.invalidateQueries({ queryKey: ["voice-phone-numbers"] });
    } catch (error: any) {
      toast.error("Erro ao sincronizar: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Process request mutation
  const processRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      action, 
      numberId,
      adminNotes 
    }: { 
      requestId: string; 
      action: 'approve' | 'reject' | 'fulfill';
      numberId?: string;
      adminNotes?: string;
    }) => {
      const updates: any = {
        admin_notes: adminNotes,
        processed_by: (await supabase.auth.getUser()).data.user?.id,
        processed_at: new Date().toISOString(),
      };

      if (action === 'reject') {
        updates.status = 'rejected';
      } else if (action === 'approve') {
        updates.status = 'approved';
      } else if (action === 'fulfill' && numberId) {
        updates.status = 'fulfilled';
        updates.allocated_number_id = numberId;

        // Get the request to get org_id
        const { data: request } = await supabase
          .from("voice_number_requests")
          .select("organization_id")
          .eq("id", requestId)
          .single();

        if (request) {
          // Allocate the number
          await supabase
            .from("voice_phone_numbers")
            .update({
              status: 'allocated',
              allocated_to_org_id: request.organization_id,
              allocated_at: new Date().toISOString(),
            })
            .eq("id", numberId);

          // Create allocation record
          const { data: numberData } = await supabase
            .from("voice_phone_numbers")
            .select("monthly_cost_cents")
            .eq("id", numberId)
            .single();

          await supabase
            .from("voice_number_allocations")
            .insert({
              phone_number_id: numberId,
              organization_id: request.organization_id,
              monthly_cost_cents: numberData?.monthly_cost_cents || 5000,
              next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            });
        }
      }

      const { error } = await supabase
        .from("voice_number_requests")
        .update(updates)
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-number-requests"] });
      queryClient.invalidateQueries({ queryKey: ["voice-phone-numbers"] });
      toast.success("Solicitação processada!");
      setSelectedRequest(null);
      setAdminNotes("");
      setSelectedNumberForAllocation("");
    },
    onError: (error: any) => {
      toast.error("Erro: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      available: { variant: "default", label: "Disponível" },
      allocated: { variant: "secondary", label: "Alocado" },
      pending: { variant: "outline", label: "Pendente" },
      released: { variant: "destructive", label: "Liberado" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRequestStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pendente" },
      approved: { variant: "secondary", label: "Aprovado" },
      rejected: { variant: "destructive", label: "Rejeitado" },
      fulfilled: { variant: "default", label: "Atendido" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const availableNumbers = phoneNumbers?.filter(n => n.status === 'available') || [];
  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{phoneNumbers?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Números</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{availableNumbers.length}</p>
                <p className="text-sm text-muted-foreground">Disponíveis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {phoneNumbers?.filter(n => n.status === 'allocated').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Alocados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingRequests.length}</p>
                <p className="text-sm text-muted-foreground">Solicitações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              {pendingRequests.length} Solicitação(ões) Pendente(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="flex items-center justify-between bg-white p-3 rounded-lg">
                  <div>
                    <p className="font-medium">{request.organizations?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {request.preferred_region && `DDD: ${request.preferred_region}`}
                      {request.purpose && ` • ${request.purpose}`}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSelectedRequest(request)}>
                    Processar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Numbers List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Números Telefônicos</CardTitle>
            <CardDescription>Pool de números disponíveis para alocação</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncWithTwilio} disabled={isSyncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar Twilio
            </Button>
            <Dialog open={isAddingNumber} onOpenChange={setIsAddingNumber}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Manual
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Número Manualmente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Número (E.164)</Label>
                    <Input
                      value={newNumber.phone_number}
                      onChange={(e) => setNewNumber({ ...newNumber, phone_number: e.target.value })}
                      placeholder="+5551999999999"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>DDD/Região</Label>
                      <Input
                        value={newNumber.region}
                        onChange={(e) => setNewNumber({ ...newNumber, region: e.target.value })}
                        placeholder="51"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input
                        value={newNumber.locality}
                        onChange={(e) => setNewNumber({ ...newNumber, locality: e.target.value })}
                        placeholder="Porto Alegre"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number SID (Twilio)</Label>
                    <Input
                      value={newNumber.phone_number_sid}
                      onChange={(e) => setNewNumber({ ...newNumber, phone_number_sid: e.target.value })}
                      placeholder="PN..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo Mensal (centavos)</Label>
                    <Input
                      type="number"
                      value={newNumber.monthly_cost_cents}
                      onChange={(e) => setNewNumber({ ...newNumber, monthly_cost_cents: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">
                      = {formatCurrency(newNumber.monthly_cost_cents / 100)}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddingNumber(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => addNumberMutation.mutate(newNumber)}
                    disabled={!newNumber.phone_number || addNumberMutation.isPending}
                  >
                    {addNumberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Adicionar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingNumbers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : phoneNumbers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum número cadastrado</p>
              <p className="text-sm mt-1">Sincronize com o Twilio ou adicione manualmente</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Alocado Para</TableHead>
                    <TableHead>Custo/Mês</TableHead>
                    <TableHead>Adicionado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phoneNumbers?.map((number) => (
                    <TableRow key={number.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{number.phone_number}</p>
                            {number.friendly_name && (
                              <p className="text-xs text-muted-foreground">{number.friendly_name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span>{number.region || number.locality || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(number.status)}</TableCell>
                      <TableCell>
                        {number.organizations?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-muted-foreground" />
                          <span>{formatCurrency(number.monthly_cost_cents / 100)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(number.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Process Request Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processar Solicitação</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p><strong>Organização:</strong> {selectedRequest.organizations?.name}</p>
                <p><strong>Solicitante:</strong> {selectedRequest.requester_profile?.first_name} {selectedRequest.requester_profile?.last_name}</p>
                {selectedRequest.preferred_region && (
                  <p><strong>DDD Preferido:</strong> {selectedRequest.preferred_region}</p>
                )}
                {selectedRequest.preferred_locality && (
                  <p><strong>Cidade:</strong> {selectedRequest.preferred_locality}</p>
                )}
                {selectedRequest.purpose && (
                  <p><strong>Finalidade:</strong> {selectedRequest.purpose}</p>
                )}
                {selectedRequest.notes && (
                  <p><strong>Observações:</strong> {selectedRequest.notes}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Selecionar Número para Alocar</Label>
                <Select 
                  value={selectedNumberForAllocation} 
                  onValueChange={setSelectedNumberForAllocation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um número disponível" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNumbers.map((number) => (
                      <SelectItem key={number.id} value={number.id}>
                        {number.phone_number} 
                        {number.region && ` (${number.region})`}
                        {` - ${formatCurrency(number.monthly_cost_cents / 100)}/mês`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas do Admin</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Observações sobre a decisão..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button 
              variant="destructive"
              onClick={() => processRequestMutation.mutate({
                requestId: selectedRequest!.id,
                action: 'reject',
                adminNotes,
              })}
              disabled={processRequestMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Rejeitar
            </Button>
            <Button
              onClick={() => processRequestMutation.mutate({
                requestId: selectedRequest!.id,
                action: 'fulfill',
                numberId: selectedNumberForAllocation,
                adminNotes,
              })}
              disabled={!selectedNumberForAllocation || processRequestMutation.isPending}
            >
              {processRequestMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Check className="w-4 h-4 mr-2" />
              Alocar Número
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

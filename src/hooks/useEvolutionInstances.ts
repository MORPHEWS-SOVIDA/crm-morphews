import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'email';

interface EvolutionInstance {
  id: string;
  organization_id: string;
  name: string;
  phone_number: string | null;
  provider: string;
  evolution_instance_id: string | null;
  status: string;
  is_connected: boolean;
  qr_code_base64: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  channel_type?: ChannelType;
  instagram_username?: string | null;
  meta_page_id?: string | null;
}

export type InstanceFilter = "all" | "connected" | "disconnected" | "archived";

export function useEvolutionInstances() {
  const queryClient = useQueryClient();
  const [pollingInstanceId, setPollingInstanceId] = useState<string | null>(null);

  // Listar instâncias
  const { data: instances, isLoading, refetch } = useQuery({
    queryKey: ["evolution-instances"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Não autenticado");
      }

      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "list" },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data?.instances || []) as EvolutionInstance[];
    },
  });

  // Criar instância
  const createInstance = useMutation({
    mutationFn: async (params: { name: string; settings?: {
      reject_call?: boolean;
      msg_call?: string;
      groups_ignore?: boolean;
      always_online?: boolean;
      read_messages?: boolean;
      read_status?: boolean;
      sync_full_history?: boolean;
    }}) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "create", name: params.name, settings: params.settings },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return {
        instance: response.data?.instance as EvolutionInstance,
        qr_code_base64: response.data?.qr_code_base64 as string | null,
      };
    },
    onSuccess: (result) => {
      if (result?.instance) {
        toast.success(`Instância "${result.instance.name}" criada!`);
        queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
        // Iniciar polling para verificar conexão
        setPollingInstanceId(result.instance.id);
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar instância: ${error.message}`);
    },
  });

  // Buscar QR Code
  const getQrCode = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "get_qr", instanceId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return {
        qr_code_base64: response.data?.qr_code_base64 as string | null,
        pairing_code: response.data?.pairing_code as string | null,
      };
    },
  });

  // Verificar status
  const checkStatus = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "status", instanceId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return {
        is_connected: response.data?.is_connected as boolean,
        status: response.data?.status as string,
      };
    },
    onSuccess: (data) => {
      if (data.is_connected) {
        toast.success("WhatsApp conectado!");
        setPollingInstanceId(null);
        queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
      }
    },
  });

  // Arquivar instância (soft-delete)
  const archiveInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "archive", instanceId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return true;
    },
    onSuccess: () => {
      toast.success("Instância arquivada!");
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao arquivar: ${error.message}`);
    },
  });

  // Desarquivar instância
  const unarchiveInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "unarchive", instanceId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return true;
    },
    onSuccess: () => {
      toast.success("Instância restaurada!");
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao restaurar: ${error.message}`);
    },
  });

  // Desconectar (logout)
  const logoutInstance = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "logout", instanceId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return true;
    },
    onSuccess: () => {
      toast.success("Desconectado!");
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Habilitar grupos na instância
  const enableGroups = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "enable_groups", instanceId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success("Grupos habilitados! As mensagens de grupos aparecerão no chat.");
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao habilitar grupos: ${error.message}`);
    },
  });

  // Adicionar instância manualmente
  const addManualInstance = useMutation({
    mutationFn: async (params: { 
      name: string; 
      evolution_instance_id: string; 
      evolution_api_token?: string;
      phone_number?: string;
      manual_instance_number?: string;
      manual_device_label?: string;
      display_name_for_team?: string;
    }) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { 
          action: "add_manual", 
          name: params.name,
          evolution_instance_id: params.evolution_instance_id,
          evolution_api_token: params.evolution_api_token || null,
          phone_number: params.phone_number || null,
          manual_instance_number: params.manual_instance_number || null,
          manual_device_label: params.manual_device_label || null,
          display_name_for_team: params.display_name_for_team || null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Instância adicionada!");
      queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar: ${error.message}`);
    },
  });

  // Criar instância Instagram
  const createInstagramInstance = useMutation({
    mutationFn: async (params: { name: string }) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "create_instagram", name: params.name },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return {
        instance: response.data?.instance,
        oauth_url: response.data?.oauth_url as string | null,
        message: response.data?.message as string,
      };
    },
    onSuccess: (result) => {
      if (result?.instance) {
        toast.success(result.message || `Instância Instagram "${result.instance.name}" criada!`);
        queryClient.invalidateQueries({ queryKey: ["evolution-instances"] });
        
        // Abrir URL OAuth em nova aba se disponível
        if (result.oauth_url) {
          window.open(result.oauth_url, "_blank");
        }
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar instância Instagram: ${error.message}`);
    },
  });

  // Buscar URL OAuth do Instagram
  const getInstagramOAuthUrl = useMutation({
    mutationFn: async (instanceId: string) => {
      const response = await supabase.functions.invoke("evolution-instance-manager", {
        body: { action: "get_instagram_oauth", instanceId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return {
        oauth_url: response.data?.oauth_url as string | null,
      };
    },
    onSuccess: (result) => {
      if (result?.oauth_url) {
        window.open(result.oauth_url, "_blank");
      } else {
        toast.error("URL de autenticação não disponível. Tente novamente.");
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    instances,
    isLoading,
    refetch,
    createInstance,
    createInstagramInstance,
    getQrCode,
    getInstagramOAuthUrl,
    checkStatus,
    archiveInstance,
    unarchiveInstance,
    logoutInstance,
    enableGroups,
    addManualInstance,
    pollingInstanceId,
    setPollingInstanceId,
  };
}

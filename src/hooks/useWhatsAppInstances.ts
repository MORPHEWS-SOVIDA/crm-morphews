import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface WhatsAppInstance {
  id: string;
  organization_id: string;
  name: string;
  phone_number: string | null;
  z_api_instance_id: string | null;
  z_api_token: string | null;
  z_api_client_token: string | null;
  provider: "zapi" | "wasenderapi";
  wasender_session_id: string | null;
  wasender_api_key: string | null;
  status: "pending" | "active" | "disconnected" | "canceled";
  qr_code_base64: string | null;
  is_connected: boolean;
  monthly_price_cents: number;
  payment_source: "stripe" | "admin_grant";
  applied_coupon_id: string | null;
  discount_applied_cents: number | null;
  created_at: string;
  updated_at: string;
}

export interface DiscountCoupon {
  id: string;
  code: string;
  discount_value_cents: number;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  valid_until: string | null;
  created_at: string;
}

export function useWhatsAppInstances() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["whatsapp-instances", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WhatsAppInstance[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useWhatsAppInstanceUsers(instanceId: string | null) {
  return useQuery({
    queryKey: ["whatsapp-instance-users", instanceId],
    queryFn: async () => {
      if (!instanceId) return [];

      const { data, error } = await supabase
        .from("whatsapp_instance_users")
        .select("*, profiles:user_id(first_name, last_name)")
        .eq("instance_id", instanceId);

      if (error) throw error;
      return data;
    },
    enabled: !!instanceId,
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase
        .from("discount_coupons")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error) throw new Error("Cupom inválido ou expirado");
      
      if (data.max_uses && data.current_uses >= data.max_uses) {
        throw new Error("Cupom já atingiu o limite de usos");
      }
      
      if (data.valid_until && new Date(data.valid_until) < new Date()) {
        throw new Error("Cupom expirado");
      }

      return data as DiscountCoupon;
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCreateWhatsAppInstance() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      couponId?: string;
      discountCents?: number;
      provider?: "zapi" | "wasenderapi";
      priceCents?: number;
    }) => {
      if (!profile?.organization_id) throw new Error("Sem organização");

      const { data: instance, error } = await supabase
        .from("whatsapp_instances")
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          applied_coupon_id: data.couponId || null,
          discount_applied_cents: data.discountCents || 0,
          provider: data.provider || "zapi",
          monthly_price_cents: data.priceCents || 19700,
        })
        .select()
        .single();

      if (error) throw error;

      // Increment coupon usage if a coupon was applied using SQL function
      if (data.couponId) {
        await supabase.rpc("increment_coupon_usage", { coupon_id: data.couponId });
      }

      // Auto-add creator as instance user with view/send permissions
      if (profile?.user_id && instance) {
        await supabase
          .from("whatsapp_instance_users")
          .insert({
            instance_id: instance.id,
            user_id: profile.user_id,
            can_view: true,
            can_send: true,
          });
      }

      return instance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      queryClient.invalidateQueries({ queryKey: ["discount-coupons"] });
      toast({ title: "Instância criada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar instância",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateWhatsAppInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppInstance> & { id: string }) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
    },
  });
}

export function useOrganizationWhatsAppCredits() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["org-whatsapp-credits", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from("organization_whatsapp_credits")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
  });
}

// Admin hooks for coupons
export function useDiscountCoupons() {
  return useQuery({
    queryKey: ["discount-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DiscountCoupon[];
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      code: string;
      discount_value_cents: number;
      max_uses?: number;
      valid_until?: string;
    }) => {
      const { error } = await supabase
        .from("discount_coupons")
        .insert({
          code: data.code.toUpperCase(),
          discount_value_cents: data.discount_value_cents,
          max_uses: data.max_uses || null,
          valid_until: data.valid_until || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-coupons"] });
      toast({ title: "Cupom criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar cupom",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useToggleCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("discount_coupons")
        .update({ is_active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-coupons"] });
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("discount_coupons")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-coupons"] });
      toast({ title: "Cupom excluído!" });
    },
  });
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Building2, Globe, Target, FileText } from "lucide-react";

export default function Onboarding() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [formData, setFormData] = useState({
    cnpj: "",
    company_site: "",
    crm_usage_intent: "",
    business_description: "",
  });

  // Check if onboarding was already completed using RPC
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user?.id) {
        setIsChecking(false);
        return;
      }

      // If no organization_id in profile, skip onboarding entirely
      if (!profile?.organization_id) {
        console.log("No organization_id in profile, redirecting to dashboard");
        navigate("/", { replace: true });
        return;
      }

      try {
        // Use RPC to check if onboarding is completed (bypasses RLS issues)
        const { data: hasCompleted, error } = await supabase.rpc("has_onboarding_completed");

        if (error) {
          console.error("Error checking onboarding via RPC:", error);
          // If RPC fails, redirect to dashboard instead of blocking
          navigate("/", { replace: true });
          return;
        }

        if (hasCompleted) {
          // Onboarding already done, redirect to dashboard
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Error checking onboarding:", error);
        // On any error, redirect to dashboard instead of blocking
        navigate("/", { replace: true });
        return;
      }
      
      setIsChecking(false);
    };

    checkOnboarding();
  }, [user?.id, profile?.organization_id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.organization_id) {
      toast({
        title: "Erro",
        description: "Organização não encontrada. Entre em contato com o suporte.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use RPC to save onboarding data (bypasses RLS issues)
      const { error } = await supabase.rpc("save_onboarding_data", {
        _cnpj: formData.cnpj || null,
        _company_site: formData.company_site || null,
        _crm_usage_intent: formData.crm_usage_intent || null,
        _business_description: formData.business_description || null,
      });

      if (error) {
        if (error.message === "ORG_NOT_FOUND") {
          throw new Error("Organização não encontrada. Entre em contato com o suporte.");
        }
        throw error;
      }

      toast({
        title: "Dados salvos com sucesso!",
        description: "Bem-vindo ao Morphews CRM!",
      });

      navigate("/", { replace: true });
    } catch (error: any) {
      console.error("Error saving onboarding data:", error);
      toast({
        title: "Erro ao salvar dados",
        description: error.message || "Erro desconhecido. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!profile?.organization_id || !user?.id) {
      navigate("/", { replace: true });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use RPC to save empty onboarding data (marks as completed)
      const { error } = await supabase.rpc("save_onboarding_data", {
        _cnpj: null,
        _company_site: null,
        _crm_usage_intent: null,
        _business_description: null,
      });

      if (error) {
        console.error("Error skipping onboarding:", error);
      }
    } catch (error) {
      console.error("Error skipping onboarding:", error);
    } finally {
      setIsSubmitting(false);
      navigate("/", { replace: true });
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao Morphews CRM!</CardTitle>
          <CardDescription>
            Conte-nos um pouco mais sobre sua empresa para personalizarmos sua experiência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cnpj" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                CNPJ (opcional)
              </Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_site" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Site da Empresa (opcional)
              </Label>
              <Input
                id="company_site"
                placeholder="https://suaempresa.com.br"
                value={formData.company_site}
                onChange={(e) => setFormData({ ...formData, company_site: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="crm_usage_intent" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Como pretende usar o CRM?
              </Label>
              <Textarea
                id="crm_usage_intent"
                placeholder="Ex: Gerenciar leads de vendas, controlar follow-ups, organizar clientes..."
                value={formData.crm_usage_intent}
                onChange={(e) => setFormData({ ...formData, crm_usage_intent: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_description" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Fale um pouco sobre seu negócio
              </Label>
              <Textarea
                id="business_description"
                placeholder="Ex: Somos uma agência de marketing digital focada em pequenas empresas..."
                value={formData.business_description}
                onChange={(e) => setFormData({ ...formData, business_description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Pular por agora
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Continuar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

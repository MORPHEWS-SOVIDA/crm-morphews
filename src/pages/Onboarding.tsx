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

  // Check if onboarding was already completed
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!profile?.organization_id) {
        setIsChecking(false);
        return;
      }

      try {
        const { data: existing } = await supabase
          .from("onboarding_data")
          .select("id")
          .eq("organization_id", profile.organization_id)
          .maybeSingle();

        if (existing) {
          // Onboarding already done, redirect to dashboard
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Error checking onboarding:", error);
      }
      
      setIsChecking(false);
    };

    checkOnboarding();
  }, [profile?.organization_id, navigate]);

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
      // Use upsert to handle both insert and update
      const { error } = await supabase.from("onboarding_data").upsert({
        organization_id: profile.organization_id,
        user_id: user?.id,
        cnpj: formData.cnpj || null,
        company_site: formData.company_site || null,
        crm_usage_intent: formData.crm_usage_intent || null,
        business_description: formData.business_description || null,
        completed_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id'
      });

      if (error) throw error;

      toast({
        title: "Dados salvos com sucesso!",
        description: "Bem-vindo ao Morphews CRM!",
      });

      navigate("/", { replace: true });
    } catch (error: any) {
      console.error("Error saving onboarding data:", error);
      toast({
        title: "Erro ao salvar dados",
        description: error.message,
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

    try {
      // Create empty onboarding record to mark as skipped
      await supabase.from("onboarding_data").upsert({
        organization_id: profile.organization_id,
        user_id: user.id,
        completed_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id'
      });
    } catch (error) {
      console.error("Error skipping onboarding:", error);
    }
    
    navigate("/", { replace: true });
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

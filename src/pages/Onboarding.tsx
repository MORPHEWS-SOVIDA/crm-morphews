import { useState } from "react";
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
  const [formData, setFormData] = useState({
    cnpj: "",
    company_site: "",
    crm_usage_intent: "",
    business_description: "",
  });

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
      const { error } = await supabase.from("onboarding_data").insert({
        organization_id: profile.organization_id,
        user_id: user?.id,
        cnpj: formData.cnpj || null,
        company_site: formData.company_site || null,
        crm_usage_intent: formData.crm_usage_intent || null,
        business_description: formData.business_description || null,
      });

      if (error) throw error;

      toast({
        title: "Dados salvos com sucesso!",
        description: "Bem-vindo ao Morphews CRM!",
      });

      navigate("/");
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

  const handleSkip = () => {
    navigate("/");
  };

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

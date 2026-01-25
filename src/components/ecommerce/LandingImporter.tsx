import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Globe, Upload, Copy, Star, Loader2, Sparkles, ExternalLink, Check } from "lucide-react";

interface LandingTemplate {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  headline: string | null;
  is_featured: boolean;
  clone_count: number;
}

const CATEGORIES = [
  { value: "all", label: "Todos" },
  { value: "saude", label: "Saúde" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "servicos", label: "Serviços" },
  { value: "educacao", label: "Educação" },
];

interface LandingImporterProps {
  onSuccess?: (landingPageId: string) => void;
}

export function LandingImporter({ onSuccess }: LandingImporterProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"templates" | "import">("templates");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [importUrl, setImportUrl] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<LandingTemplate | null>(null);

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["landing-templates-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_templates" as any)
        .select("id, name, description, thumbnail_url, category, headline, is_featured, clone_count")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("clone_count", { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as LandingTemplate[];
    },
  });

  // Clone template mutation
  // Helper to normalize benefits from objects to strings
  const normalizeBenefits = (benefits: unknown): string[] => {
    if (!Array.isArray(benefits)) return [];
    return benefits.map((b: unknown) => {
      if (typeof b === 'string') return b;
      if (b && typeof b === 'object') {
        const obj = b as Record<string, unknown>;
        if (typeof obj.title === 'string') return obj.title;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.description === 'string') return obj.description;
        try { return JSON.stringify(b); } catch { return ''; }
      }
      return String(b ?? '');
    }).filter((b: string) => b && b.trim().length > 0);
  };

  const cloneMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      // Fetch full template (using any since table was just created)
      const { data: templateData, error: templateError } = await supabase
        .from("landing_page_templates" as any)
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateError || !templateData) throw new Error("Template não encontrado");
      
      const template = templateData as any;

      // Generate unique slug
      const baseSlug = (template.name || "landing")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .substring(0, 30);
      const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

      // Normalize benefits from objects to strings
      const normalizedBenefits = normalizeBenefits(template.benefits);

      // Create landing page from template
      const insertData = {
        organization_id: profile.organization_id,
        name: `${template.name} (Clone)`,
        slug: slug,
        headline: template.headline || "Título da sua Landing Page",
        subheadline: template.subheadline || "",
        video_url: template.video_url,
        benefits: normalizedBenefits,
        testimonials: template.testimonials,
        faq: template.faq,
        urgency_text: template.urgency_text || "",
        guarantee_text: template.guarantee_text || "",
        logo_url: template.logo_url,
        primary_color: template.primary_color || "#10b981",
        custom_css: template.custom_css || "",
        is_active: false,
        settings: {
          cloned_from_template: templateId,
          branding: template.branding,
        },
      };

      const { data: landingPage, error: lpError } = await supabase
        .from("landing_pages")
        .insert(insertData as any)
        .select()
        .single();

      if (lpError) throw lpError;

      // Increment clone count
      await supabase
        .from("landing_page_templates" as any)
        .update({ clone_count: (template.clone_count || 0) + 1 })
        .eq("id", templateId);

      return landingPage;
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso!", description: "Landing page clonada. Personalize e ative!" });
      queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
      setIsDialogOpen(false);
      if (onSuccess) {
        onSuccess(data.id);
      } else {
        navigate(`/ecommerce/landpage-editor/${data.id}`);
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Import from URL mutation
  const importMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.functions.invoke("scrape-landing-page", {
        body: { 
          url, 
          saveAsLandingPage: true,
          organizationId: profile.organization_id,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao importar");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso!", description: "Site importado como landing page!" });
      queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
      setIsDialogOpen(false);
      setImportUrl("");
      if (onSuccess) {
        onSuccess(data.landingPageId);
      } else if (data.landingPageId) {
        navigate(`/ecommerce/landpage-editor/${data.landingPageId}`);
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const filteredTemplates = templates?.filter(t => 
    categoryFilter === "all" || t.category === categoryFilter
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Globe className="h-4 w-4 mr-2" />
          Importar / Usar Template
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Landing Page</DialogTitle>
          <DialogDescription>
            Escolha um template pronto ou importe de um site existente
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">
              <Sparkles className="h-4 w-4 mr-2" />
              Templates Prontos
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Importar Site
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4 mt-4">
            {/* Category Filter */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat.value}
                  variant={categoryFilter === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(cat.value)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* Templates Grid */}
            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTemplates?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum template disponível nesta categoria</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates?.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary ${
                      selectedTemplate?.id === template.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="relative">
                      {template.thumbnail_url ? (
                        <img
                          src={template.thumbnail_url}
                          alt={template.name}
                          className="w-full h-28 object-cover object-top rounded-t-lg"
                        />
                      ) : (
                        <div className="w-full h-28 bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-lg flex items-center justify-center">
                          <Globe className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      {template.is_featured && (
                        <Badge className="absolute top-2 right-2 bg-yellow-500">
                          <Star className="h-3 w-3 mr-1" />
                          Popular
                        </Badge>
                      )}

                      {selectedTemplate?.id === template.id && (
                        <div className="absolute inset-0 bg-primary/20 rounded-t-lg flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-2">
                            <Check className="h-6 w-6" />
                          </div>
                        </div>
                      )}
                    </div>

                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {template.description || template.headline || "Template de alta conversão"}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0 pb-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                        </Badge>
                        <span>
                          <Copy className="h-3 w-3 inline mr-1" />
                          {template.clone_count} usos
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedTemplate && (
              <div className="flex justify-end pt-4 border-t">
                <Button 
                  onClick={() => cloneMutation.mutate(selectedTemplate.id)}
                  disabled={cloneMutation.isPending}
                >
                  {cloneMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clonando...
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Usar Este Template
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Importar de URL</CardTitle>
                <CardDescription>
                  Cole a URL do seu site WordPress, Wix, ou qualquer página para converter em landing page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Site</Label>
                  <Input
                    placeholder="https://www.meusite.com.br"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">O que será extraído:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Título e subtítulo da página</li>
                    <li>✓ Lista de benefícios e features</li>
                    <li>✓ Perguntas frequentes (FAQ)</li>
                    <li>✓ Cores e logo do site</li>
                    <li>✓ Textos de garantia e urgência</li>
                  </ul>
                </div>

                <Button 
                  onClick={() => importMutation.mutate(importUrl)}
                  disabled={!importUrl.trim() || importMutation.isPending}
                  className="w-full"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando site...
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      Importar e Criar Landing Page
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

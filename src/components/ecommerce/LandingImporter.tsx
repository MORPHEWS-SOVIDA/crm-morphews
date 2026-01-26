import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Globe, 
  Upload, 
  Sparkles, 
  Copy, 
  Star, 
  Loader2, 
  Check,
  Code,
  FileText,
  AlertCircle,
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "Todos" },
  { value: "saude", label: "Saúde" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "servicos", label: "Serviços" },
  { value: "educacao", label: "Educação" },
];

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
  const [importMode, setImportMode] = useState<"full_html" | "structured">("full_html");
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

  // Clone template mutation
  const cloneMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { data: templateData, error: templateError } = await supabase
        .from("landing_page_templates" as any)
        .select("*")
        .eq("id", templateId)
        .single();

      if (templateError || !templateData) throw new Error("Template não encontrado");
      
      const template = templateData as any;

      const baseSlug = (template.name || "landing")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .substring(0, 30);
      const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

      const normalizedBenefits = normalizeBenefits(template.benefits);

      // Determine if template has full_html
      const hasFullHtml = !!template.full_html;

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
        // Full HTML mode
        full_html: template.full_html || null,
        import_mode: hasFullHtml ? "full_html" : "structured",
        source_url: template.source_url || null,
        branding: template.branding || {},
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
    mutationFn: async ({ url, mode }: { url: string; mode: "full_html" | "structured" }) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { data, error } = await supabase.functions.invoke("scrape-landing-page", {
        body: { 
          url, 
          saveAsLandingPage: true,
          organizationId: profile.organization_id,
          importMode: mode,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro ao importar");
      return data;
    },
    onSuccess: (data) => {
      const modeLabel = data.importMode === "full_html" ? "Site completo importado!" : "Conteúdo extraído!";
      toast({ title: "Sucesso!", description: modeLabel });
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
                  Cole a URL do seu site para importar como landing page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* URL Input */}
                <div className="space-y-2">
                  <Label>URL do Site</Label>
                  <Input
                    placeholder="https://www.meusite.com.br"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                </div>

                {/* Import Mode Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Como você quer importar?</Label>
                  
                  <RadioGroup 
                    value={importMode} 
                    onValueChange={(v) => setImportMode(v as any)}
                    className="grid gap-3"
                  >
                    {/* Full HTML Mode */}
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="full_html" id="full_html" className="mt-1" />
                      <Label htmlFor="full_html" className="flex-1 cursor-pointer">
                        <Card className={`p-4 transition-all ${importMode === 'full_html' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                              <Code className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm">Site Completo (Recomendado)</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Importa o HTML/CSS original do site. Você terá uma cópia fiel para editar.
                                Ideal para sites já prontos como Lipofree, WordPress, etc.
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="secondary" className="text-xs">Layout original</Badge>
                                <Badge variant="secondary" className="text-xs">Imagens preservadas</Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Label>
                    </div>

                    {/* Structured Mode */}
                    <div className="flex items-start space-x-3">
                      <RadioGroupItem value="structured" id="structured" className="mt-1" />
                      <Label htmlFor="structured" className="flex-1 cursor-pointer">
                        <Card className={`p-4 transition-all ${importMode === 'structured' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm">Extrair Conteúdo</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Extrai apenas os textos (título, benefícios, FAQ) e aplica num template simples.
                                Bom para recriar do zero com novo visual.
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">Textos extraídos</Badge>
                                <Badge variant="outline" className="text-xs">Template genérico</Badge>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Info Box */}
                {importMode === "full_html" && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg flex gap-3">
                    <AlertCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-green-800 dark:text-green-200">Site Completo</p>
                      <p className="text-green-700 dark:text-green-300 mt-1">
                        O site será importado com todos os estilos e layout original.
                        Você poderá editar textos e imagens diretamente.
                      </p>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={() => importMutation.mutate({ url: importUrl, mode: importMode })}
                  disabled={!importUrl.trim() || importMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando site... (pode levar alguns segundos)
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4 mr-2" />
                      Importar Site
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

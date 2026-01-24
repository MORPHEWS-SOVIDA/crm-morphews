import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Globe, Upload, Trash2, Eye, Copy, Star, Loader2, ExternalLink } from "lucide-react";

interface LandingTemplate {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string;
  source_url: string | null;
  source_type: string;
  headline: string | null;
  is_active: boolean;
  is_featured: boolean;
  clone_count: number;
  created_at: string;
}

const CATEGORIES = [
  { value: "saude", label: "Saúde & Bem-estar" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "servicos", label: "Serviços" },
  { value: "educacao", label: "Educação" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "importado", label: "Importado" },
  { value: "geral", label: "Geral" },
];

export function LandingTemplatesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeName, setScrapeName] = useState("");
  const [scrapeCategory, setScrapeCategory] = useState("importado");
  const [isScrapingOpen, setIsScrapingOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<LandingTemplate | null>(null);
  const [scrapeResult, setScrapeResult] = useState<any>(null);

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["landing-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_templates" as any)
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as LandingTemplate[];
    },
  });

  // Scrape mutation
  const scrapeMutation = useMutation({
    mutationFn: async ({ url, name, category }: { url: string; name: string; category: string }) => {
      const { data, error } = await supabase.functions.invoke("scrape-landing-page", {
        body: { 
          url, 
          name: name || undefined, 
          category,
          saveAsTemplate: true 
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Erro no scraping");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso!", description: "Template criado a partir do site." });
      setScrapeResult(data);
      queryClient.invalidateQueries({ queryKey: ["landing-templates"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("landing_page_templates" as any)
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-templates"] });
    },
  });

  // Toggle featured
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, isFeatured }: { id: string; isFeatured: boolean }) => {
      const { error } = await supabase
        .from("landing_page_templates" as any)
        .update({ is_featured: isFeatured })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-templates"] });
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("landing_page_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Template excluído" });
      queryClient.invalidateQueries({ queryKey: ["landing-templates"] });
    },
  });

  const handleScrape = () => {
    if (!scrapeUrl.trim()) {
      toast({ title: "Digite a URL", variant: "destructive" });
      return;
    }
    scrapeMutation.mutate({ url: scrapeUrl, name: scrapeName, category: scrapeCategory });
  };

  const resetScrapeForm = () => {
    setScrapeUrl("");
    setScrapeName("");
    setScrapeCategory("importado");
    setScrapeResult(null);
    setIsScrapingOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Templates de Landing Pages</h2>
          <p className="text-sm text-muted-foreground">
            Crie templates que usuários podem clonar para suas landing pages
          </p>
        </div>
        
        <Dialog open={isScrapingOpen} onOpenChange={(open) => {
          setIsScrapingOpen(open);
          if (!open) resetScrapeForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Globe className="h-4 w-4 mr-2" />
              Importar de URL
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Importar Landing Page de URL</DialogTitle>
              <DialogDescription>
                Cole a URL de qualquer site (WordPress, Wix, etc) para clonar como template
              </DialogDescription>
            </DialogHeader>

            {!scrapeResult ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>URL do Site</Label>
                  <Input
                    placeholder="https://www.volteasemexer.com.br"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Template (opcional)</Label>
                    <Input
                      placeholder="Ex: LP Saúde Premium"
                      value={scrapeName}
                      onChange={(e) => setScrapeName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={scrapeCategory} onValueChange={setScrapeCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={resetScrapeForm}>
                    Cancelar
                  </Button>
                  <Button onClick={handleScrape} disabled={scrapeMutation.isPending}>
                    {scrapeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4 mr-2" />
                        Importar Site
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="bg-green-500/10 text-green-600 p-4 rounded-lg">
                  ✅ Template criado com sucesso!
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>
                    <p className="font-medium">{scrapeResult.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Headline:</span>
                    <p className="font-medium">{scrapeResult.headline?.substring(0, 50)}...</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Benefícios:</span>
                    <p className="font-medium">{scrapeResult.benefits?.length || 0} encontrados</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">FAQs:</span>
                    <p className="font-medium">{scrapeResult.faq?.length || 0} encontrados</p>
                  </div>
                </div>

                {scrapeResult.screenshot && (
                  <div>
                    <Label>Preview</Label>
                    <img 
                      src={scrapeResult.screenshot} 
                      alt="Preview" 
                      className="w-full h-48 object-cover object-top rounded-lg border mt-2"
                    />
                  </div>
                )}

                <DialogFooter>
                  <Button onClick={resetScrapeForm}>Fechar</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhum template ainda</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Importe um site ou crie um template manualmente para começar
            </p>
            <Button onClick={() => setIsScrapingOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates?.map((template) => (
            <Card key={template.id} className={!template.is_active ? "opacity-60" : ""}>
              <div className="relative">
                {template.thumbnail_url ? (
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-32 object-cover object-top rounded-t-lg"
                  />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-lg flex items-center justify-center">
                    <Globe className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                <div className="absolute top-2 right-2 flex gap-1">
                  {template.is_featured && (
                    <Badge className="bg-yellow-500">
                      <Star className="h-3 w-3 mr-1" />
                      Destaque
                    </Badge>
                  )}
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>

              <CardHeader className="pb-2">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {template.description || template.headline || "Sem descrição"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="outline">
                    {CATEGORIES.find((c) => c.value === template.category)?.label || template.category}
                  </Badge>
                  <span className="text-muted-foreground">
                    <Copy className="h-3 w-3 inline mr-1" />
                    {template.clone_count} clones
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: template.id, isActive: checked })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Ativo</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={template.is_featured}
                      onCheckedChange={(checked) => 
                        toggleFeaturedMutation.mutate({ id: template.id, isFeatured: checked })
                      }
                    />
                    <span className="text-xs text-muted-foreground">Destaque</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {template.source_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(template.source_url!, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Original
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreviewTemplate(template);
                      setIsPreviewOpen(true);
                    }}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Excluir este template?")) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Camera, Upload, Instagram, ArrowLeft, Loader2, CheckCircle2, X, ImageIcon
} from 'lucide-react';

export default function SocialSellingImport() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [sellerId, setSellerId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [periodDate, setPeriodDate] = useState('');
  const [periodStartTime, setPeriodStartTime] = useState('08:00');
  const [periodEndTime, setPeriodEndTime] = useState('12:00');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ usernames: string[]; leads_created: number } | null>(null);

  // Fetch sellers
  const { data: sellers } = useQuery({
    queryKey: ['social-sellers', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_sellers')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!orgId,
  });

  // Fetch profiles
  const { data: igProfiles } = useQuery({
    queryKey: ['social-selling-profiles', orgId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_selling_profiles')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!orgId,
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setFiles(prev => [...prev, ...selected]);
    
    // Generate previews
    selected.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!sellerId || !profileId || !periodDate || files.length === 0) {
      toast.error('Preencha todos os campos e adicione pelo menos 1 print');
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      // Upload screenshots to storage
      const uploadedPaths: string[] = [];
      const timestamp = Date.now();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop() || 'png';
        const path = `${orgId}/${timestamp}_${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('social-selling-prints' as any)
          .upload(path, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Erro ao enviar print ${i + 1}`);
          continue;
        }
        uploadedPaths.push(path);
      }

      if (uploadedPaths.length === 0) {
        toast.error('Nenhum print foi enviado com sucesso');
        setIsUploading(false);
        return;
      }

      // Create import record
      const periodStart = new Date(`${periodDate}T${periodStartTime}:00`);
      const periodEnd = new Date(`${periodDate}T${periodEndTime}:00`);

      const { data: importRecord, error: insertErr } = await (supabase as any)
        .from('social_selling_imports')
        .insert({
          organization_id: orgId!,
          seller_id: sellerId,
          profile_id: profileId,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          screenshot_urls: uploadedPaths,
          created_by: user?.id,
        })
        .select('id')
        .single();

      if (insertErr || !importRecord) {
        toast.error('Erro ao criar registro de importação');
        setIsUploading(false);
        return;
      }

      setIsUploading(false);
      setIsProcessing(true);

      // Call edge function to process with AI
      console.log('[Import] Calling edge function with import_id:', importRecord.id);
      
      const { data: { session } } = await supabase.auth.getSession();
      const edgeResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-social-selling-print`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ import_id: importRecord.id }),
        }
      );

      const processResult = await edgeResponse.json();
      console.log('[Import] Response:', JSON.stringify({ status: edgeResponse.status, processResult }));

      if (!edgeResponse.ok || processResult?.error) {
        const errorMsg = processResult?.error || 'Erro ao processar prints';
        if (edgeResponse.status === 402) {
          toast.error('Créditos de IA insuficientes. Recarregue seus créditos no painel de Usage.');
        } else if (edgeResponse.status === 429) {
          toast.error('Limite de requisições atingido. Tente novamente em alguns minutos.');
        } else {
          toast.error(errorMsg);
        }
        setIsProcessing(false);
        return;
      }

      setResult(processResult);
      toast.success(`${processResult.leads_created} leads criados a partir de ${processResult.total_extracted} usernames`);
      queryClient.invalidateQueries({ queryKey: ['social-selling-activities'] });
      queryClient.invalidateQueries({ queryKey: ['social-selling-imports'] });
    } catch (err) {
      console.error(err);
      toast.error('Erro inesperado');
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/instagram/social-selling')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Importar Prints</h1>
            <p className="text-muted-foreground text-sm">
              Envie screenshots das DMs do Instagram para a IA extrair os @usernames
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da Prospecção</CardTitle>
            <CardDescription>Selecione quem fez, de qual perfil, e quando</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Seller */}
            <div className="space-y-2">
              <Label>Social Seller</Label>
              <Select value={sellerId} onValueChange={setSellerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Quem fez as abordagens?" />
                </SelectTrigger>
                <SelectContent>
                  {(sellers || []).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Profile */}
            <div className="space-y-2">
              <Label>Perfil do Instagram</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="De qual perfil foram enviadas?" />
                </SelectTrigger>
                <SelectContent>
                  {(igProfiles || []).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      @{p.instagram_username} {p.display_name ? `(${p.display_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={periodDate} onChange={e => setPeriodDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={periodStartTime} onChange={e => setPeriodStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={periodEndTime} onChange={e => setPeriodEndTime(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Screenshot Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-5 w-5 text-pink-500" />
              Screenshots das DMs
            </CardTitle>
            <CardDescription>
              Envie os prints das conversas. A IA vai extrair os @usernames automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload area */}
            <label className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Clique ou arraste os prints aqui</p>
                <p className="text-xs text-muted-foreground">PNG, JPG até 20MB cada</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>

            {/* Preview grid */}
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {previews.map((preview, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={preview}
                      alt={`Print ${i + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {files.length} print(s) selecionado(s)
            </p>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          disabled={!sellerId || !profileId || !periodDate || files.length === 0 || isUploading || isProcessing}
          onClick={handleSubmit}
        >
          {isUploading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando prints...</>
          ) : isProcessing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> IA processando usernames...</>
          ) : (
            <><Instagram className="h-4 w-4 mr-2" /> Processar com IA</>
          )}
        </Button>

        {/* Result */}
        {result && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="font-medium text-green-800 dark:text-green-300">
                  Processamento concluído!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-2xl font-bold">{result.usernames.length}</p>
                  <p className="text-xs text-muted-foreground">Usernames Extraídos</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{result.leads_created}</p>
                  <p className="text-xs text-muted-foreground">Novos Leads Criados</p>
                </div>
              </div>
              {result.usernames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.usernames.map(u => (
                    <Badge key={u} variant="secondary" className="text-xs">@{u}</Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => {
                  setFiles([]);
                  setPreviews([]);
                  setResult(null);
                }}>
                  Importar Mais
                </Button>
                <Button onClick={() => navigate('/instagram/social-selling')}>
                  Ver Métricas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

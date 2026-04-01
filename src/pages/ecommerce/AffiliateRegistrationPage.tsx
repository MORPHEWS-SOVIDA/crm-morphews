import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, Loader2, UserPlus } from 'lucide-react';

interface StorefrontInfo {
  id: string;
  name: string;
  logo_url: string | null;
  organization_id: string;
  external_site_url: string | null;
}

export default function AffiliateRegistrationPage() {
  const { storefrontSlug } = useParams<{ storefrontSlug: string }>();
  const [storefront, setStorefront] = useState<StorefrontInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    how_promote: '',
  });

  useEffect(() => {
    async function loadStorefront() {
      if (!storefrontSlug) return;
      const { data } = await supabase
        .from('tenant_storefronts')
        .select('id, name, logo_url, organization_id, external_site_url')
        .eq('slug', storefrontSlug)
        .eq('is_active', true)
        .maybeSingle();
      setStorefront(data as StorefrontInfo | null);
      setLoading(false);
    }
    loadStorefront();
  }, [storefrontSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storefront || !form.name || !form.email) {
      toast.error('Preencha nome e email');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-affiliate', {
        body: {
          storefrontSlug,
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          how_promote: form.how_promote || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
      toast.success(data?.message || 'Cadastro enviado! Aguarde aprovação.');
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err.message || 'Erro ao cadastrar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!storefront) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Loja não encontrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Cadastro Enviado!</h2>
            <p className="text-muted-foreground">
              Seu cadastro como afiliado(a) da <strong>{storefront.name}</strong> foi recebido.
              Você receberá um email quando seu cadastro for aprovado.
            </p>
            <p className="text-sm text-muted-foreground">
              Após a aprovação, acesse{' '}
              <a href="/login" className="text-primary underline">
                {window.location.origin}/login
              </a>{' '}
              para ver seus links e comissões.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {storefront.logo_url && (
            <img
              src={storefront.logo_url}
              alt={storefront.name}
              className="h-16 object-contain mx-auto mb-4"
            />
          )}
          <CardTitle className="text-xl">
            <UserPlus className="h-5 w-5 inline mr-2" />
            Seja Afiliado(a) - {storefront.name}
          </CardTitle>
          <CardDescription>
            Cadastre-se para divulgar produtos e ganhar comissões por cada venda realizada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="how">Como pretende divulgar?</Label>
              <Textarea
                id="how"
                value={form.how_promote}
                onChange={(e) => setForm({ ...form, how_promote: e.target.value })}
                placeholder="Instagram, TikTok, WhatsApp, blog..."
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                'Quero ser Afiliado(a)'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Após o cadastro, um administrador aprovará sua solicitação.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

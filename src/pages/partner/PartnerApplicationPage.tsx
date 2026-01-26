import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle, Users, Percent, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  usePublicLinkBySlug,
  useCreatePartnerApplication,
} from '@/hooks/ecommerce/usePartnerPublicLinks';
import { partnerTypeLabels, formatCommission } from '@/hooks/ecommerce/usePartners';

export default function PartnerApplicationPage() {
  const { slug } = useParams<{ slug: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    document: '',
  });

  const { data: link, isLoading, error } = usePublicLinkBySlug(slug);
  const createApplication = useCreatePartnerApplication();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }

    if (!link) return;

    createApplication.mutate({
      public_link_id: link.id,
      organization_id: link.organization_id,
      name: formData.name,
      email: formData.email,
      whatsapp: formData.whatsapp || undefined,
      document: formData.document || undefined,
      partner_type: link.partner_type,
      commission_type: link.commission_type,
      commission_value: link.commission_value,
      responsible_for_refunds: false, // Será definido pelo admin
      responsible_for_chargebacks: false,
    }, {
      onSuccess: () => {
        setSubmitted(true);
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              Este link de convite não existe, expirou ou atingiu o limite de cadastros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button variant="outline">Voltar ao Início</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle>Solicitação Enviada!</CardTitle>
            <CardDescription>
              Sua solicitação para se tornar parceiro(a) de <strong>{link.organization_name}</strong> foi recebida.
              Você receberá um e-mail e/ou mensagem no WhatsApp quando sua conta for aprovada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fique atento à sua caixa de entrada!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Seja Parceiro(a)</CardTitle>
          <CardDescription>
            {link.organization_name} está convidando você para ser{' '}
            <strong>{partnerTypeLabels[link.partner_type]}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Commission Info */}
          <div className="mb-6 p-4 bg-muted rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {link.commission_type === 'percentage' ? (
                <Percent className="h-5 w-5 text-green-500" />
              ) : (
                <DollarSign className="h-5 w-5 text-green-500" />
              )}
              <span className="text-2xl font-bold text-green-600">
                {formatCommission(link.commission_type, link.commission_value)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              de comissão por venda
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Seu nome"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={(e) => setFormData(p => ({ ...p, whatsapp: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document">CPF/CNPJ</Label>
              <Input
                id="document"
                value={formData.document}
                onChange={(e) => setFormData(p => ({ ...p, document: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createApplication.isPending}
            >
              {createApplication.isPending ? 'Enviando...' : 'Quero ser Parceiro(a)'}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Ao enviar, você concorda com os termos de parceria.
            Sua solicitação será analisada pela equipe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

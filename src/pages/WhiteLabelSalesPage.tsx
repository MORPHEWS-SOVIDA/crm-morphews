import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  Sparkles, 
  MessageCircle, 
  BarChart3, 
  Bot, 
  Zap,
  ArrowRight,
  Shield,
  Clock,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWhiteLabelBySlug } from '@/hooks/useWhiteLabel';

const features = [
  {
    icon: MessageCircle,
    title: 'WhatsApp Integrado',
    description: 'Conecte múltiplos números e gerencie todas as conversas em um só lugar.',
  },
  {
    icon: Bot,
    title: 'IA de Vendas',
    description: 'Robôs inteligentes que qualificam leads e agendam reuniões automaticamente.',
  },
  {
    icon: BarChart3,
    title: 'CRM Visual',
    description: 'Funil de vendas drag-and-drop para acompanhar cada oportunidade.',
  },
  {
    icon: Zap,
    title: 'Automações',
    description: 'Dispare mensagens, e-mails e tarefas de forma automática.',
  },
];

const benefits = [
  'Aumente suas vendas em até 3x',
  'Reduza o tempo de resposta para segundos',
  'Centralize todos os canais de atendimento',
  'Relatórios detalhados em tempo real',
  'Suporte técnico especializado',
  'Atualizações constantes',
];

export default function WhiteLabelSalesPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: config, isLoading, error } = useWhiteLabelBySlug(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-6 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (!config || error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-2">Página não encontrada</h2>
            <p className="text-muted-foreground mb-4">
              Esta página não existe ou foi desativada.
            </p>
            <Button onClick={() => navigate('/')}>
              Ir para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = config.primary_color || '#8B5CF6';
  const whatsappLink = config.support_whatsapp 
    ? `https://wa.me/${config.support_whatsapp.replace(/\D/g, '')}`
    : null;

  return (
    <>
      <Helmet>
        <title>{config.brand_name} - Sistema de Vendas Inteligente</title>
        <meta name="description" content={`${config.brand_name} - CRM com WhatsApp, IA e automações para aumentar suas vendas.`} />
        {config.favicon_url && <link rel="icon" href={config.favicon_url} />}
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                {config.logo_url ? (
                  <img src={config.logo_url} alt={config.brand_name} className="h-8" />
                ) : (
                  <span 
                    className="text-xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {config.brand_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Falar com consultor
                    </Button>
                  </a>
                )}
                <Link to="/login">
                  <Button variant="ghost" size="sm">Entrar</Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge 
                className="mb-6"
                style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Plataforma completa de vendas
              </Badge>
              
              <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-4xl mx-auto">
                Venda mais com{' '}
                <span style={{ color: primaryColor }}>
                  inteligência artificial
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                CRM, WhatsApp, automações e IA em uma única plataforma. 
                Simplifique sua operação e multiplique seus resultados.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to={`/planos?ref=${slug}`}>
                  <Button 
                    size="lg"
                    className="text-lg px-8"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Começar agora
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="lg" className="text-lg px-8">
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Agendar demonstração
                    </Button>
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Tudo que você precisa</h2>
              <p className="text-muted-foreground">
                Ferramentas poderosas para escalar suas vendas
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        <feature.icon className="h-6 w-6" style={{ color: primaryColor }} />
                      </div>
                      <h3 className="font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">
                  Por que escolher {config.brand_name}?
                </h2>
                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <motion.div
                      key={benefit}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-center gap-3"
                    >
                      <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
                      <span>{benefit}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card className="text-center p-6">
                  <Users className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-3xl font-bold">500+</div>
                  <div className="text-sm text-muted-foreground">Empresas ativas</div>
                </Card>
                <Card className="text-center p-6">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-3xl font-bold">2M+</div>
                  <div className="text-sm text-muted-foreground">Mensagens/mês</div>
                </Card>
                <Card className="text-center p-6">
                  <Clock className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-3xl font-bold">24/7</div>
                  <div className="text-sm text-muted-foreground">Atendimento IA</div>
                </Card>
                <Card className="text-center p-6">
                  <Shield className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-3xl font-bold">99.9%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20" style={{ backgroundColor: `${primaryColor}10` }}>
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Junte-se a centenas de empresas que já estão vendendo mais com nossa plataforma.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/planos">
                <Button 
                  size="lg"
                  className="text-lg px-8"
                  style={{ backgroundColor: primaryColor }}
                >
                  Ver planos e preços
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                {config.logo_url ? (
                  <img src={config.logo_url} alt={config.brand_name} className="h-6" />
                ) : (
                  <span className="font-bold" style={{ color: primaryColor }}>
                    {config.brand_name}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} {config.brand_name}. Todos os direitos reservados.
              </p>
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Suporte
                  </Button>
                </a>
              )}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

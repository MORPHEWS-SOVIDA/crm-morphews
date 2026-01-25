import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BarChart3, Mail, Store, ShoppingCart, CreditCard, 
  Users, Globe, Clock, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Info, ExternalLink,
  Search, BookOpen, Zap, Settings, ArrowLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface HelpSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  status: 'ready' | 'beta' | 'coming';
  articles: HelpArticle[];
}

interface HelpArticle {
  id: string;
  title: string;
  content: ArticleContent[];
}

interface ArticleContent {
  type: 'text' | 'steps' | 'tip' | 'warning' | 'code';
  content: string | string[];
}

// =============================================================================
// HELP DATA
// =============================================================================

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'tracking',
    icon: BarChart3,
    title: 'Rastreamento & Analytics',
    description: 'Configure pixels e acompanhe conversões',
    status: 'ready',
    articles: [
      {
        id: 'ga4',
        title: 'Google Analytics 4 (GA4)',
        content: [
          { type: 'text', content: 'O Google Analytics 4 permite rastrear visitantes, comportamento e conversões no seu site. Com ele você sabe de onde vêm seus clientes e o que eles fazem.' },
          { type: 'steps', content: [
            'Acesse analytics.google.com e crie uma conta',
            'Crie uma nova propriedade do tipo "Web"',
            'Copie o ID de Medição (formato: G-XXXXXXXXXX)',
            'No sistema, vá em E-commerce → aba Lojas ou Landing Pages',
            'Cole o ID no campo "Google Analytics ID"',
            'Salve e pronto! O tracking já está ativo'
          ]},
          { type: 'tip', content: 'O GA4 rastreia automaticamente: visualizações de página, cliques, scroll, tempo no site e conversões de compra.' },
          { type: 'warning', content: 'Pode levar até 24h para os dados aparecerem no painel do Google Analytics.' }
        ]
      },
      {
        id: 'gtm',
        title: 'Google Tag Manager (GTM)',
        content: [
          { type: 'text', content: 'O Tag Manager é um container que permite adicionar múltiplos scripts (Facebook, TikTok, Hotjar, etc) sem precisar editar código.' },
          { type: 'steps', content: [
            'Acesse tagmanager.google.com',
            'Crie uma conta e um container do tipo "Web"',
            'Copie o ID do container (formato: GTM-XXXXXXX)',
            'Cole no campo "GTM ID" nas configurações da loja/landing',
            'Dentro do GTM, adicione as tags que quiser (pixels, analytics, chat)',
            'Publique as alterações no GTM'
          ]},
          { type: 'tip', content: 'Use o GTM se você quer ter controle total sobre todos os scripts do seu site em um só lugar.' }
        ]
      },
      {
        id: 'facebook-pixel',
        title: 'Facebook/Meta Pixel',
        content: [
          { type: 'text', content: 'O Pixel do Facebook rastreia ações dos usuários para otimizar seus anúncios e criar públicos personalizados.' },
          { type: 'steps', content: [
            'Acesse business.facebook.com → Gerenciador de Eventos',
            'Clique em "Conectar fontes de dados" → Web → Pixel',
            'Dê um nome ao pixel e copie o ID (número de 15-16 dígitos)',
            'Cole no campo "Facebook Pixel ID" nas configurações',
            'Para a API de Conversões (CAPI), gere um token de acesso no Meta',
            'Cole o token no campo "Access Token" para tracking server-side'
          ]},
          { type: 'tip', content: 'O sistema envia automaticamente eventos: ViewContent, AddToCart, InitiateCheckout e Purchase.' },
          { type: 'warning', content: 'Sem a CAPI (Conversion API), você pode perder até 30% das conversões por causa de bloqueadores de anúncios.' }
        ]
      },
      {
        id: 'tiktok-pixel',
        title: 'TikTok Pixel',
        content: [
          { type: 'text', content: 'O Pixel do TikTok funciona igual ao do Facebook: rastreia ações para otimizar campanhas.' },
          { type: 'steps', content: [
            'Acesse ads.tiktok.com → Assets → Events',
            'Crie um novo pixel do tipo "Web"',
            'Copie o Pixel ID',
            'Cole nas configurações da sua loja/landing page',
            'Eventos de compra são enviados automaticamente'
          ]},
          { type: 'tip', content: 'Ideal para e-commerces que anunciam no TikTok Ads.' }
        ]
      }
    ]
  },
  {
    id: 'email',
    icon: Mail,
    title: 'Email Marketing Automático',
    description: 'Sequências e recuperação de carrinho',
    status: 'ready',
    articles: [
      {
        id: 'email-intro',
        title: 'Como funciona o Email Marketing',
        content: [
          { type: 'text', content: 'O sistema envia emails automaticamente baseado em gatilhos que você define. Isso inclui boas-vindas, recuperação de carrinho abandonado, pós-venda e mais.' },
          { type: 'steps', content: [
            'Vá em E-commerce → aba E-mails',
            'Crie um novo Template de email',
            'Crie uma Sequência com o gatilho desejado',
            'Adicione os passos (qual email enviar, quando)',
            'Ative a sequência'
          ]},
          { type: 'tip', content: 'Use variáveis como {{nome}}, {{produto}}, {{valor}} para personalizar cada email.' }
        ]
      },
      {
        id: 'email-cart-recovery',
        title: 'Recuperação de Carrinho Abandonado',
        content: [
          { type: 'text', content: 'Quando alguém adiciona produtos ao carrinho mas não finaliza a compra, o sistema pode enviar emails automáticos para recuperar essa venda.' },
          { type: 'steps', content: [
            'Crie uma sequência com gatilho "Carrinho Abandonado"',
            'Adicione um passo para 1 hora após o abandono',
            'Adicione outro passo para 24 horas (opcional)',
            'Use templates com urgência e benefícios',
            'Ative a sequência'
          ]},
          { type: 'tip', content: 'Taxas de recuperação de 5-15% são consideradas excelentes.' },
          { type: 'warning', content: 'Não exagere: 2-3 emails de recuperação são suficientes. Mais que isso pode irritar o cliente.' }
        ]
      },
      {
        id: 'email-templates',
        title: 'Criando Templates Efetivos',
        content: [
          { type: 'text', content: 'Um bom template de email é curto, direto e tem um CTA (chamada para ação) clara.' },
          { type: 'steps', content: [
            'Use assuntos curtos e chamativos (máx 50 caracteres)',
            'Personalize com o nome do cliente',
            'Inclua imagens do produto quando relevante',
            'Tenha apenas UM objetivo por email',
            'O botão principal deve ser grande e visível'
          ]},
          { type: 'tip', content: 'Teste diferentes assuntos para ver qual tem melhor taxa de abertura.' }
        ]
      }
    ]
  },
  {
    id: 'storefronts',
    icon: Store,
    title: 'Lojas (Storefronts)',
    description: 'Crie sua loja virtual completa',
    status: 'ready',
    articles: [
      {
        id: 'store-create',
        title: 'Criando sua Primeira Loja',
        content: [
          { type: 'text', content: 'Uma loja (storefront) é seu site de vendas completo com catálogo de produtos, carrinho e checkout.' },
          { type: 'steps', content: [
            'Vá em E-commerce → aba Lojas',
            'Clique em "Nova Loja"',
            'Escolha um template (modelo visual)',
            'Defina o slug (ex: minhaloja = suaurl.com/loja/minhaloja)',
            'Personalize cores, logo e informações',
            'Adicione seus produtos',
            'Publique!'
          ]},
          { type: 'tip', content: 'O slug é como o "endereço" da sua loja. Escolha algo curto e fácil de lembrar.' }
        ]
      },
      {
        id: 'store-products',
        title: 'Adicionando Produtos',
        content: [
          { type: 'text', content: 'Os produtos da loja vêm do seu cadastro de produtos do CRM. Você escolhe quais aparecem na loja.' },
          { type: 'steps', content: [
            'Primeiro, cadastre seus produtos em Produtos no menu lateral',
            'Na loja, clique em "Gerenciar Produtos"',
            'Marque quais produtos devem aparecer',
            'Defina se algum é "destaque"',
            'Organize as categorias',
            'Salve as alterações'
          ]},
          { type: 'tip', content: 'Produtos em destaque aparecem na página inicial da loja.' }
        ]
      },
      {
        id: 'store-categories',
        title: 'Organizando por Categorias',
        content: [
          { type: 'text', content: 'Categorias ajudam seus clientes a encontrar produtos mais facilmente.' },
          { type: 'steps', content: [
            'Na loja, vá em "Categorias"',
            'Crie categorias principais (ex: Suplementos, Vitaminas)',
            'Você pode criar subcategorias (ex: Vitaminas → Vitamina C)',
            'Arraste para reorganizar a ordem',
            'Associe produtos às categorias'
          ]},
          { type: 'tip', content: 'Limite a 5-7 categorias principais para não confundir o cliente.' }
        ]
      },
      {
        id: 'store-banners',
        title: 'Banners e Promoções',
        content: [
          { type: 'text', content: 'Banners são as imagens grandes no topo da loja, ideais para destacar promoções.' },
          { type: 'steps', content: [
            'Vá em "Banners" na configuração da loja',
            'Adicione uma imagem (tamanho recomendado: 1920x600px)',
            'Defina título e texto do botão',
            'Coloque o link de destino',
            'Ative/desative conforme necessário'
          ]},
          { type: 'tip', content: 'Troque os banners regularmente para manter a loja "fresca".' }
        ]
      }
    ]
  },
  {
    id: 'landing-pages',
    icon: Zap,
    title: 'Landing Pages VSL',
    description: 'Páginas de alta conversão',
    status: 'ready',
    articles: [
      {
        id: 'lp-intro',
        title: 'O que são Landing Pages VSL',
        content: [
          { type: 'text', content: 'Landing Pages são páginas focadas em UM único produto com o objetivo de maximizar conversões. Diferente da loja que tem vários produtos, aqui o foco é total.' },
          { type: 'steps', content: [
            'Vá em E-commerce → aba Landings',
            'Clique em "Nova Landing Page"',
            'Escolha o produto principal',
            'Configure ofertas (1 unidade, 3 unidades, 6 unidades)',
            'Adicione vídeo de vendas (VSL)',
            'Configure benefícios e depoimentos',
            'Publique'
          ]},
          { type: 'tip', content: 'Landing pages convertem 2-5x mais que lojas tradicionais para produtos específicos.' }
        ]
      },
      {
        id: 'lp-offers',
        title: 'Configurando Ofertas',
        content: [
          { type: 'text', content: 'Ofertas são as opções de compra: 1 unidade, 3 unidades (mais vendido), 6 unidades, etc.' },
          { type: 'steps', content: [
            'Cada oferta tem: quantidade, preço e desconto',
            'Marque uma como "Mais Popular" para destacar',
            'Configure frete grátis se aplicável',
            'A oferta destacada aparece maior visualmente'
          ]},
          { type: 'tip', content: 'A opção do meio geralmente vende mais. Coloque sua melhor margem ali.' }
        ]
      },
      {
        id: 'lp-urgency',
        title: 'Gatilhos de Urgência',
        content: [
          { type: 'text', content: 'Urgência e escassez aumentam conversões. O sistema tem ferramentas prontas para isso.' },
          { type: 'steps', content: [
            'Timer de contagem regressiva: define quando a oferta "expira"',
            'Contador de estoque: mostra unidades restantes',
            'Ambos podem ser configurados por landing page',
            'Use com moderação para não perder credibilidade'
          ]},
          { type: 'warning', content: 'Urgência falsa (timer que reinicia) prejudica sua reputação. Use de forma honesta.' }
        ]
      }
    ]
  },
  {
    id: 'checkout',
    icon: ShoppingCart,
    title: 'Checkout & Carrinho',
    description: 'Processo de compra otimizado',
    status: 'ready',
    articles: [
      {
        id: 'checkout-flow',
        title: 'Fluxo de Checkout',
        content: [
          { type: 'text', content: 'O checkout é onde a magia acontece: o cliente finaliza a compra. Nosso checkout é otimizado para máxima conversão.' },
          { type: 'steps', content: [
            'Cliente escolhe produto e quantidade',
            'Preenche dados pessoais (nome, email, telefone)',
            'Escolhe forma de pagamento (PIX, cartão, boleto)',
            'Confirma a compra',
            'Recebe confirmação por email e WhatsApp'
          ]},
          { type: 'tip', content: 'O checkout salva os dados do cliente automaticamente no CRM para follow-up.' }
        ]
      },
      {
        id: 'cart-recovery',
        title: 'Recuperação de Carrinho',
        content: [
          { type: 'text', content: 'Quando alguém abandona o carrinho, o sistema tenta recuperar por email E por WhatsApp.' },
          { type: 'steps', content: [
            'O carrinho é salvo automaticamente',
            'Após 1 hora: email de lembrete',
            'Após 3 horas: mensagem no WhatsApp (se habilitado)',
            'Após 24 horas: segundo email com urgência',
            'Cliente pode retomar de onde parou'
          ]},
          { type: 'tip', content: 'A recuperação por WhatsApp tem taxas de abertura 5x maiores que email.' }
        ]
      }
    ]
  },
  {
    id: 'payments',
    icon: CreditCard,
    title: 'Gateways de Pagamento',
    description: 'Pagarme, Appmax, Stripe, Asaas',
    status: 'ready',
    articles: [
      {
        id: 'gateway-intro',
        title: 'Entendendo Gateways',
        content: [
          { type: 'text', content: 'Gateway é a empresa que processa o pagamento. O sistema suporta 4 gateways e pode alternar automaticamente se um falhar.' },
          { type: 'text', content: 'Gateways disponíveis: Pagarme, Appmax, Stripe e Asaas. Cada um tem suas vantagens.' },
          { type: 'tip', content: 'Configure pelo menos 2 gateways para ter fallback automático.' }
        ]
      },
      {
        id: 'gateway-pagarme',
        title: 'Configurando Pagarme',
        content: [
          { type: 'text', content: 'Pagarme é brasileiro e ideal para quem quer receber em Real com boas taxas.' },
          { type: 'steps', content: [
            'Crie conta em pagar.me',
            'No dashboard, vá em Configurações → Chaves de API',
            'Copie a API Key e Secret Key',
            'No sistema: E-commerce → Gateways → Novo Gateway',
            'Selecione Pagarme e cole as chaves',
            'Ative e defina a prioridade'
          ]},
          { type: 'warning', content: 'Use chaves de PRODUÇÃO apenas quando for vender de verdade. Para testes, use Sandbox.' }
        ]
      },
      {
        id: 'gateway-stripe',
        title: 'Configurando Stripe',
        content: [
          { type: 'text', content: 'Stripe é internacional e ideal para vendas em dólar/euro ou clientes do exterior.' },
          { type: 'steps', content: [
            'Crie conta em stripe.com',
            'Vá em Developers → API Keys',
            'Copie a Secret Key (sk_live_...)',
            'No sistema, adicione como novo gateway',
            'Configure o webhook para receber notificações'
          ]},
          { type: 'tip', content: 'Stripe tem as melhores taxas para transações internacionais.' }
        ]
      },
      {
        id: 'gateway-fallback',
        title: 'Sistema de Fallback',
        content: [
          { type: 'text', content: 'Se o gateway principal falhar (erro, instabilidade), o sistema tenta automaticamente o próximo da fila.' },
          { type: 'steps', content: [
            'Configure múltiplos gateways',
            'Defina a ordem de prioridade (1, 2, 3...)',
            'Ative o fallback nas configurações',
            'Se o primeiro falhar, tenta o segundo, e assim por diante'
          ]},
          { type: 'tip', content: 'Com fallback ativo, você pode ter 99.9% de disponibilidade de pagamentos.' }
        ]
      }
    ]
  },
  {
    id: 'affiliates',
    icon: Users,
    title: 'Programa de Afiliados',
    description: 'Comissões e parceiros',
    status: 'ready',
    articles: [
      {
        id: 'affiliate-intro',
        title: 'Como Funciona',
        content: [
          { type: 'text', content: 'Afiliados são parceiros que divulgam seus produtos e ganham comissão por cada venda.' },
          { type: 'steps', content: [
            'Vá em E-commerce → aba Afiliados',
            'Crie um novo afiliado',
            'Defina a comissão (% ou valor fixo)',
            'O sistema gera um código único (ex: JOAO10)',
            'Afiliado usa esse código nos links de divulgação',
            'Vendas são rastreadas automaticamente'
          ]},
          { type: 'tip', content: 'Comissões de 10-20% são padrão de mercado para infoprodutos.' }
        ]
      },
      {
        id: 'affiliate-links',
        title: 'Links de Afiliado',
        content: [
          { type: 'text', content: 'O afiliado adiciona seu código no final da URL para rastrear suas vendas.' },
          { type: 'code', content: 'sualoja.com/lp/produto?ref=CODIGO_AFILIADO' },
          { type: 'text', content: 'Quando alguém compra por esse link, a comissão é creditada automaticamente.' },
          { type: 'tip', content: 'O cookie dura 30 dias: mesmo se o cliente comprar depois, o afiliado ganha.' }
        ]
      }
    ]
  },
  {
    id: 'domains',
    icon: Globe,
    title: 'Domínio Personalizado',
    description: 'Use seu próprio domínio',
    status: 'ready',
    articles: [
      {
        id: 'domain-setup',
        title: 'Configurando seu Domínio',
        content: [
          { type: 'text', content: 'Em vez de usar morphews.shop/loja/suaempresa, você pode usar seudominio.com.br.' },
          { type: 'steps', content: [
            'Compre um domínio (Registro.br, GoDaddy, Hostinger)',
            'No painel de DNS do domínio, adicione os registros:',
            'Registro A: @ → 76.76.21.21',
            'Registro CNAME: www → cname.lovable.app',
            'Aguarde propagação (até 48h)',
            'No sistema, adicione o domínio na configuração da loja'
          ]},
          { type: 'warning', content: 'Alterações de DNS podem levar até 48 horas para propagar mundialmente.' },
          { type: 'tip', content: 'Use dnschecker.org para verificar se o DNS já propagou.' }
        ]
      }
    ]
  },
  {
    id: 'pos-terminals',
    icon: CreditCard,
    title: 'Máquinas de Cartão (POS)',
    description: 'Getnet, Banrisul, Stone e mais',
    status: 'ready',
    articles: [
      {
        id: 'pos-intro',
        title: 'Como Funciona a Integração POS',
        content: [
          { type: 'text', content: 'O sistema integra com máquinas de cartão físicas para reconciliar automaticamente pagamentos de entregas e vendas presenciais. Quando o motoboy passa o cartão, o sistema recebe a notificação e vincula ao pedido.' },
          { type: 'steps', content: [
            'Cadastre suas máquinas em Configurações → Pagamentos → Máquinas POS',
            'Atribua cada máquina a um motoboy, balcão ou ponto de retirada',
            'Configure o webhook da adquirente para enviar transações ao sistema',
            'Quando a venda for paga na maquininha, o sistema vincula automaticamente'
          ]},
          { type: 'tip', content: 'O matching automático usa Valor + Motoboy Responsável. Se um motoboy está com uma máquina e faz uma venda de R$50, o sistema encontra a venda de R$50 atribuída a ele.' }
        ]
      },
      {
        id: 'pos-getnet',
        title: 'Configurando Getnet',
        content: [
          { type: 'text', content: 'A Getnet é uma das maiores adquirentes do Brasil. Veja como encontrar os dados da sua máquina.' },
          { type: 'steps', content: [
            'Acesse portal.getnet.com.br com seus dados de acesso',
            'Vá em "Meus Terminais" ou "Gestão de PDVs"',
            'Localize o Terminal ID (TID) - é um número de 8-10 dígitos',
            'O Serial da máquina está na etiqueta no fundo do equipamento',
            'Anote também o Número do Estabelecimento (EC)',
            'No sistema, vá em Configurações → Pagamentos → Máquinas POS',
            'Clique em "Adicionar Máquina" e selecione Getnet',
            'Preencha o TID, Serial e dê um nome identificador'
          ]},
          { type: 'warning', content: 'Para receber webhooks da Getnet, você precisa solicitar a habilitação do Postback via seu gerente comercial ou pelo suporte.' },
          { type: 'tip', content: 'Dica: Dê nomes claros como "Getnet Motoboy João" para identificar facilmente nos relatórios.' },
          { type: 'code', content: 'Webhook URL: https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/pos-webhook' }
        ]
      },
      {
        id: 'pos-banrisul',
        title: 'Configurando Banrisul/Vero',
        content: [
          { type: 'text', content: 'O Banrisul e a Vero são populares no sul do Brasil. A configuração é similar.' },
          { type: 'steps', content: [
            'Acesse o portal Vero (vero.com.br) ou Banricompras',
            'Entre com CNPJ e senha',
            'Vá em "Terminais" ou "Equipamentos"',
            'O TID aparece como "Número do Terminal" ou "Código do POS"',
            'O Serial está na etiqueta física da máquina (SN ou S/N)',
            'No sistema, adicione a máquina selecionando "Banrisul" ou "Vero"',
            'Preencha TID e Serial'
          ]},
          { type: 'warning', content: 'Para ativar webhooks no Banrisul/Vero, entre em contato com o suporte comercial e solicite a integração API.' },
          { type: 'tip', content: 'Se tiver máquinas de múltiplas adquirentes, cadastre todas. O sistema diferencia pelo gateway.' }
        ]
      },
      {
        id: 'pos-stone-pagarme',
        title: 'Configurando Stone / Pagar.me',
        content: [
          { type: 'text', content: 'Stone e Pagar.me fazem parte do mesmo grupo e têm portais similares.' },
          { type: 'steps', content: [
            'Acesse portal.stone.com.br ou dashboard.pagar.me',
            'Vá em "Dispositivos" ou "Terminais"',
            'Copie o Serial Number (SN) da máquina',
            'O Stone Code é o identificador do estabelecimento',
            'No sistema, adicione selecionando "Stone" ou "Pagar.me"',
            'A Stone já envia webhooks automaticamente se configurado no dashboard'
          ]},
          { type: 'tip', content: 'A Stone tem API robusta e o webhook é habilitado automaticamente no dashboard do lojista.' }
        ]
      },
      {
        id: 'pos-assignment',
        title: 'Atribuindo Máquinas',
        content: [
          { type: 'text', content: 'Cada máquina pode ser atribuída a um tipo de operação para o matching funcionar corretamente.' },
          { type: 'text', content: 'Tipos de atribuição:' },
          { type: 'steps', content: [
            'Usuário/Motoboy: A máquina está com um entregador específico. Ideal para delivery.',
            'Balcão/Caixa: Máquina fixa no ponto de venda. Usada para vendas presenciais.',
            'Retirada: Máquina usada quando o cliente retira o pedido na loja.'
          ]},
          { type: 'tip', content: 'Se a máquina for para um motoboy, selecione o usuário responsável. Assim o sistema sabe qual entrega vincular.' },
          { type: 'warning', content: 'Se a máquina não estiver atribuída corretamente, o matching automático pode falhar e a transação ficará órfã.' }
        ]
      },
      {
        id: 'pos-reports',
        title: 'Relatório de Transações POS',
        content: [
          { type: 'text', content: 'Todas as transações recebidas das maquininhas ficam em Relatórios → Transações POS.' },
          { type: 'steps', content: [
            'Vá em Relatórios → Transações POS',
            'Veja o status de cada transação: Pendente, Vinculada ou Órfã',
            'Transações órfãs podem ser vinculadas manualmente',
            'Use a busca por NSU ou código de autorização para localizar'
          ]},
          { type: 'tip', content: 'NSU é o número único da transação gerado pela adquirente. Use-o para rastrear qualquer problema.' },
          { type: 'warning', content: 'Transações órfãs indicam que o sistema não conseguiu vincular automaticamente. Verifique se a máquina está cadastrada e atribuída.' }
        ]
      },
      {
        id: 'pos-troubleshoot',
        title: 'Problemas Comuns',
        content: [
          { type: 'text', content: 'Veja as soluções para os problemas mais frequentes:' },
          { type: 'steps', content: [
            'Transação não aparece: Verifique se o webhook está configurado na adquirente',
            'Transação órfã: A máquina não está atribuída ou o valor não bate com nenhuma venda',
            'Matching errado: Duas vendas com mesmo valor - o sistema tenta o Valor+Motoboy primeiro',
            'Máquina não encontrada: Confira se o TID cadastrado bate com o da adquirente'
          ]},
          { type: 'warning', content: 'Se muitas transações ficam órfãs, revise as atribuições de máquinas e verifique se os motoboys estão usando as máquinas corretas.' }
        ]
      }
    ]
  }
];

// =============================================================================
// COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: 'ready' | 'beta' | 'coming' }) {
  const config = {
    ready: { label: 'Disponível', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    beta: { label: 'Beta', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    coming: { label: 'Em Breve', className: 'bg-muted text-muted-foreground' }
  };
  const { label, className } = config[status];
  return <Badge variant="secondary" className={className}>{label}</Badge>;
}

function ArticleRenderer({ content }: { content: ArticleContent[] }) {
  return (
    <div className="space-y-4">
      {content.map((block, idx) => {
        switch (block.type) {
          case 'text':
            return <p key={idx} className="text-muted-foreground leading-relaxed">{block.content as string}</p>;
          
          case 'steps':
            return (
              <ol key={idx} className="space-y-2 ml-4">
                {(block.content as string[]).map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            );
          
          case 'tip':
            return (
              <div key={idx} className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">{block.content as string}</p>
              </div>
            );
          
          case 'warning':
            return (
              <div key={idx} className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">{block.content as string}</p>
              </div>
            );
          
          case 'code':
            return (
              <pre key={idx} className="p-3 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
                {block.content as string}
              </pre>
            );
          
          default:
            return null;
        }
      })}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PublicHelper() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

  const toggleArticle = (articleId: string) => {
    setExpandedArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  const filteredSections = HELP_SECTIONS.filter(section => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query) ||
      section.articles.some(a => a.title.toLowerCase().includes(query))
    );
  });

  const currentSection = selectedSection 
    ? HELP_SECTIONS.find(s => s.id === selectedSection)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-semibold">Central de Ajuda</h1>
              <p className="text-xs text-muted-foreground">Morphews CRM</p>
            </div>
          </div>
          <Link 
            to="/" 
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Sistema
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-3">Como podemos ajudar?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Encontre tutoriais, guias de implementação e dicas para aproveitar ao máximo o sistema.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por funcionalidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {!selectedSection ? (
          // Grid of sections
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSections.map(section => (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className="text-left p-5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <StatusBadge status={section.status} />
                </div>
                <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                  {section.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {section.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {section.articles.length} artigos
                </p>
              </button>
            ))}
          </div>
        ) : (
          // Section detail
          <div>
            <button
              onClick={() => setSelectedSection(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar aos tópicos
            </button>

            {currentSection && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <currentSection.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{currentSection.title}</h2>
                    <p className="text-muted-foreground">{currentSection.description}</p>
                  </div>
                </div>

                <div className="space-y-3 max-w-3xl">
                  {currentSection.articles.map(article => {
                    const isExpanded = expandedArticles.has(article.id);
                    return (
                      <div key={article.id} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleArticle(article.id)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                        >
                          <span className="font-medium">{article.title}</span>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t bg-muted/20">
                            <div className="pt-4">
                              <ArticleRenderer content={article.content} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">Não encontrou o que procurava?</p>
          <a 
            href="https://wa.me/5511999999999?text=Preciso%20de%20ajuda%20com%20o%20sistema" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            Fale com nosso suporte via WhatsApp
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PageType = 'about' | 'privacy' | 'terms' | 'returns' | 'contact' | 'faq' | 'custom';

export interface StorefrontPage {
  id: string;
  storefront_id: string;
  page_type: PageType;
  title: string;
  slug: string;
  content: string | null;
  meta_title: string | null;
  meta_description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePageInput {
  storefront_id: string;
  page_type: PageType;
  title: string;
  slug: string;
  content?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  display_order?: number;
}

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  about: 'Quem Somos',
  privacy: 'Política de Privacidade',
  terms: 'Termos de Uso',
  returns: 'Trocas e Devoluções',
  contact: 'Contato',
  faq: 'FAQ',
  custom: 'Página Personalizada',
};

export const DEFAULT_PAGE_TEMPLATES: Record<PageType, { title: string; slug: string; content: string }> = {
  about: {
    title: 'Quem Somos',
    slug: 'quem-somos',
    content: `<h2>Nossa História</h2>
<p>Conte sua história aqui. Como a empresa começou? Qual é a missão?</p>

<h2>Nossa Missão</h2>
<p>Descreva o que move sua empresa e como você ajuda seus clientes.</p>

<h2>Nossos Valores</h2>
<ul>
  <li><strong>Qualidade:</strong> Compromisso com produtos de alta qualidade</li>
  <li><strong>Transparência:</strong> Honestidade em todas as interações</li>
  <li><strong>Inovação:</strong> Sempre buscando melhorar</li>
</ul>`,
  },
  privacy: {
    title: 'Política de Privacidade',
    slug: 'politica-de-privacidade',
    content: `<h2>Política de Privacidade</h2>
<p>Esta política descreve como coletamos, usamos e protegemos suas informações pessoais.</p>

<h3>Informações Coletadas</h3>
<p>Coletamos informações que você nos fornece diretamente, como nome, e-mail, telefone e endereço de entrega.</p>

<h3>Uso das Informações</h3>
<p>Utilizamos suas informações para processar pedidos, enviar atualizações e melhorar nossos serviços.</p>

<h3>Proteção de Dados</h3>
<p>Implementamos medidas de segurança para proteger suas informações pessoais.</p>

<h3>Contato</h3>
<p>Para dúvidas sobre privacidade, entre em contato conosco.</p>`,
  },
  terms: {
    title: 'Termos de Uso',
    slug: 'termos-de-uso',
    content: `<h2>Termos e Condições de Uso</h2>
<p>Ao utilizar nosso site, você concorda com estes termos.</p>

<h3>Uso do Site</h3>
<p>Este site é destinado para uso pessoal e não comercial.</p>

<h3>Propriedade Intelectual</h3>
<p>Todo o conteúdo deste site é de nossa propriedade e protegido por leis de direitos autorais.</p>

<h3>Limitação de Responsabilidade</h3>
<p>Não nos responsabilizamos por danos indiretos decorrentes do uso deste site.</p>`,
  },
  returns: {
    title: 'Trocas e Devoluções',
    slug: 'trocas-e-devolucoes',
    content: `<h2>Política de Trocas e Devoluções</h2>

<h3>Prazo para Troca ou Devolução</h3>
<p>Você tem até 7 dias corridos após o recebimento para solicitar troca ou devolução.</p>

<h3>Condições para Troca</h3>
<ul>
  <li>Produto em sua embalagem original</li>
  <li>Sem sinais de uso</li>
  <li>Nota fiscal em mãos</li>
</ul>

<h3>Como Solicitar</h3>
<p>Entre em contato conosco informando o número do pedido e o motivo da solicitação.</p>

<h3>Reembolso</h3>
<p>O reembolso será processado em até 10 dias úteis após recebermos o produto.</p>`,
  },
  contact: {
    title: 'Contato',
    slug: 'contato',
    content: `<h2>Entre em Contato</h2>

<h3>Atendimento</h3>
<p>Segunda a Sexta: 9h às 18h</p>
<p>Sábado: 9h às 13h</p>

<h3>Canais de Atendimento</h3>
<ul>
  <li><strong>WhatsApp:</strong> (XX) XXXXX-XXXX</li>
  <li><strong>E-mail:</strong> contato@suaempresa.com.br</li>
</ul>

<h3>Endereço</h3>
<p>Rua Exemplo, 123 - Bairro<br>Cidade - Estado, CEP XXXXX-XXX</p>`,
  },
  faq: {
    title: 'Perguntas Frequentes',
    slug: 'faq',
    content: `<h2>Perguntas Frequentes</h2>

<h3>Quanto tempo leva para receber meu pedido?</h3>
<p>O prazo de entrega varia de acordo com sua região. Geralmente, entre 3 a 10 dias úteis.</p>

<h3>Quais formas de pagamento vocês aceitam?</h3>
<p>Aceitamos cartão de crédito, boleto bancário e PIX.</p>

<h3>É seguro comprar no site?</h3>
<p>Sim! Utilizamos certificado SSL e gateways de pagamento seguros.</p>

<h3>Como rastrear meu pedido?</h3>
<p>Você receberá um código de rastreamento por e-mail assim que seu pedido for despachado.</p>`,
  },
  custom: {
    title: 'Nova Página',
    slug: 'nova-pagina',
    content: '<p>Conteúdo da sua página personalizada...</p>',
  },
};

export function useStorefrontPages(storefrontId: string | undefined) {
  return useQuery({
    queryKey: ['storefront-pages', storefrontId],
    enabled: !!storefrontId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_pages')
        .select('*')
        .eq('storefront_id', storefrontId)
        .order('display_order');
      
      if (error) throw error;
      return data as StorefrontPage[];
    },
  });
}

export function useStorefrontPage(id: string | undefined) {
  return useQuery({
    queryKey: ['storefront-page', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('storefront_pages')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as StorefrontPage;
    },
  });
}

export function useCreateStorefrontPage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreatePageInput) => {
      const { data, error } = await supabase
        .from('storefront_pages')
        .insert(input)
        .select()
        .single();
      
      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma página com este slug');
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', variables.storefront_id] });
      toast.success('Página criada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateStorefrontPage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId, ...input }: Partial<StorefrontPage> & { id: string; storefrontId: string }) => {
      const { data, error } = await supabase
        .from('storefront_pages')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', variables.storefrontId] });
      queryClient.invalidateQueries({ queryKey: ['storefront-page', variables.id] });
      toast.success('Página atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteStorefrontPage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, storefrontId }: { id: string; storefrontId: string }) => {
      const { error } = await supabase
        .from('storefront_pages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', variables.storefrontId] });
      toast.success('Página removida!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateDefaultPages() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (storefrontId: string) => {
      const defaultPages = (['about', 'privacy', 'terms', 'returns', 'contact', 'faq'] as PageType[])
        .map((type, index) => ({
          storefront_id: storefrontId,
          page_type: type,
          title: DEFAULT_PAGE_TEMPLATES[type].title,
          slug: DEFAULT_PAGE_TEMPLATES[type].slug,
          content: DEFAULT_PAGE_TEMPLATES[type].content,
          is_active: true,
          display_order: index,
        }));
      
      const { data, error } = await supabase
        .from('storefront_pages')
        .insert(defaultPages)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, storefrontId) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-pages', storefrontId] });
      toast.success('Páginas padrão criadas!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

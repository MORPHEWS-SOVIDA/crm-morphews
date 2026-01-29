import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * TracZAP Link Redirect Page
 * 
 * Handles /t/:slug routes:
 * 1. Looks up the link by slug
 * 2. Records the click in traczap_link_clicks
 * 3. Increments clicks_count on the link
 * 4. Redirects to WhatsApp with UTM parameters preserved
 */
export default function TracZAPRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Link inválido');
      return;
    }

    async function trackAndRedirect() {
      try {
        // 1. Find the link by slug
        const { data: link, error: linkError } = await supabase
          .from('traczap_links')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle();

        if (linkError) {
          console.error('Error fetching link:', linkError);
          setError('Erro ao buscar link');
          return;
        }

        if (!link) {
          setError('Link não encontrado ou expirado');
          return;
        }

        // 2. Record the click (fire and forget - don't block redirect)
        const clickPromise = supabase
          .from('traczap_link_clicks')
          .insert({
            link_id: link.id,
            organization_id: link.organization_id,
            user_agent: navigator.userAgent,
            referrer: document.referrer || null,
          });

        // 3. Increment click count (fire and forget)
        const incrementPromise = supabase
          .from('traczap_links')
          .update({ 
            clicks_count: (link.clicks_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', link.id);

        // Don't await - let them run in background
        Promise.all([clickPromise, incrementPromise]).catch(console.error);

        // 4. Build WhatsApp URL with tracking reference
        const phone = link.whatsapp_number.replace(/\D/g, '');
        const params = new URLSearchParams();
        
        // Add message with tracking reference
        let message = link.default_message || '';
        if (message) {
          // Append invisible tracking reference
          message = `${message}\n\n[ref:${link.slug}]`;
          params.set('text', message);
        }

        // Build final URL
        const waUrl = `https://wa.me/${phone}${params.toString() ? '?' + params.toString() : ''}`;
        
        // 5. Store UTM data in localStorage for attribution when lead is created
        const utmData = {
          utm_source: link.utm_source,
          utm_medium: link.utm_medium,
          utm_campaign: link.utm_campaign,
          utm_content: link.utm_content,
          utm_term: link.utm_term,
          traczap_link_id: link.id,
          traczap_slug: link.slug,
          tracked_at: new Date().toISOString(),
        };
        
        try {
          localStorage.setItem('traczap_attribution', JSON.stringify(utmData));
        } catch (e) {
          // localStorage might be disabled
          console.warn('Could not save attribution data:', e);
        }

        // 6. Redirect to WhatsApp
        window.location.href = waUrl;
        
      } catch (err) {
        console.error('TracZAP redirect error:', err);
        setError('Erro inesperado. Tente novamente.');
      }
    }

    trackAndRedirect();
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <div className="text-6xl">😕</div>
          <h1 className="text-xl font-semibold text-foreground">{error}</h1>
          <p className="text-muted-foreground">
            O link que você está tentando acessar não está disponível.
          </p>
          <a 
            href="/"
            className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Redirecionando para o WhatsApp...</p>
      </div>
    </div>
  );
}

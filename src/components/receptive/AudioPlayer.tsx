import { useState, useEffect } from 'react';
import { Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface AudioPlayerProps {
  storagePath: string;
  fallbackUrl?: string | null;
}

export function AudioPlayer({ storagePath, fallbackUrl }: AudioPlayerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const generateSignedUrl = async () => {
    setLoading(true);
    setError(false);
    
    try {
      // Try to generate a new signed URL from storage path
      const { data, error: signError } = await supabase.storage
        .from('receptive-recordings')
        .createSignedUrl(storagePath, 3600); // 1 hour
      
      if (signError || !data?.signedUrl) {
        console.error('Error creating signed URL:', signError);
        // Try fallback URL if available
        if (fallbackUrl) {
          setSignedUrl(fallbackUrl);
        } else {
          setError(true);
        }
      } else {
        setSignedUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Failed to get signed URL:', err);
      if (fallbackUrl) {
        setSignedUrl(fallbackUrl);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storagePath) {
      generateSignedUrl();
    } else if (fallbackUrl) {
      setSignedUrl(fallbackUrl);
      setLoading(false);
    } else {
      setLoading(false);
      setError(true);
    }
  }, [storagePath, fallbackUrl]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando áudio...
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-destructive">Erro ao carregar áudio</span>
        <Button size="sm" variant="ghost" onClick={generateSignedUrl}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <audio 
        controls 
        src={signedUrl} 
        className="flex-1 h-10"
        onError={() => {
          // If audio fails to load (expired URL), try to regenerate
          console.log('Audio error, regenerating URL...');
          generateSignedUrl();
        }}
      />
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground"
        title="Abrir em nova aba"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}

import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  erro?: boolean;
}

export interface AddressData {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  ibge?: string;
}

export function useCepLookup() {
  const [isLoading, setIsLoading] = useState(false);

  const lookupCep = async (cep: string): Promise<AddressData | null> => {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      toast({
        title: 'CEP inválido',
        description: 'O CEP deve conter 8 dígitos.',
        variant: 'destructive',
      });
      return null;
    }

    setIsLoading(true);
    
    try {
      // Try ViaCEP first with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data: ViaCepResponse = await response.json();
      
      if (data.erro) {
        toast({
          title: 'CEP não encontrado',
          description: 'Verifique o CEP informado.',
          variant: 'destructive',
        });
        return null;
      }
      
      return {
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
        ibge: data.ibge || '',
      };
    } catch (error) {
      console.error('[CEP Lookup] ViaCEP failed, trying fallback...', error);
      
      // Fallback: try BrasilAPI
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 8000);
        
        const fallbackResponse = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`, {
          signal: controller2.signal,
        });
        clearTimeout(timeoutId2);
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          return {
            street: fallbackData.street || '',
            neighborhood: fallbackData.neighborhood || '',
            city: fallbackData.city || '',
            state: fallbackData.state || '',
            ibge: fallbackData.city_ibge || '',
          };
        }
      } catch (fallbackError) {
        console.error('[CEP Lookup] BrasilAPI also failed:', fallbackError);
      }
      
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível consultar o endereço. Tente novamente ou preencha manualmente.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookupCep, isLoading };
}

import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface AddressData {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
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
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
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
      };
    } catch (error) {
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Não foi possível consultar o endereço.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookupCep, isLoading };
}

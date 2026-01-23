import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// ============================================================
// UTM TRACKING SYSTEM
// Captura e persiste parâmetros de origem de tráfego
// ============================================================

export interface UtmData {
  src?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  first_touch_url?: string;
  first_touch_referrer?: string;
  first_touch_at?: string;
}

const UTM_STORAGE_KEY = 'morphews_utm_data';
const UTM_PARAMS = [
  'src',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ttclid',
];

interface UtmContextValue {
  utmData: UtmData;
  hasUtmData: boolean;
  clearUtmData: () => void;
  getUtmForCheckout: () => UtmData;
}

const UtmContext = createContext<UtmContextValue | null>(null);

/**
 * Extrai parâmetros UTM da URL atual
 */
function extractUtmFromUrl(): Partial<UtmData> {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const utmData: Partial<UtmData> = {};
  
  UTM_PARAMS.forEach((param) => {
    const value = params.get(param);
    if (value) {
      utmData[param as keyof UtmData] = value;
    }
  });
  
  return utmData;
}

/**
 * Carrega UTM data do localStorage
 */
function loadStoredUtmData(): UtmData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as UtmData;
    }
  } catch (e) {
    console.error('Error loading UTM data:', e);
  }
  
  return null;
}

/**
 * Salva UTM data no localStorage
 */
function saveUtmData(data: UtmData): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving UTM data:', e);
  }
}

/**
 * Provider para tracking de UTM em toda a aplicação
 */
export function UtmProvider({ children }: { children: ReactNode }) {
  const [utmData, setUtmData] = useState<UtmData>({});
  
  useEffect(() => {
    // 1. Carregar dados existentes
    const storedData = loadStoredUtmData();
    
    // 2. Extrair novos parâmetros da URL
    const urlParams = extractUtmFromUrl();
    const hasNewParams = Object.keys(urlParams).length > 0;
    
    // 3. Se temos novos parâmetros, eles sobrescrevem os antigos (last-touch)
    // Para first-touch, só salvamos se não existir dados anteriores
    if (hasNewParams) {
      const newData: UtmData = {
        ...urlParams,
        first_touch_url: window.location.href,
        first_touch_referrer: document.referrer || undefined,
        first_touch_at: new Date().toISOString(),
      };
      
      // Se já tinha dados, preservamos o first_touch original
      if (storedData?.first_touch_at) {
        newData.first_touch_url = storedData.first_touch_url;
        newData.first_touch_referrer = storedData.first_touch_referrer;
        newData.first_touch_at = storedData.first_touch_at;
      }
      
      saveUtmData(newData);
      setUtmData(newData);
    } else if (storedData) {
      // Sem novos parâmetros, usa os armazenados
      setUtmData(storedData);
    }
  }, []);
  
  const hasUtmData = Object.keys(utmData).some(
    (key) => UTM_PARAMS.includes(key) && utmData[key as keyof UtmData]
  );
  
  const clearUtmData = () => {
    localStorage.removeItem(UTM_STORAGE_KEY);
    setUtmData({});
  };
  
  const getUtmForCheckout = (): UtmData => {
    return { ...utmData };
  };
  
  return (
    <UtmContext.Provider value={{ utmData, hasUtmData, clearUtmData, getUtmForCheckout }}>
      {children}
    </UtmContext.Provider>
  );
}

/**
 * Hook para acessar dados UTM
 */
export function useUtmTracker() {
  const context = useContext(UtmContext);
  
  if (!context) {
    // Fallback se não estiver dentro do provider
    return {
      utmData: extractUtmFromUrl(),
      hasUtmData: false,
      clearUtmData: () => {},
      getUtmForCheckout: () => extractUtmFromUrl(),
    };
  }
  
  return context;
}

/**
 * Adiciona parâmetros UTM a uma URL
 */
export function appendUtmToUrl(baseUrl: string, utmData: UtmData): string {
  try {
    const url = new URL(baseUrl);
    
    UTM_PARAMS.forEach((param) => {
      const value = utmData[param as keyof UtmData];
      if (value) {
        url.searchParams.set(param, value);
      }
    });
    
    return url.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Gera string de query params a partir de UTM data
 */
export function utmToQueryString(utmData: UtmData): string {
  const params = new URLSearchParams();
  
  UTM_PARAMS.forEach((param) => {
    const value = utmData[param as keyof UtmData];
    if (value) {
      params.set(param, value);
    }
  });
  
  const str = params.toString();
  return str ? `?${str}` : '';
}

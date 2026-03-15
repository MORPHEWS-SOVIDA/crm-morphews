import { supabase } from "@/integrations/supabase/client";

/**
 * Invoca uma Edge Function e extrai o erro real da resposta.
 * 
 * O SDK do Supabase mascara mensagens de erro quando a função retorna status não-2xx,
 * exibindo apenas "Edge Function returned a non-2xx status code".
 * 
 * Esta função garante que o erro real seja sempre propagado, seja ele:
 * - Um erro no campo `error` do JSON de resposta
 * - Um erro do SDK do Supabase
 * - Um erro de rede
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  options?: {
    body?: Record<string, any>;
    headers?: Record<string, string>;
  }
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: options?.body,
      headers: options?.headers,
    });

    // SDK error (usually means non-2xx status)
    if (error) {
      // Try to extract a more specific message
      const msg = error.message || error.toString();
      
      // If it's the generic SDK error, try to get details from context
      if (msg.includes("non-2xx") || msg.includes("Edge Function")) {
        return { 
          data: null, 
          error: `Erro na função ${functionName}. Verifique os logs para mais detalhes.` 
        };
      }
      
      return { data: null, error: msg };
    }

    // Check if the response itself contains an error field
    if (data && typeof data === "object" && "error" in data && data.error) {
      return { data: null, error: data.error as string };
    }

    return { data: data as T, error: null };
  } catch (err: any) {
    return { 
      data: null, 
      error: err?.message || "Erro de conexão ao chamar o servidor" 
    };
  }
}

/**
 * Extrai uma mensagem de erro legível de qualquer tipo de erro.
 * Útil para exibir em toasts e alertas.
 */
export function getReadableError(error: unknown): string {
  if (!error) return "Erro desconhecido";
  
  if (typeof error === "string") return error;
  
  if (error instanceof Error) {
    const msg = error.message;
    
    // Traduz erros comuns do Supabase
    if (msg.includes("JWT expired")) return "Sua sessão expirou. Faça login novamente.";
    if (msg.includes("not authenticated")) return "Você precisa estar logado para realizar esta ação.";
    if (msg.includes("permission denied")) return "Você não tem permissão para realizar esta ação.";
    if (msg.includes("row-level security")) return "Sem permissão para acessar estes dados. Verifique se está logado.";
    if (msg.includes("duplicate key")) return "Este registro já existe.";
    if (msg.includes("violates foreign key")) return "Este registro está vinculado a outros dados e não pode ser alterado.";
    if (msg.includes("violates not-null")) return "Um campo obrigatório não foi preenchido.";
    if (msg.includes("non-2xx")) return "Erro no servidor. Tente novamente ou contate o suporte.";
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) return "Erro de conexão. Verifique sua internet.";
    if (msg.includes("timeout")) return "A operação demorou demais. Tente novamente.";
    
    return msg;
  }
  
  if (typeof error === "object" && error !== null) {
    const obj = error as any;
    if (obj.message) return obj.message;
    if (obj.error) return typeof obj.error === "string" ? obj.error : JSON.stringify(obj.error);
    if (obj.msg) return obj.msg;
  }
  
  return "Erro desconhecido";
}

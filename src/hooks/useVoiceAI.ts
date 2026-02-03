import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceAIAgent {
  id: string;
  name: string;
  voiceId: string;
  firstMessage?: string;
  language?: string;
}

interface CallResult {
  callId: string;
  token: string;
  agent: VoiceAIAgent;
}

interface UseVoiceAIOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
}

export function useVoiceAI(options: UseVoiceAIOptions = {}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  const initiateCall = useCallback(async (params: {
    organizationId: string;
    leadId?: string;
    phoneNumber: string;
    contactName?: string;
    agentId: string;
    callType: "inbound" | "outbound";
    callPurpose?: string;
  }): Promise<CallResult | null> => {
    setIsConnecting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("voice-ai-call", {
        body: params,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to initiate call");
      }

      setCurrentCallId(data.callId);
      setIsConnected(true);
      options.onConnect?.();

      return {
        callId: data.callId,
        token: data.token,
        agent: data.agent,
      };
    } catch (error) {
      console.error("Error initiating voice call:", error);
      const err = error instanceof Error ? error : new Error("Unknown error");
      options.onError?.(err);
      toast.error("Erro ao iniciar ligação: " + err.message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [options]);

  const endCall = useCallback(async (params: {
    transcript?: string;
    summary?: string;
    sentiment?: "positive" | "neutral" | "negative" | "mixed";
    outcome?: string;
    outcomeNotes?: string;
    nextAction?: string;
    nextActionDate?: string;
    durationSeconds?: number;
  } = {}) => {
    if (!currentCallId) {
      console.warn("No active call to end");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("voice-ai-call-end", {
        body: {
          callId: currentCallId,
          transcript: params.transcript || transcript,
          ...params,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setIsConnected(false);
      setCurrentCallId(null);
      setTranscript("");
      options.onDisconnect?.();

      return data.call;
    } catch (error) {
      console.error("Error ending call:", error);
      const err = error instanceof Error ? error : new Error("Unknown error");
      options.onError?.(err);
      toast.error("Erro ao finalizar ligação: " + err.message);
    }
  }, [currentCallId, transcript, options]);

  const getConversationToken = useCallback(async (agentId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token", {
        body: { agentId },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.token;
    } catch (error) {
      console.error("Error getting conversation token:", error);
      toast.error("Erro ao obter token de conversação");
      return null;
    }
  }, []);

  const getScribeToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token", {
        body: {},
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.token;
    } catch (error) {
      console.error("Error getting scribe token:", error);
      toast.error("Erro ao obter token de transcrição");
      return null;
    }
  }, []);

  const appendTranscript = useCallback((text: string) => {
    setTranscript(prev => prev + " " + text);
  }, []);

  return {
    isConnecting,
    isConnected,
    currentCallId,
    transcript,
    initiateCall,
    endCall,
    getConversationToken,
    getScribeToken,
    appendTranscript,
    setTranscript,
  };
}

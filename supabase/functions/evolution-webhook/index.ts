import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const RAW_EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_URL = RAW_EVOLUTION_API_URL.startsWith("http") ? RAW_EVOLUTION_API_URL.replace(/\/$/, "") : `https://${RAW_EVOLUTION_API_URL.replace(/\/$/, "")}`;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const WHATSAPP_MEDIA_TOKEN_SECRET =
  Deno.env.get("WHATSAPP_MEDIA_TOKEN_SECRET") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// NPS RATING EXTRACTION
// ============================================================================

const TEXT_TO_NUMBER: Record<string, number> = {
  zero: 0,
  um: 1,
  dois: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

function extractNPSRatingDirect(text: string): number | null {
  const cleaned = text.toLowerCase().trim();

  // Only accept short responses (up to ~50 chars) that look like ratings
  if (cleaned.length > 50) {
    const ratingPhrases = [
      /(?:minha\s+)?nota\s*(?:é|:)?\s*(10|[0-9])/i,
      /(?:dou|daria)\s*(?:nota\s*)?(10|[0-9])/i,
      /^(10|[0-9])\s*(?:pontos?)?$/i,
      /aval(?:io|iação)\s*(?:com)?\s*(10|[0-9])/i,
    ];

    for (const pattern of ratingPhrases) {
      const match = cleaned.match(pattern);
      if (match) return parseInt(match[1]);
    }
    return null;
  }

  // Direct number match (just "10" or "8")
  const directMatch = cleaned.match(/^(10|[0-9])$/);
  if (directMatch) return parseInt(directMatch[1]);

  // Number with simple context like "nota 10", "10 pontos", etc.
  const simpleContextMatch = cleaned.match(
    /^(?:nota\s*)?(10|[0-9])(?:\s*(?:pontos?|!|\.)?)?$/i,
  );
  if (simpleContextMatch) return parseInt(simpleContextMatch[1]);

  // Phrases like "dou nota 8", "minha nota é 10"
  const phraseMatch = cleaned.match(
    /(?:minha\s+)?nota\s*(?:é|:)?\s*(10|[0-9])|(?:dou|daria)\s*(?:nota\s*)?(10|[0-9])/i,
  );
  if (phraseMatch) return parseInt(phraseMatch[1] || phraseMatch[2]);

  // Text to number (only for short responses)
  for (const [word, num] of Object.entries(TEXT_TO_NUMBER)) {
    if (cleaned === word || cleaned.match(new RegExp(`^${word}[!.]*$`))) {
      return num;
    }
  }

  return null;
}

// ============================================================================
// AI-POWERED NPS CLASSIFICATION (usando Groq API)
// ============================================================================

async function classifyNPSWithAI(
  text: string,
): Promise<
  { rating: number | null; confidence: string; reasoning: string | null }
> {
  if (!GROQ_API_KEY) {
    console.log("⚠️ GROQ_API_KEY not configured, skipping AI classification");
    return { rating: null, confidence: "none", reasoning: null };
  }

  try {
    const prompt =
      `Você é um classificador de NPS (Net Promoter Score). Analise a resposta do cliente e extraia uma nota de 0 a 10.

REGRAS DE CLASSIFICAÇÃO:
- Se a pessoa mencionar um número de 0 a 10, use esse número
- Se a resposta for POSITIVA (satisfeito, ótimo, excelente, amei, perfeito, parabéns, muito bom, recomendo): nota 9 ou 10
- Se a resposta for NEUTRA (ok, tudo bem, normal, regular, razoável): nota 7 ou 8  
- Se a resposta for NEGATIVA (ruim, péssimo, horrível, não gostei, insatisfeito, problema): nota 1 a 4
- Se a resposta NÃO tem relação com avaliação de satisfação (ex: "bom dia", perguntas sobre pedido, agradecimentos genéricos): retorne null
- Se não conseguir classificar com confiança: retorne null

IMPORTANTE: Responda APENAS em JSON válido, sem markdown.

Resposta do cliente: "${text.substring(0, 500)}"

Responda no formato JSON:
{"rating": <numero_0_a_10_ou_null>, "confidence": "<alta|media|baixa>", "reason": "<breve explicação da classificação>"}`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150,
          temperature: 0.1,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Groq API error:", response.status, errorText);
      return { rating: null, confidence: "error", reasoning: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    console.log("🤖 AI NPS classification response:", content);

    // Tentar extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const rating = parsed.rating;
        const confidence = parsed.confidence || "media";
        const reasoning = parsed.reason || null;

        // Validar que rating está entre 0 e 10 ou é null
        if (
          rating === null ||
          (typeof rating === "number" && rating >= 0 && rating <= 10)
        ) {
          console.log(
            `🤖 AI classified NPS: ${rating} (confidence: ${confidence}, reason: ${reasoning})`,
          );
          return { rating, confidence, reasoning };
        }
      } catch (e) {
        console.error("❌ Failed to parse AI JSON response:", e);
      }
    }

    return { rating: null, confidence: "error", reasoning: null };
  } catch (error) {
    console.error("❌ Error calling Groq API for NPS classification:", error);
    return { rating: null, confidence: "error", reasoning: null };
  }
}

// Função principal que combina extração direta + IA
async function extractNPSRating(text: string): Promise<{
  rating: number | null;
  source: "regex" | "ai" | "none";
  reasoning: string | null;
}> {
  // Primeiro tenta extração direta (rápido)
  const directRating = extractNPSRatingDirect(text);
  if (directRating !== null) {
    return {
      rating: directRating,
      source: "regex",
      reasoning: `Número ${directRating} identificado diretamente na mensagem`,
    };
  }

  // Se não encontrou número direto e o texto é muito curto, pode ser lixo
  if (text.trim().length < 3) {
    return { rating: null, source: "none", reasoning: null };
  }

  // Filtrar mensagens que são apenas pontuação, símbolos, emojis ou caracteres repetidos
  // Exemplos: "????", "...", "!!!", "???", emojis soltos
  const cleanedForFilter = text.trim().replace(/[\s]/g, "");
  const nonAlphaRatio =
    (cleanedForFilter.replace(/[a-záàâãéèêíïóôõöúçñ0-9]/gi, "").length) /
    cleanedForFilter.length;
  if (nonAlphaRatio >= 0.8 && cleanedForFilter.length < 20) {
    console.log(
      `📊 NPS skipped - message is mostly punctuation/symbols: "${
        text.substring(0, 30)
      }"`,
    );
    return {
      rating: null,
      source: "none",
      reasoning: "Mensagem contém apenas pontuação ou símbolos",
    };
  }

  // Usa IA para classificar respostas textuais
  const aiResult = await classifyNPSWithAI(text);
  if (aiResult.rating !== null && aiResult.confidence !== "error") {
    return {
      rating: aiResult.rating,
      source: "ai",
      reasoning: aiResult.reasoning,
    };
  }

  return { rating: null, source: "none", reasoning: null };
}

// Normaliza telefone: suporta brasileiros (55 + DD + 9) e internacionais
function normalizeWhatsApp(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (!clean) return "";

  // Números internacionais: se não começa com 55 e tem >= 10 dígitos,
  // preservar como está (já tem código de país próprio, ex: 57 Colômbia, 1 EUA, 44 UK)
  if (!clean.startsWith("55") && clean.length >= 10) {
    return clean;
  }

  // Número brasileiro: garantir prefixo 55
  if (!clean.startsWith("55")) clean = `55${clean}`;
  // Se tem 12 dígitos (55 + DD + 8), adiciona o 9 (celular)
  if (clean.length === 12 && clean.startsWith("55")) {
    clean = clean.slice(0, 4) + "9" + clean.slice(4);
  }
  return clean;
}

// Gera variações de um telefone brasileiro (com e sem o 9)
// Útil para buscar conversas onde o número pode ter sido salvo de forma diferente
function getBrazilPhoneVariations(phone: string): string[] {
  const normalized = normalizeWhatsApp(phone);
  if (!normalized) return [];

  const variations: string[] = [normalized];

  // Se tem 13 dígitos (55 + DD + 9 + 8), criar versão sem o 9
  if (normalized.length === 13 && normalized.startsWith("55")) {
    const without9 = normalized.slice(0, 4) + normalized.slice(5);
    variations.push(without9);
  }

  return variations;
}

// ============================================================================
// FETCH PROFILE PICTURE FROM EVOLUTION API
// ============================================================================

async function fetchProfilePictureFromEvolution(
  instanceName: string,
  phoneNumber: string,
): Promise<string | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.log("⚠️ Evolution API not configured for profile picture fetch");
    return null;
  }

  try {
    const url =
      `${EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/${instanceName}`;
    console.log("📸 Fetching profile picture for", phoneNumber, "from", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phoneNumber }),
    });

    if (!response.ok) {
      console.log("📸 Profile picture fetch failed:", response.status);
      return null;
    }

    const data = await response.json();
    const profilePicUrl = data?.profilePictureUrl || data?.profilePicUrl ||
      null;

    if (profilePicUrl) {
      console.log(
        "📸 Profile picture found:",
        profilePicUrl.substring(0, 60) + "...",
      );
    } else {
      console.log("📸 No profile picture available for this contact");
    }

    return profilePicUrl;
  } catch (error) {
    console.error("📸 Error fetching profile picture:", error);
    return null;
  }
}

// ============================================================================
// HMAC TOKEN GENERATION (for secure media proxy URLs)
// ============================================================================

async function createHmacSignature(
  data: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateMediaProxyUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60 * 24 * 365, // 1 year
  contentType?: string,
): Promise<string> {
  if (!WHATSAPP_MEDIA_TOKEN_SECRET) {
    throw new Error("WHATSAPP_MEDIA_TOKEN_SECRET não configurado");
  }

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const ct = contentType?.trim() || "";
  const dataToSign = ct
    ? `${storagePath}:${exp}:${ct}`
    : `${storagePath}:${exp}`;
  const token = await createHmacSignature(
    dataToSign,
    WHATSAPP_MEDIA_TOKEN_SECRET,
  );

  const supabaseBase = SUPABASE_URL.replace(/\/$/, "");
  const proxyBaseUrl = `${supabaseBase}/functions/v1/whatsapp-media-proxy`;
  const ctParam = ct ? `&ct=${encodeURIComponent(ct)}` : "";

  return `${proxyBaseUrl}?path=${
    encodeURIComponent(storagePath)
  }&exp=${exp}&token=${token}${ctParam}`;
}

// ============================================================================
// MESSAGE TYPE DETECTION
// ============================================================================

function detectMessageType(message: any): {
  type: string;
  content: string;
  mediaUrl: string | null;
  mediaCaption: string | null;
  mediaMimeType: string | null;
  hasEncryptedMedia: boolean;
} {
  // Texto simples
  if (message?.conversation) {
    return {
      type: "text",
      content: message.conversation,
      mediaUrl: null,
      mediaCaption: null,
      mediaMimeType: null,
      hasEncryptedMedia: false,
    };
  }

  // Texto estendido
  if (message?.extendedTextMessage?.text) {
    return {
      type: "text",
      content: message.extendedTextMessage.text,
      mediaUrl: null,
      mediaCaption: null,
      mediaMimeType: null,
      hasEncryptedMedia: false,
    };
  }

  // Imagem
  if (message?.imageMessage) {
    const img = message.imageMessage;
    const base64 = img.base64 || null;
    const caption = img.caption || "";
    const mimeType = img.mimetype || "image/jpeg";
    // Se tem base64 já no payload, usa direto; senão marca para buscar
    const hasEncrypted = !base64 && (img.url || img.directPath);

    return {
      type: "image",
      content: caption,
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: caption,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted,
    };
  }

  // Áudio
  if (message?.audioMessage) {
    const audio = message.audioMessage;
    const base64 = audio.base64 || null;
    const mimeType = audio.mimetype || "audio/ogg";
    const hasEncrypted = !base64 && (audio.url || audio.directPath);

    return {
      type: "audio",
      content: "",
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: null,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted,
    };
  }

  // Vídeo
  if (message?.videoMessage) {
    const video = message.videoMessage;
    const base64 = video.base64 || null;
    const caption = video.caption || "";
    const mimeType = video.mimetype || "video/mp4";
    const hasEncrypted = !base64 && (video.url || video.directPath);

    return {
      type: "video",
      content: caption,
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: caption,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted,
    };
  }

  // Documento
  if (message?.documentMessage) {
    const doc = message.documentMessage;
    const base64 = doc.base64 || null;
    const caption = doc.caption || doc.fileName || "";
    const mimeType = doc.mimetype || "application/octet-stream";
    const hasEncrypted = !base64 && (doc.url || doc.directPath);

    return {
      type: "document",
      content: caption,
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: caption,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted,
    };
  }

  // Sticker
  if (message?.stickerMessage) {
    const sticker = message.stickerMessage;
    const base64 = sticker.base64 || null;
    const mimeType = sticker.mimetype || "image/webp";
    const hasEncrypted = !base64 && (sticker.url || sticker.directPath);

    return {
      type: "sticker",
      content: "",
      mediaUrl: base64 ? `data:${mimeType};base64,${base64}` : null,
      mediaCaption: null,
      mediaMimeType: mimeType,
      hasEncryptedMedia: hasEncrypted,
    };
  }

  // Localização
  if (message?.locationMessage) {
    const loc = message.locationMessage;
    const coords = `${loc.degreesLatitude},${loc.degreesLongitude}`;
    const content = loc.name
      ? `📍 ${loc.name}\n${coords}`
      : `📍 Localização: ${coords}`;

    return {
      type: "location",
      content,
      mediaUrl: null,
      mediaCaption: null,
      mediaMimeType: null,
      hasEncryptedMedia: false,
    };
  }

  // Contato
  if (message?.contactMessage) {
    const contact = message.contactMessage;
    const content = `👤 Contato: ${contact.displayName || "Sem nome"}`;

    return {
      type: "contact",
      content,
      mediaUrl: null,
      mediaCaption: null,
      mediaMimeType: null,
      hasEncryptedMedia: false,
    };
  }

  // Reação
  if (message?.reactionMessage) {
    return {
      type: "reaction",
      content: message.reactionMessage.text || "👍",
      mediaUrl: null,
      mediaCaption: null,
      mediaMimeType: null,
      hasEncryptedMedia: false,
    };
  }

  // Fallback
  return {
    type: "text",
    content: "[Mensagem não suportada]",
    mediaUrl: null,
    mediaCaption: null,
    mediaMimeType: null,
    hasEncryptedMedia: false,
  };
}

// ============================================================================
// DOWNLOAD MEDIA FROM EVOLUTION API (getBase64FromMediaMessage)
// ============================================================================

async function downloadMediaFromEvolution(
  instanceName: string,
  messageKey: { id: string; remoteJid?: string; fromMe?: boolean },
  convertToMp4: boolean = false,
): Promise<{ base64: string; mimeType: string } | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error("❌ Evolution API credentials not configured");
    return null;
  }

  try {
    const endpoint =
      `${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceName}`;

    console.log("📥 Fetching media from Evolution:", {
      instance: instanceName,
      messageId: messageKey.id,
      endpoint: endpoint.substring(0, 60) + "...",
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        message: {
          key: messageKey,
        },
        convertToMp4: convertToMp4,
      }),
    });

    if (!response.ok) {
      console.error(
        "❌ Evolution getBase64 failed:",
        response.status,
        await response.text().catch(() => ""),
      );
      return null;
    }

    const result = await response.json();

    console.log(
      "📥 Evolution getBase64 response keys:",
      Object.keys(result || {}),
    );

    // Evolution API pode retornar base64 como string ou no campo buffer
    // Também pode retornar base64 com prefixo data: ou sem
    let base64Data = (result?.base64 && result.base64.length > 0)
      ? result.base64
      : null;

    // DEBUG: Log raw buffer info before processing
    console.log("📥 RAW buffer debug:", {
      hasBuffer: !!result?.buffer,
      bufferType: typeof result?.buffer,
      bufferTruthy: result?.buffer ? true : false,
      bufferStringified: JSON.stringify(result?.buffer)?.substring(0, 300),
      base64Type: typeof result?.base64,
      base64Length: result?.base64?.length ?? 0,
    });

    // Se base64 veio vazio mas tem buffer, usar o buffer
    if (!base64Data && result?.buffer) {
      const bufType = typeof result.buffer;
      const bufIsArray = Array.isArray(result.buffer);
      const bufHasData = !!result.buffer?.data;
      const bufDataIsArray = Array.isArray(result.buffer?.data);
      const bufKeys =
        typeof result.buffer === "object" && result.buffer !== null
          ? Object.keys(result.buffer).slice(0, 15)
          : [];
      const bufDataKeys =
        bufHasData && typeof result.buffer.data === "object" && !bufDataIsArray
          ? Object.keys(result.buffer.data).slice(0, 15)
          : [];

      console.log("📥 Buffer analysis:", {
        type: bufType,
        isArray: bufIsArray,
        hasData: bufHasData,
        dataIsArray: bufDataIsArray,
        keys: bufKeys,
        dataKeys: bufDataKeys,
        bufferDataType: bufHasData ? typeof result.buffer.data : "N/A",
      });

      if (typeof result.buffer === "string" && result.buffer.length > 0) {
        base64Data = result.buffer;
      } else if (result.buffer?.data && Array.isArray(result.buffer.data)) {
        // Buffer como { type: 'Buffer', data: [bytes...] }
        const uint8 = new Uint8Array(result.buffer.data);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        base64Data = btoa(binary);
        console.log(
          "📥 Converted buffer.data array, size:",
          result.buffer.data.length,
        );
      } else if (
        result.buffer?.data && typeof result.buffer.data === "object"
      ) {
        // Buffer como { type: 'Buffer', data: { 0: byte, 1: byte, ... } }
        try {
          const dataKeys = Object.keys(result.buffer.data).filter((k) =>
            !isNaN(Number(k))
          ).sort((a, b) => Number(a) - Number(b));
          if (dataKeys.length > 0) {
            const arr = new Uint8Array(dataKeys.length);
            for (let i = 0; i < dataKeys.length; i++) {
              arr[i] = result.buffer.data[dataKeys[i]];
            }
            let binary = "";
            for (let i = 0; i < arr.length; i++) {
              binary += String.fromCharCode(arr[i]);
            }
            base64Data = btoa(binary);
            console.log(
              "📥 Converted buffer.data object with numeric keys, size:",
              dataKeys.length,
            );
          }
        } catch (bufErr) {
          console.error("📥 Error converting buffer.data object:", bufErr);
        }
      } else if (Array.isArray(result.buffer)) {
        // Buffer como array direto [bytes...]
        const uint8 = new Uint8Array(result.buffer);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        base64Data = btoa(binary);
        console.log(
          "📥 Converted direct buffer array, size:",
          result.buffer.length,
        );
      } else if (typeof result.buffer === "object" && result.buffer !== null) {
        // Buffer como objeto com propriedades numéricas (Uint8Array-like)
        try {
          const keys = Object.keys(result.buffer).filter((k) =>
            !isNaN(Number(k))
          ).sort((a, b) => Number(a) - Number(b));
          if (keys.length > 0) {
            const arr = new Uint8Array(keys.length);
            for (let i = 0; i < keys.length; i++) {
              arr[i] = result.buffer[keys[i]];
            }
            let binary = "";
            for (let i = 0; i < arr.length; i++) {
              binary += String.fromCharCode(arr[i]);
            }
            base64Data = btoa(binary);
            console.log(
              "📥 Converted buffer object with numeric keys, size:",
              keys.length,
            );
          } else {
            console.log("📥 Buffer object has no numeric keys, keys:", bufKeys);
          }
        } catch (bufErr) {
          console.error("📥 Error converting buffer object:", bufErr);
        }
      }
    }

    // Garantir que base64 tem o prefixo data: correto
    if (base64Data && !base64Data.startsWith("data:")) {
      const mime = result.mimetype || result.mimeType ||
        "application/octet-stream";
      base64Data = `data:${mime};base64,${base64Data}`;
    }

    if (base64Data) {
      const mime = result.mimetype || result.mimeType ||
        "application/octet-stream";
      console.log("✅ Media downloaded from Evolution:", {
        hasBase64: true,
        mimeType: mime,
        size: base64Data.length,
      });
      return {
        base64: base64Data,
        mimeType: mime,
      };
    }

    console.log("⚠️ Evolution returned no usable base64/buffer:", {
      keys: Object.keys(result || {}),
      base64Type: typeof result?.base64,
      base64Length: result?.base64?.length ?? 0,
      bufferType: typeof result?.buffer,
    });
    return null;
  } catch (error) {
    console.error("❌ Error downloading media from Evolution:", error);
    return null;
  }
}

// ============================================================================
// SAVE MEDIA TO STORAGE
// ============================================================================

function extFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp3") || mime.includes("mpeg")) return "mp3";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("m4a")) return "m4a";
  if (mime.includes("webm")) return "webm";
  return "bin";
}

// Limpa o content-type removendo parâmetros como "; codecs=opus"
function cleanContentType(mime: string): string {
  const baseMime = mime.split(";")[0].trim();
  // Normalizar audio/ogg para ser compatível com browsers
  if (baseMime === "audio/ogg") return "audio/ogg";
  return baseMime;
}

async function saveMediaToStorage(
  organizationId: string,
  instanceId: string,
  conversationId: string,
  base64Data: string,
  mimeType: string,
): Promise<string | null> {
  try {
    // Remove data URL prefix if present
    const base64Clean = base64Data.includes(",")
      ? base64Data.split(",")[1]
      : base64Data;

    const bytes = Uint8Array.from(atob(base64Clean), (c) => c.charCodeAt(0));
    const ext = extFromMime(mimeType);
    const timestamp = Date.now();
    const random = crypto.randomUUID().split("-")[0];
    const storagePath =
      `orgs/${organizationId}/instances/${instanceId}/${conversationId}/${timestamp}_${random}.${ext}`;

    // Limpar o mimeType para evitar problemas com "; codecs=opus"
    const cleanMimeType = cleanContentType(mimeType);

    console.log("📤 Saving inbound media to storage:", {
      storagePath,
      size: bytes.length,
      mimeType: cleanMimeType,
    });

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, bytes, {
        contentType: cleanMimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("❌ Media upload failed:", uploadError);
      return null;
    }

    // Generate proxy URL (more secure than signed URL) - usar o mimeType limpo
    const proxyUrl = await generateMediaProxyUrl(
      storagePath,
      60 * 60 * 24 * 365,
      cleanMimeType,
    );
    console.log("✅ Media saved:", proxyUrl.substring(0, 80) + "...");
    return proxyUrl;
  } catch (error) {
    console.error("❌ Error saving media:", error);
    return null;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Evolution envia o nome da instância no payload
    const instanceName = body?.instance || body?.instanceName || "";
    const event = body?.event || "";

    // =====================
    // EARLY FILTER: Rejeitar eventos desnecessários IMEDIATAMENTE
    // Economia: ~15% das invocações (status updates, typing, presence, etc.)
    // =====================
    const ALLOWED_EVENTS = new Set([
      "messages.upsert",
      "MESSAGES_UPSERT",
      "connection.update",
      "CONNECTION_UPDATE",
      "qrcode.updated",
      "QRCODE_UPDATED",
    ]);

    if (event && !ALLOWED_EVENTS.has(event)) {
      // Retorna 200 sem processar - não logar para economizar
      return new Response(JSON.stringify({ success: true, filtered: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Evolution Webhook:", { event, instanceName });

    // =====================
    // CONNECTION UPDATE (com resiliência contra desconexões transitórias)
    // =====================
    if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      const state = body?.data?.state || body?.data?.status || body?.state || body?.status || "";
      const normalizedState = typeof state === "string" ? state.toLowerCase() : "";
      const isConnected = ["open", "connected", "ready"].includes(normalizedState);

      console.log("Connection update:", { instanceName, state, isConnected });

      if (instanceName) {
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("id, organization_id, is_connected, status")
          .eq("evolution_instance_id", instanceName)
          .single();

        if (instance) {
          // RESILIÊNCIA: Se a instância estava conectada e recebemos um state transitório
          // (como "connecting", "close" durante restart), NÃO desconectar imediatamente.
          // Apenas aceitar desconexão se o state for explicitamente "close" ou "closed".
          const isExplicitDisconnect = [
            "close",
            "closed",
            "refused",
            "loggedout",
            "logged_out",
            "logout",
            "disconnected",
          ].includes(normalizedState);
          const wasConnected = instance.is_connected === true;

          if (!isConnected && wasConnected && !isExplicitDisconnect) {
            console.log("⚠️ Ignoring transient disconnection:", { 
              instanceName, state, 
              reason: "Instance was connected and state is not an explicit disconnect" 
            });
            // Não atualizar o banco - é provavelmente um restart temporário
            return new Response(JSON.stringify({ success: true, skipped: true, reason: "transient_state" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const updateData: any = {
            is_connected: isConnected,
            status: isConnected ? "active" : "disconnected",
            updated_at: new Date().toISOString(),
          };

          if (!isConnected) {
            updateData.qr_code_base64 = null;
          }

          await supabase
            .from("whatsapp_instances")
            .update(updateData)
            .eq("id", instance.id);

          console.log("Instance status updated:", {
            instanceId: instance.id,
            isConnected,
            state,
          });

          // =====================
          // AUTO-ENABLE GROUPS ON CONNECT
          // =====================
          if (isConnected) {
            console.log("🔄 Auto-enabling groups for instance:", instanceName);

            // 1. Configurar settings para NÃO ignorar grupos
            try {
              const settingsRes = await fetch(
                `${EVOLUTION_API_URL}/settings/set/${instanceName}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "apikey": EVOLUTION_API_KEY,
                  },
                  body: JSON.stringify({
                    groupsIgnore: false,
                  }),
                },
              );
              console.log(
                "✅ Groups settings configured:",
                await settingsRes.json().catch(() => ({})),
              );
            } catch (e) {
              console.warn("⚠️ Could not configure groups settings:", e);
            }

            // 2. Garantir que webhook tem GROUPS_UPSERT
            try {
              const webhookUrl =
                `${SUPABASE_URL}/functions/v1/evolution-webhook`;
              const webhookRes = await fetch(
                `${EVOLUTION_API_URL}/webhook/set/${instanceName}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "apikey": EVOLUTION_API_KEY,
                  },
                  body: JSON.stringify({
                    url: webhookUrl,
                    byEvents: false,
                    base64: true,
                    headers: { "Content-Type": "application/json" },
                    events: [
                      "MESSAGES_UPSERT",
                      "CONNECTION_UPDATE",
                      "QRCODE_UPDATED",
                    ],
                  }),
                },
              );
              console.log(
                "✅ Webhook with groups configured:",
                await webhookRes.json().catch(() => ({})),
              );
            } catch (e) {
              console.warn("⚠️ Could not configure webhook:", e);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // QR CODE UPDATED
    // =====================
    if (event === "qrcode.updated" || event === "QRCODE_UPDATED") {
      const qrBase64 = body?.data?.qrcode?.base64 || body?.qrcode?.base64 || "";

      console.log("QR Code update:", { instanceName, hasQr: !!qrBase64 });

      if (instanceName && qrBase64) {
        await supabase
          .from("whatsapp_instances")
          .update({
            qr_code_base64: qrBase64,
            status: "pending",
            is_connected: false,
            updated_at: new Date().toISOString(),
          })
          .eq("evolution_instance_id", instanceName);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================
    // MESSAGES UPSERT
    // =====================
    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const data = body?.data || body;
      const key = data?.key || {};
      const message = data?.message || {};
      const pushName = data?.pushName || "";

      // 🔍 TEMPORARY DEBUG: Log full audio payload
      if (message?.audioMessage) {
        console.log(
          "🔍 FULL AUDIO PAYLOAD:",
          JSON.stringify(
            {
              dataKeys: Object.keys(data || {}),
              messageKeys: Object.keys(message || {}),
              audioMessage: message.audioMessage,
              dataMediaUrl: data?.mediaUrl,
              dataMedia: data?.media,
              dataBase64: typeof data?.base64 === "string"
                ? `string(${data.base64.length})`
                : data?.base64,
            },
            null,
            2,
          ).substring(0, 2000),
        );
      }

      const remoteJid = key?.remoteJid || "";
      const isFromMe = key?.fromMe === true;
      const isGroup = remoteJid.includes("@g.us");

      // Extract contact profile picture URL if available
      const contactProfilePic = data?.profilePictureUrl ||
        data?.profilePicUrl || null;

      // Ignorar apenas mensagens próprias (não de grupos!)
      if (isFromMe) {
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "fromMe" }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Extrair informações de grupo
      let groupSubject: string | null = null;
      let participantPhone: string | null = null;

      if (isGroup) {
        groupSubject = data?.groupMetadata?.subject || data?.groupSubject ||
          null;
        // Em grupos, participant é quem enviou
        const participantJid = key?.participant || "";
        if (participantJid) {
          participantPhone = normalizeWhatsApp(participantJid.split("@")[0]);
        }
      }

      const fromPhoneRaw = isGroup
        ? (participantPhone || remoteJid.split("@")[0])
        : remoteJid.split("@")[0];
      const fromPhone = normalizeWhatsApp(fromPhoneRaw);

      // Detectar tipo de mensagem e extrair conteúdo
      const msgData = detectMessageType(message);

      console.log("Message received:", {
        instanceName,
        fromPhone,
        pushName,
        type: msgData.type,
        isGroup,
        groupSubject,
        hasMedia: !!msgData.mediaUrl || msgData.hasEncryptedMedia,
        contentPreview: msgData.content.substring(0, 100),
        hasProfilePic: !!contactProfilePic,
      });

      // Buscar a instância para saber a organização
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id, organization_id, phone_number, evolution_instance_id")
        .eq("evolution_instance_id", instanceName)
        .single();

      if (!instance) {
        // Verificar se é a instância administrativa do sistema
        const { data: adminSettings } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "admin_whatsapp_instance")
          .maybeSingle();

        const adminInstanceName = adminSettings?.value?.instance_name;

        if (adminInstanceName && instanceName === adminInstanceName) {
          // É a instância administrativa - redirecionar para secretária Morphews
          console.log(
            "📱 Admin instance detected, forwarding to assistant webhook",
          );

          try {
            const assistantResponse = await fetch(
              `${SUPABASE_URL}/functions/v1/evolution-assistant-webhook`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify(body),
              },
            );

            const result = await assistantResponse.json();
            console.log("📱 Assistant webhook result:", result);

            return new Response(
              JSON.stringify({ success: true, forwarded: true, result }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          } catch (assistantError) {
            console.error("❌ Error forwarding to assistant:", assistantError);
            return new Response(
              JSON.stringify({ success: false, error: "assistant_error" }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }

        console.log("Instance not found:", instanceName);
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atualizar phone_number da instância se ainda não tiver
      if (!instance.phone_number && body?.data?.owner) {
        const ownerPhone = normalizeWhatsApp(body.data.owner.split("@")[0]);
        if (ownerPhone) {
          await supabase
            .from("whatsapp_instances")
            .update({ phone_number: ownerPhone })
            .eq("id", instance.id);
        }
      }

      const organizationId = instance.organization_id;

      // Buscar robô para esta instância:
      // 1. Primeiro, verificar se há ALGUM bot configurado (independente do horário)
      // 2. Depois, verificar se há bot ativo para o horário ATUAL
      let anyBotId: string | null = null;
      let activeBotId: string | null = null;

      // Qualquer bot configurado na instância (ignora horário)
      const { data: anyBotResult } = await supabase.rpc(
        "get_any_bot_for_instance",
        {
          p_instance_id: instance.id,
        },
      );
      if (anyBotResult) {
        anyBotId = anyBotResult;
        console.log("🤖 Instance has bot configured:", anyBotId);
      }

      // Bot ativo para o horário atual
      const { data: activeBotResult } = await supabase.rpc(
        "get_active_bot_for_instance",
        {
          p_instance_id: instance.id,
        },
      );
      if (activeBotResult) {
        activeBotId = activeBotResult;
        console.log("🤖 Active bot for current time:", activeBotId);
      } else if (anyBotId) {
        // Há bot configurado mas não está no horário - ainda assim processar!
        console.log(
          "🤖 Bot exists but outside schedule - will send out-of-hours message",
        );
      } else {
        console.log("🤖 No bot configured for this instance");
      }

      // Buscar conversa existente - INCLUI instance_id para garantir cards separados por instância
      // PRIMEIRO por chat_id + instance_id (mais confiável para multi-instância)
      // Incluir awaiting_satisfaction_response e satisfaction_sent_at para detectar respostas NPS
      let { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select(
          "id, unread_count, instance_id, phone_number, status, assigned_user_id, awaiting_satisfaction_response, satisfaction_sent_at, lead_id, organization_id",
        )
        .eq("organization_id", organizationId)
        .eq("instance_id", instance.id)
        .eq("chat_id", remoteJid)
        .maybeSingle();

      // Se não encontrou por chat_id+instance, tentar por phone_number+instance (para conversas criadas pelo frontend)
      // Usa variações do número brasileiro (com e sem o dígito 9)
      if (!conversation && !isGroup) {
        const phoneVariations = getBrazilPhoneVariations(fromPhone);
        console.log(
          "Searching conversation by phone+instance variations:",
          phoneVariations,
          "instance:",
          instance.id,
        );

        for (const phoneVar of phoneVariations) {
          const { data: convByPhone } = await supabase
            .from("whatsapp_conversations")
            .select(
              "id, unread_count, instance_id, phone_number, status, assigned_user_id, awaiting_satisfaction_response, satisfaction_sent_at, lead_id, organization_id",
            )
            .eq("organization_id", organizationId)
            .eq("instance_id", instance.id)
            .eq("phone_number", phoneVar)
            .maybeSingle();

          if (convByPhone) {
            conversation = convByPhone;
            console.log(
              "Found conversation by phone+instance variation:",
              phoneVar,
              "instance:",
              instance.id,
            );
            break;
          }
        }
      }

      let wasClosed = false;

      if (!conversation) {
        // Criar nova conversa - status inicial é 'pending' para distribuição
        const displayName = isGroup
          ? (groupSubject || `Grupo ${remoteJid.split("@")[0]}`)
          : (pushName || `+${fromPhone}`);

        // Usar foto do webhook se disponível (não buscar da API para economizar invocações)
        let profilePicToSave = contactProfilePic;

        const { data: newConvo, error: convoError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            organization_id: organizationId,
            instance_id: instance.id,
            current_instance_id: instance.id,
            phone_number: isGroup ? remoteJid.split("@")[0] : fromPhone,
            sendable_phone: isGroup ? null : fromPhone,
            customer_phone_e164: isGroup ? null : fromPhone,
            contact_name: displayName,
            display_name: displayName,
            contact_profile_pic: isGroup ? null : profilePicToSave,
            chat_id: remoteJid,
            is_group: isGroup,
            group_subject: groupSubject,
            last_message_at: new Date().toISOString(),
            last_customer_message_at: new Date().toISOString(),
            unread_count: 1,
            status: "pending", // Nova conversa entra como pendente para distribuição
          })
          .select(
            "id, unread_count, instance_id, phone_number, status, assigned_user_id",
          )
          .single();

        if (convoError) {
          console.error("Error creating conversation:", convoError);
        } else {
          conversation = newConvo as any;
          console.log("Created new conversation:", {
            id: conversation?.id,
            isGroup,
            groupSubject,
            status: "pending",
            hasProfilePic: !!profilePicToSave,
          });

          // Verificar modo de distribuição da instância
          const { data: instConfig } = await supabase
            .from("whatsapp_instances")
            .select("distribution_mode")
            .eq("id", instance.id)
            .single();

          const distributionMode = instConfig?.distribution_mode || "manual";
          console.log(
            "📋 Distribution mode for new conversation:",
            distributionMode,
          );

          // MODO AGENT 2.0: Se instância está em modo agente
          if (distributionMode === "agent" && !isGroup && conversation) {
            console.log(
              "🚀 Agent 2.0 mode enabled, setting status to with_bot for agent processing",
            );
            await supabase
              .from("whatsapp_conversations")
              .update({
                status: "with_bot",
                handling_bot_id: null,
                bot_started_at: new Date().toISOString(),
                bot_messages_count: 0,
              })
              .eq("id", conversation.id);
            conversation = {
              ...conversation,
              status: "with_bot",
              handling_bot_id: null,
            } as any;
          } // MODO AGENT TEAM 2.0: Se instância está em modo time de agentes
          else if (distributionMode === "agent_team" && !isGroup && conversation) {
            console.log(
              "🚀 Agent Team 2.0 mode enabled, setting status to with_bot for team processing",
            );
            await supabase
              .from("whatsapp_conversations")
              .update({
                status: "with_bot",
                handling_bot_id: null,
                bot_started_at: new Date().toISOString(),
                bot_messages_count: 0,
              })
              .eq("id", conversation.id);
            conversation = {
              ...conversation,
              status: "with_bot",
              handling_bot_id: null,
            } as any;
          } // MODO BOT: Se instância está em modo robô E tem bot configurado
          else if (
            distributionMode === "bot" && anyBotId && !isGroup && conversation
          ) {
            console.log("🤖 Bot mode enabled, setting status to with_bot");
            await supabase
              .from("whatsapp_conversations")
              .update({
                status: "with_bot",
                handling_bot_id: anyBotId,
                bot_started_at: new Date().toISOString(),
                bot_messages_count: 0,
              })
              .eq("id", conversation.id);
            // Atualizar estado local
            conversation = {
              ...conversation,
              status: "with_bot",
              handling_bot_id: anyBotId,
            } as any;
          } // MODO AUTO-DISTRIBUIÇÃO
          else if (distributionMode === "auto" && conversation) {
            console.log(
              "🔄 Auto-distribution enabled, designating conversation...",
            );
            const { data: assignResult } = await supabase.rpc(
              "reopen_whatsapp_conversation",
              {
                p_conversation_id: conversation.id,
                p_instance_id: instance.id,
              },
            );
            console.log("Auto-distribution result:", assignResult);
          }
          // MODO MANUAL: conversa fica pendente (já é o default)
        }
      } else {
        // Atualizar conversa existente
        const updateData: any = {
          last_message_at: new Date().toISOString(),
          last_customer_message_at: new Date().toISOString(),
          unread_count: (conversation.unread_count || 0) + 1,
          chat_id: remoteJid,
          current_instance_id: instance.id,
        };

        // Update contact profile picture only if available in webhook payload (skip API fetch to save costs)
        let profilePicToUpdate = contactProfilePic;

        if (profilePicToUpdate && !isGroup) {
          updateData.contact_profile_pic = profilePicToUpdate;
          console.log("📸 Updating contact profile picture");
        }

        // Update contact name from pushName if not already set
        if (pushName && !isGroup) {
          updateData.contact_name = pushName;
          updateData.display_name = pushName;
        }

        // REABERTURA: Se conversa está fechada, verificar se é resposta NPS antes de reabrir
        wasClosed = conversation.status === "closed";

        // ===== PROCESSAMENTO AUTOMÁTICO DE NPS =====
        // Se a conversa estava aguardando resposta de satisfação, processar a nota automaticamente
        let isNPSResponse = false;
        if (
          wasClosed && conversation.awaiting_satisfaction_response &&
          conversation.satisfaction_sent_at
        ) {
          const messageContent = msgData.content || "";
          const npsResult = await extractNPSRating(messageContent);
          const extractedRating = npsResult.rating;
          const ratingSource = npsResult.source;
          const ratingReasoning = npsResult.reasoning;

          console.log(
            `📊 NPS Response detected! Rating: ${extractedRating} (source: ${ratingSource}, reasoning: ${ratingReasoning}) Response: ${
              messageContent.substring(0, 50)
            }`,
          );

          if (
            extractedRating !== null ||
            (ratingSource !== "none" && ratingSource !== undefined)
          ) {
            // É uma resposta NPS válida - processar automaticamente
            isNPSResponse = true;

            // Buscar e atualizar o registro de satisfação existente
            const { data: existingRating } = await supabase
              .from("conversation_satisfaction_ratings")
              .select("id")
              .eq("conversation_id", conversation.id)
              .is("rating", null)
              .limit(1)
              .single();

            if (existingRating) {
              await supabase
                .from("conversation_satisfaction_ratings")
                .update({
                  rating: extractedRating,
                  ai_original_rating: extractedRating, // Preservar nota original para histórico
                  raw_response: messageContent,
                  is_pending_review: extractedRating !== null &&
                    extractedRating <= 6, // Detratores precisam revisão
                  responded_at: new Date().toISOString(),
                  auto_classified: ratingSource === "ai", // Marca como classificado por IA
                  classification_source: ratingSource, // 'regex', 'ai' ou 'none'
                  classification_reasoning: ratingReasoning, // Explicação da IA
                })
                .eq("id", existingRating.id);

              console.log(
                `📊 Updated NPS rating record: ${existingRating.id} with rating: ${extractedRating} (source: ${ratingSource})`,
              );
            } else {
              // Criar novo registro se não existir
              await supabase.from("conversation_satisfaction_ratings").insert({
                organization_id: conversation.organization_id,
                conversation_id: conversation.id,
                instance_id: instance.id,
                assigned_user_id: conversation.assigned_user_id,
                lead_id: conversation.lead_id,
                rating: extractedRating,
                ai_original_rating: extractedRating, // Preservar nota original
                raw_response: messageContent,
                is_pending_review: extractedRating !== null &&
                  extractedRating <= 6,
                responded_at: new Date().toISOString(),
                auto_classified: ratingSource === "ai",
                classification_source: ratingSource,
                classification_reasoning: ratingReasoning,
              });
              console.log(
                `📊 Created new NPS rating record with rating: ${extractedRating} (source: ${ratingSource})`,
              );
            }

            // Limpar flag de aguardando resposta, MAS MANTER CONVERSA ENCERRADA
            await supabase
              .from("whatsapp_conversations")
              .update({
                awaiting_satisfaction_response: false,
                // NÃO mudar status - mantém 'closed'
              })
              .eq("id", conversation.id);

            console.log("📊 NPS processed - conversation remains closed");

            // Enviar mensagem de agradecimento ao cliente
            try {
              // Buscar mensagem de agradecimento da organização
              const { data: orgConfig } = await supabase
                .from("organizations")
                .select("satisfaction_thank_you_message")
                .eq("id", conversation.organization_id)
                .single();

              const thankYouMessage =
                orgConfig?.satisfaction_thank_you_message ||
                "Obrigado pela sua avaliação! 💚 Sua opinião é muito importante para nós.";

              // Buscar token da instância para envio
              const { data: instanceData } = await supabase
                .from("whatsapp_instances")
                .select("evolution_api_token")
                .eq("id", instance.id)
                .single();

              // Buscar apiUrl do admin config
              const { data: globalSettings } = await supabase
                .from("system_settings")
                .select("value")
                .eq("key", "evolution_config")
                .maybeSingle();

              const apiUrl = globalSettings?.value?.apiUrl || EVOLUTION_API_URL;
              const apiToken = instanceData?.evolution_api_token ||
                EVOLUTION_API_KEY;

              if (apiUrl && apiToken) {
                const sendResponse = await fetch(
                  `${apiUrl}/message/sendText/${instanceName}`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "apikey": apiToken,
                    },
                    body: JSON.stringify({
                      number: fromPhone,
                      text: thankYouMessage,
                    }),
                  },
                );

                console.log(
                  "📊 NPS Thank you message sent:",
                  await sendResponse.json().catch(() => ({})),
                );
              }
            } catch (thankYouError) {
              console.warn(
                "⚠️ Could not send NPS thank you message:",
                thankYouError,
              );
              // Não bloqueia o fluxo
            }

            // Não reabrir a conversa - apenas atualizar unread_count e timestamp
            updateData.status = "closed"; // Força manter fechada
            // Não precisa incrementar unread pois está encerrada
            delete updateData.unread_count;
          }
        }

        // Se NÃO foi resposta NPS e conversa estava fechada, aí sim reabrir normalmente
        if (wasClosed && !isNPSResponse) {
          console.log("📬 Conversation was closed, reopening...");

          // Verificar modo de distribuição da instância
          const { data: instConfig } = await supabase
            .from("whatsapp_instances")
            .select("distribution_mode")
            .eq("id", instance.id)
            .single();

          const distributionMode = instConfig?.distribution_mode || "manual";
          console.log("📋 Distribution mode for reopening:", distributionMode);

          // MODO AGENT 2.0 ou AGENT TEAM 2.0
          if ((distributionMode === "agent" || distributionMode === "agent_team") && !isGroup) {
            console.log(
              `🚀 ${distributionMode} mode (reopened), setting status to with_bot`,
            );
            updateData.status = "with_bot";
            updateData.handling_bot_id = null;
            updateData.bot_started_at = new Date().toISOString();
            updateData.assigned_user_id = null;
            updateData.assigned_at = null;
            updateData.closed_at = null;

            // Limpar state do agente ativo ao reabrir (começa do Maestro novamente)
            if (distributionMode === "agent_team") {
              try {
                const AGENTS_URL = Deno.env.get("AGENTS_SUPABASE_URL") ?? "";
                const AGENTS_KEY = Deno.env.get("AGENTS_SUPABASE_ANON_KEY") ?? "";
                if (AGENTS_URL && AGENTS_KEY) {
                  const agentsClient = createClient(AGENTS_URL, AGENTS_KEY);
                  await agentsClient
                    .from("conversation_agent_state")
                    .delete()
                    .eq("conversation_id", conversation.id);
                  console.log("🔄 Cleared agent state for reopened team conversation");
                }
              } catch (clearErr) {
                console.error("⚠️ Error clearing agent state:", clearErr);
              }
            }
          } // MODO BOT: Se instância está em modo robô E tem bot configurado
          else if (distributionMode === "bot" && anyBotId && !isGroup) {
            console.log(
              "🤖 Bot mode enabled (reopened), setting status to with_bot - preserving message count",
            );
            updateData.status = "with_bot";
            updateData.handling_bot_id = anyBotId;
            updateData.bot_started_at = new Date().toISOString();
            // NÃO resetar bot_messages_count - preservar para que o bot saiba que já conversou
            updateData.assigned_user_id = null;
            updateData.assigned_at = null;
            updateData.closed_at = null;
          } // MODO AUTO-DISTRIBUIÇÃO
          else if (distributionMode === "auto") {
            const { data: assignResult } = await supabase.rpc(
              "reopen_whatsapp_conversation",
              {
                p_conversation_id: conversation.id,
                p_instance_id: instance.id,
              },
            );
            console.log("Auto-reopen result:", assignResult);
          } // MODO MANUAL: volta para pendente
          else {
            updateData.status = "pending";
            updateData.assigned_user_id = null;
            updateData.assigned_at = null;
            updateData.closed_at = null;
          }
        }

        // Atualizar phone_number se diferente (normalização brasileira)
        if (!isGroup && conversation.phone_number !== fromPhone) {
          updateData.phone_number = fromPhone;
          updateData.sendable_phone = fromPhone;
          updateData.customer_phone_e164 = fromPhone;
          console.log(
            "Updating phone_number from",
            conversation.phone_number,
            "to",
            fromPhone,
          );
        }

        if (isGroup && groupSubject) {
          updateData.group_subject = groupSubject;
          updateData.display_name = groupSubject;
        }

        await supabase
          .from("whatsapp_conversations")
          .update(updateData)
          .eq("id", conversation.id);

        // Mantém o estado local alinhado com o update acima (importante para a lógica do robô abaixo)
        conversation = {
          ...(conversation as any),
          ...(updateData as any),
        } as any;

        console.log(
          "Updated conversation:",
          (conversation as any)?.id,
          "from instance:",
          instance.id,
          wasClosed ? "(reopened)" : "",
        );
      }

      // =====================
      // PROCESSAR MÍDIA
      // =====================
      let savedMediaUrl: string | null = null;

      if (conversation) {
        // Log para debug de mídia
        if (msgData.type !== "text") {
          console.log(`📹 Processing media type: ${msgData.type}`, {
            hasBase64InPayload: !!msgData.mediaUrl,
            hasEncryptedMedia: msgData.hasEncryptedMedia,
            messageKeyId: key?.id || "no-key",
            mimeType: msgData.mediaMimeType,
          });
        }

        // Se já tem base64 no payload, salvar direto
        if (msgData.mediaUrl && msgData.mediaUrl.startsWith("data:")) {
          console.log(`📹 Saving media from base64 payload (${msgData.type})`);
          savedMediaUrl = await saveMediaToStorage(
            organizationId,
            instance.id,
            conversation.id,
            msgData.mediaUrl,
            msgData.mediaMimeType || "application/octet-stream",
          );
          console.log(
            `📹 Media saved result: ${savedMediaUrl ? "SUCCESS" : "FAILED"}`,
          );
        } // Se tem mídia criptografada (mmg.whatsapp.net), buscar via Evolution API
        else if (msgData.hasEncryptedMedia && key?.id) {
          console.log(
            `📥 Fetching encrypted media via Evolution API (${msgData.type})...`,
          );

          const mediaResult = await downloadMediaFromEvolution(
            instanceName,
            {
              id: key.id,
              remoteJid: remoteJid,
              fromMe: false,
            },
            msgData.type === "video", // Convert video to mp4
          );

          if (mediaResult?.base64) {
            console.log(
              `📹 Downloaded from Evolution, saving to storage (${msgData.type})...`,
            );
            savedMediaUrl = await saveMediaToStorage(
              organizationId,
              instance.id,
              conversation.id,
              mediaResult.base64,
              mediaResult.mimeType || msgData.mediaMimeType ||
                "application/octet-stream",
            );
            console.log(
              `📹 Media saved result: ${savedMediaUrl ? "SUCCESS" : "FAILED"}`,
            );
          } else {
            console.error(
              `❌ Failed to download media from Evolution (${msgData.type})`,
            );
            // FALLBACK: Use encrypted URL directly from original payload
            // The quick-endpoint/ai-bot-process can try to download it directly
            const encryptedUrl = message?.audioMessage?.url ||
              message?.imageMessage?.url ||
              message?.documentMessage?.url ||
              message?.videoMessage?.url ||
              message?.stickerMessage?.url || null;
            if (encryptedUrl) {
              savedMediaUrl = encryptedUrl;
              console.log(
                `📥 FALLBACK: Using encrypted URL directly as mediaUrl: ${
                  encryptedUrl.substring(0, 80)
                }...`,
              );
            } else {
              console.error(
                `❌ No fallback URL available in original payload for ${msgData.type}`,
              );
            }
          }
        } else if (
          msgData.type !== "text" && !msgData.mediaUrl &&
          !msgData.hasEncryptedMedia
        ) {
          console.warn(
            `⚠️ Media message without base64 or encrypted flag (${msgData.type})`,
          );
        }
      }

      // Salvar mensagem
      if (conversation) {
        const waMessageId = key?.id || null;
        const messageId = crypto.randomUUID();

        // Conteúdo da mensagem (para grupos, incluir quem enviou)
        let messageContent = msgData.content;
        let audioTranscriptionPromise: Promise<string | null> | null = null;
        if (isGroup && pushName && msgData.type === "text") {
          // Opcional: prefixar com nome do remetente em grupos
          // messageContent = `[${pushName}] ${msgData.content}`;
        }

        const { error: msgError } = await supabase
          .from("whatsapp_messages")
          .insert({
            id: messageId,
            instance_id: instance.id,
            conversation_id: conversation.id,
            message_type: msgData.type,
            content: messageContent,
            media_url: savedMediaUrl,
            media_caption: msgData.mediaCaption,
            direction: "inbound",
            status: "delivered",
            is_from_bot: false,
            provider: "evolution",
            provider_message_id: waMessageId,
          });

        if (msgError) {
          console.error("Error saving message:", msgError);
        } else {
          console.log("Message saved:", {
            messageId,
            conversationId: conversation.id,
            type: msgData.type,
            isGroup,
            hasMedia: !!savedMediaUrl,
          });

          // =====================
          // AUTO-TRANSCRIPTION FOR AUDIO MESSAGES (CLIENT AUDIO)
          // Uses global organization setting: whatsapp_transcribe_client_audio
          // =====================
          if (msgData.type === "audio" && savedMediaUrl) {
            // Fetch organization transcription settings
            const { data: orgTranscribeSettings } = await supabase
              .from("organizations")
              .select("whatsapp_transcribe_client_audio")
              .eq("id", organizationId)
              .single();

            const shouldAutoTranscribe = (orgTranscribeSettings as any)
              ?.whatsapp_transcribe_client_audio === true;

            if (shouldAutoTranscribe) {
              console.log(
                "🎤 Triggering auto-transcription for inbound audio message:",
                messageId,
              );

              // Mark as pending and trigger transcription (fire and forget)
              await supabase
                .from("whatsapp_messages")
                .update({ transcription_status: "pending" })
                .eq("id", messageId);

              audioTranscriptionPromise = fetch(
                `${SUPABASE_URL}/functions/v1/transcribe-audio-message`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify({
                    messageId: messageId,
                    organizationId: organizationId,
                    mediaUrl: savedMediaUrl,
                  }),
                },
              ).then(async (res) => {
                const result = await res.json().catch(() => ({}));
                console.log("🎤 Transcription result:", result);

                if (!res.ok || typeof result?.error === "string") {
                  return null;
                }

                return typeof result?.transcription === "string" &&
                    result.transcription.trim().length > 0
                  ? result.transcription.trim()
                  : null;
              }).catch((transcriptionError) => {
                console.error(
                  "❌ Error calling transcription:",
                  transcriptionError,
                );
                return null;
              });
            }
          }

          // =====================
          // AUTO-READ DOCUMENTS (PDF)
          // =====================
          const shouldReadDocument = msgData.type === "document" &&
            savedMediaUrl &&
            (msgData.mediaMimeType?.includes("pdf") ||
              savedMediaUrl.includes(".pdf"));

          if (shouldReadDocument) {
            console.log("📄 Triggering document reading for PDF:", messageId);

            fetch(`${SUPABASE_URL}/functions/v1/read-document`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                messageId: messageId,
                conversationId: conversation.id,
                organizationId: organizationId,
                documentUrl: savedMediaUrl,
                documentType: "pdf",
                conversationStatus: conversation.status,
                instanceName: instanceName,
                customerPhone: fromPhone,
              }),
            }).then(async (res) => {
              const result = await res.json();
              console.log("📄 Document reading result:", result);
            }).catch((docError) => {
              console.error("❌ Error calling read-document:", docError);
            });
          }

          // =====================
          // PROCESSAR COM ROBÔ IA / AGENTE 2.0
          // =====================
          const supportedBotTypes = ["text", "audio", "image"];

          // Buscar distribution_mode da instância para decidir o roteamento
          const { data: instModeConfig } = await supabase
            .from("whatsapp_instances")
            .select("distribution_mode")
            .eq("id", instance.id)
            .single();
          const currentDistMode = instModeConfig?.distribution_mode || "manual";

          // Usar anyBotId (qualquer bot configurado) ao invés de apenas activeBotId (bot no horário)
          const botIdToUse = anyBotId;
          const isWithinSchedule = !!activeBotId;

          // Decidir se deve processar: modo agent, agent_team OU modo bot com botId
          const isAgentMode = currentDistMode === "agent";
          const isAgentTeamMode = currentDistMode === "agent_team";
          const shouldProcessWithBot = !isGroup &&
            supportedBotTypes.includes(msgData.type) &&
            conversation.status === "with_bot" &&
            (isAgentMode || isAgentTeamMode || botIdToUse);

          if (shouldProcessWithBot) {
            const AGENTS_SUPABASE_URL = Deno.env.get("AGENTS_SUPABASE_URL") ??
              "";
            const AGENTS_SUPABASE_KEY =
              Deno.env.get("AGENTS_SUPABASE_ANON_KEY") ?? "";

            let useAgent20 = false;
            let agent20Id: string | null = null;

            if (isAgentTeamMode && AGENTS_SUPABASE_URL && AGENTS_SUPABASE_KEY) {
              // Modo agent_team: verificar state da conversa, senão buscar maestro
              try {
                const agentsClient = createClient(
                  AGENTS_SUPABASE_URL,
                  AGENTS_SUPABASE_KEY,
                );

                // 1. Verifica se já existe agente ativo para esta conversa
                const { data: convState } = await agentsClient
                  .from("conversation_agent_state")
                  .select("active_agent_id")
                  .eq("conversation_id", conversation.id)
                  .maybeSingle();

                if (convState?.active_agent_id) {
                  agent20Id = convState.active_agent_id;
                  useAgent20 = true;
                  console.log(
                    "🔀 Agent Team: using routed agent from state:",
                    agent20Id,
                  );
                } else {
                  // Primeira mensagem: buscar o maestro do time
                  const { data: instanceLink } = await agentsClient
                    .from("agent_instances")
                    .select("team_id")
                    .eq("instance_id", instance.id)
                    .eq("is_active", true)
                    .maybeSingle();

                  if (instanceLink?.team_id) {
                    const { data: team } = await agentsClient
                      .from("agent_teams")
                      .select("maestro_agent_id")
                      .eq("id", instanceLink.team_id)
                      .single();

                    if (team?.maestro_agent_id) {
                      agent20Id = team.maestro_agent_id;
                      useAgent20 = true;
                      console.log(
                        "🎯 Agent Team: using maestro agent:",
                        agent20Id,
                      );
                    }
                  }
                }
              } catch (teamCheckError) {
                console.error("⚠️ Error checking agent team:", teamCheckError);
              }
            } else if (isAgentMode && AGENTS_SUPABASE_URL && AGENTS_SUPABASE_KEY) {
              // Modo agent: buscar agente vinculado diretamente
              try {
                const agentsClient = createClient(
                  AGENTS_SUPABASE_URL,
                  AGENTS_SUPABASE_KEY,
                );
                const { data: agentInstance } = await agentsClient
                  .from("agent_instances")
                  .select(
                    "agent_id, is_active, working_days, working_hours_start, working_hours_end",
                  )
                  .eq("instance_id", instance.id)
                  .eq("is_active", true)
                  .limit(1)
                  .maybeSingle();

                if (agentInstance) {
                  useAgent20 = true;
                  agent20Id = agentInstance.agent_id;
                  console.log(
                    "🚀 Agent 2.0 found for instance:",
                    instance.id,
                    "agent:",
                    agent20Id,
                  );
                }
              } catch (agentCheckError) {
                console.error("⚠️ Error checking agent 2.0:", agentCheckError);
              }
            } else if (
              !isAgentMode && !isAgentTeamMode && AGENTS_SUPABASE_URL && AGENTS_SUPABASE_KEY
            ) {
              // Modo bot legado: verificar se tem agent 2.0 vinculado (compatibilidade)
              try {
                const agentsClient = createClient(
                  AGENTS_SUPABASE_URL,
                  AGENTS_SUPABASE_KEY,
                );
                const { data: agentInstance } = await agentsClient
                  .from("agent_instances")
                  .select("agent_id, is_active")
                  .eq("instance_id", instance.id)
                  .eq("is_active", true)
                  .limit(1)
                  .maybeSingle();

                if (agentInstance) {
                  useAgent20 = true;
                  agent20Id = agentInstance.agent_id;
                  console.log(
                    "🚀 Agent 2.0 found (legacy mode) for instance:",
                    instance.id,
                  );
                }
              } catch (agentCheckError) {
                console.error("⚠️ Error checking agent 2.0:", agentCheckError);
              }
            }

            console.log(
              useAgent20
                ? `🚀 Processing with Agent 2.0: ${agent20Id}`
                : `🤖 Processing with legacy bot: ${botIdToUse}`,
            );

            if (msgData.type === "audio" && audioTranscriptionPromise) {
              const transcribedAudio = await audioTranscriptionPromise;

              if (transcribedAudio) {
                messageContent = transcribedAudio;

                const { error: syncContentError } = await supabase
                  .from("whatsapp_messages")
                  .update({ content: transcribedAudio })
                  .eq("id", messageId);

                if (syncContentError) {
                  console.error(
                    "❌ Failed to sync transcription into message content:",
                    syncContentError,
                  );
                }

                console.log(
                  `🎤 Using transcription as userMessage for bot: ${
                    transcribedAudio.substring(0, 120)
                  }`,
                );
              } else {
                console.log(
                  "⚠️ No transcription available before bot processing; continuing with mediaUrl fallback only.",
                );
              }
            }

            const isFirstMessage = !wasClosed &&
              ((conversation.bot_messages_count ?? 0) === 0);
            const isReopened = wasClosed;

            // Extract quoted message context if replying to a message
            const quotedMessage = (() => {
              try {
                const ctx = data?.message?.extendedTextMessage?.contextInfo ||
                  data?.message?.audioMessage?.contextInfo ||
                  data?.message?.imageMessage?.contextInfo ||
                  data?.message?.documentMessage?.contextInfo ||
                  data?.message?.videoMessage?.contextInfo;
                if (ctx?.quotedMessage) {
                  const quoted = ctx.quotedMessage;
                  return {
                    text: quoted.conversation || quoted.extendedTextMessage?.text || null,
                    type: quoted.audioMessage ? "audio" : quoted.imageMessage ? "image" : quoted.documentMessage ? "document" : "text",
                    participant: ctx.participant || null,
                  };
                }
                return null;
              } catch { return null; }
            })();

            const botPayload: any = {
              botId: useAgent20 ? agent20Id : botIdToUse,
              conversationId: conversation.id,
              instanceId: instance.id,
              instanceName: instanceName,
              organizationId: organizationId,
              userMessage: messageContent || "",
              contactName: pushName || `+${fromPhone}`,
              phoneNumber: fromPhone,
              chatId: remoteJid,
              isFirstMessage,
              isReopened,
              messageType: msgData.type,
              isWithinSchedule: (isAgentMode || isAgentTeamMode) ? true : isWithinSchedule,
              // Enriched fields
              messageId: messageId,
              leadId: conversation.lead_id || null,
              mediaCaption: msgData.mediaCaption || null,
              transcription: (msgData.type === "audio" && messageContent !== msgData.content) ? messageContent : null,
              isGroup: isGroup,
              groupSubject: isGroup ? (groupSubject || null) : null,
              waMessageId: key?.id || null,
              contactProfilePic: contactProfilePic || null,
              quotedMessage: quotedMessage,
            };

            // Tenta usar savedMediaUrl primeiro, depois fallback para URL encriptada do payload
            const fallbackMediaUrl = msgData.audioUrl ||
              msgData.mediaUrl ||
              data?.message?.audioMessage?.url ||
              data?.message?.imageMessage?.url ||
              data?.message?.documentMessage?.url ||
              data?.message?.videoMessage?.url ||
              null;

            const mediaUrlToSend = savedMediaUrl || fallbackMediaUrl;

            if (
              (msgData.type === "audio" || msgData.type === "image" ||
                msgData.type === "document" || msgData.type === "video") &&
              mediaUrlToSend
            ) {
              botPayload.mediaUrl = mediaUrlToSend;
              botPayload.mediaMimeType = msgData.mediaMimeType;
              console.log(
                `📎 Media URL for bot: ${msgData.type} → ${
                  mediaUrlToSend?.substring(0, 80)
                }`,
              );
            }

            const targetUrl = useAgent20
              ? `${AGENTS_SUPABASE_URL}/functions/v1/quick-endpoint`
              : `${SUPABASE_URL}/functions/v1/ai-bot-process`;
            const targetAuth = useAgent20
              ? `Bearer ${AGENTS_SUPABASE_KEY}`
              : `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

            console.log(
              useAgent20
                ? "🚀 Routing to Agent 2.0 (external)"
                : "🤖 Routing to legacy ai-bot-process",
            );

            fetch(targetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": targetAuth,
              },
              body: JSON.stringify(botPayload),
            }).then(async (res) => {
              const result = await res.json();
              console.log(
                useAgent20 ? "🚀 Agent 2.0 result:" : "🤖 Bot process result:",
                result,
              );
            }).catch((botError) => {
              console.error("❌ Error calling bot:", botError);
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evento não tratado
    console.log("Unhandled event:", event);
    return new Response(JSON.stringify({ success: true, unhandled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("evolution-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Secure proxy edge function to serve media files from Supabase Storage.
 * Uses HMAC-signed tokens with short expiration for security.
 * 
 * Usage: GET /whatsapp-media-proxy?token=<hmac_signed_token>
 * 
 * Token format: base64(JSON.stringify({ bucket, path, exp })) + "." + hmac_signature
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_MEDIA_TOKEN_SECRET = Deno.env.get("WHATSAPP_MEDIA_TOKEN_SECRET") ?? "";

// ============================================================================
// HMAC TOKEN UTILITIES
// ============================================================================

async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verifyHmacSignature(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await createHmacSignature(data, secret);
  
  // Constant-time comparison
  if (expectedSignature.length !== signature.length) return false;
  
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  
  return result === 0;
}

interface MediaTokenPayload {
  bucket: string;
  path: string;
  exp: number; // Unix timestamp (seconds)
  mime?: string;
}

/**
 * Generate a secure HMAC-signed token for media access
 * Token expires in 5 minutes by default
 */
export async function generateMediaToken(
  bucket: string, 
  path: string, 
  mimeType?: string,
  expiresInSeconds = 300 // 5 minutes
): Promise<string> {
  if (!WHATSAPP_MEDIA_TOKEN_SECRET) {
    throw new Error("WHATSAPP_MEDIA_TOKEN_SECRET not configured");
  }
  
  const payload: MediaTokenPayload = {
    bucket,
    path,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    mime: mimeType,
  };
  
  const payloadStr = btoa(JSON.stringify(payload));
  const signature = await createHmacSignature(payloadStr, WHATSAPP_MEDIA_TOKEN_SECRET);
  
  return `${payloadStr}.${signature}`;
}

/**
 * Verify and decode a media token
 */
async function verifyMediaToken(token: string): Promise<MediaTokenPayload | null> {
  if (!WHATSAPP_MEDIA_TOKEN_SECRET) {
    console.error("❌ WHATSAPP_MEDIA_TOKEN_SECRET not configured");
    return null;
  }
  
  const parts = token.split(".");
  if (parts.length !== 2) {
    console.error("❌ Invalid token format");
    return null;
  }
  
  const [payloadStr, signature] = parts;
  
  // Verify signature
  const isValid = await verifyHmacSignature(payloadStr, signature, WHATSAPP_MEDIA_TOKEN_SECRET);
  if (!isValid) {
    console.error("❌ Invalid token signature");
    return null;
  }
  
  // Decode payload
  try {
    const payload = JSON.parse(atob(payloadStr)) as MediaTokenPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error("❌ Token expired:", new Date(payload.exp * 1000).toISOString());
      return null;
    }
    
    console.log("✅ Token validated:", { bucket: payload.bucket, path: payload.path });
    return payload;
  } catch (e) {
    console.error("❌ Invalid token payload:", e);
    return null;
  }
}

// ============================================================================
// LEGACY TOKEN SUPPORT (database-based tokens)
// ============================================================================

async function verifyLegacyToken(token: string, supabaseAdmin: any): Promise<{
  bucket_id: string;
  object_path: string;
  content_type: string;
} | null> {
  const { data: tokenData, error: tokenError } = await supabaseAdmin
    .from("whatsapp_media_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (tokenError) {
    console.error("Legacy token lookup error:", tokenError);
    return null;
  }

  if (!tokenData) {
    return null;
  }

  // Check expiration
  if (new Date(tokenData.expires_at) < new Date()) {
    // Delete expired token
    await supabaseAdmin
      .from("whatsapp_media_tokens")
      .delete()
      .eq("id", tokenData.id);
    console.log("Legacy token expired and deleted");
    return null;
  }

  return {
    bucket_id: tokenData.bucket_id,
    object_path: tokenData.object_path,
    content_type: tokenData.content_type,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      console.error("❌ Missing token parameter");
      return new Response(
        JSON.stringify({ error: "Missing token" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let bucket: string;
    let objectPath: string;
    let contentType: string | undefined;

    // Try HMAC token first (new secure method)
    if (token.includes(".")) {
      const payload = await verifyMediaToken(token);
      if (!payload) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }), 
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      bucket = payload.bucket;
      objectPath = payload.path;
      contentType = payload.mime;
    } else {
      // Fall back to legacy database token
      const legacyData = await verifyLegacyToken(token, supabaseAdmin);
      if (!legacyData) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }), 
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      bucket = legacyData.bucket_id;
      objectPath = legacyData.object_path;
      contentType = legacyData.content_type;
    }

    // Download file from storage
    const { data: fileData, error: fileError } = await supabaseAdmin
      .storage
      .from(bucket)
      .download(objectPath);

    if (fileError || !fileData) {
      console.error("File download error:", fileError);
      return new Response(
        JSON.stringify({ error: "File not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the file with appropriate content type
    const finalContentType = contentType || "application/octet-stream";
    
    console.log("✅ Serving file:", { bucket, objectPath, contentType: finalContentType });
    
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": finalContentType,
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes (match token expiry)
      },
    });

  } catch (error: any) {
    console.error("whatsapp-media-proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

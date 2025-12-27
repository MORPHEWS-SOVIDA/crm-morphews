import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Secure proxy edge function to serve media files from Supabase Storage.
 * Uses HMAC-signed tokens with short expiration (5 minutes) for security.
 * 
 * Usage: GET /whatsapp-media-proxy?path=<storage_path>&exp=<timestamp>&token=<hmac_signature>
 * 
 * Security:
 * - Token is HMAC-SHA256(path:exp, WHATSAPP_MEDIA_TOKEN_SECRET)
 * - Expires in 5 minutes (300 seconds)
 * - Never exposes storage directly
 * - Path traversal protection (rejects ".." and paths not starting with "orgs/")
 * - Simple in-memory rate limiting per IP
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_MEDIA_TOKEN_SECRET = Deno.env.get("WHATSAPP_MEDIA_TOKEN_SECRET") ?? "";

// ============================================================================
// RATE LIMITING (in-memory, best-effort)
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 100; // max requests per IP per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${ip}`);
    return true;
  }
  
  return false;
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// PATH SECURITY VALIDATION
// ============================================================================

function isPathSafe(path: string): { safe: boolean; reason?: string } {
  // Check for path traversal attempts
  if (path.includes("..")) {
    return { safe: false, reason: "Path traversal detected (..)" };
  }
  
  // Must start with orgs/
  if (!path.startsWith("orgs/")) {
    return { safe: false, reason: "Path must start with orgs/" };
  }
  
  // Check for null bytes
  if (path.includes("\0")) {
    return { safe: false, reason: "Null byte in path" };
  }
  
  // Check for double slashes
  if (path.includes("//")) {
    return { safe: false, reason: "Double slashes in path" };
  }
  
  return { safe: true };
}

const BUCKET_NAME = "whatsapp-media";

// ============================================================================
// HMAC TOKEN VERIFICATION
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
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyToken(path: string, exp: number, token: string): Promise<boolean> {
  if (!WHATSAPP_MEDIA_TOKEN_SECRET) {
    console.error("❌ WHATSAPP_MEDIA_TOKEN_SECRET not configured");
    return false;
  }
  
  // Check expiration first
  const now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    console.error("❌ Token expired:", { exp: new Date(exp * 1000).toISOString(), now: new Date(now * 1000).toISOString() });
    return false;
  }
  
  // Verify signature
  const dataToSign = `${path}:${exp}`;
  const expectedToken = await createHmacSignature(dataToSign, WHATSAPP_MEDIA_TOKEN_SECRET);
  
  // Constant-time comparison to prevent timing attacks
  if (expectedToken.length !== token.length) {
    console.error("❌ Invalid token (length mismatch)");
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < expectedToken.length; i++) {
    result |= expectedToken.charCodeAt(i) ^ token.charCodeAt(i);
  }
  
  if (result !== 0) {
    console.error("❌ Invalid token signature");
    return false;
  }
  
  console.log("✅ Token verified:", { path, expiresAt: new Date(exp * 1000).toISOString() });
  return true;
}

// ============================================================================
// LEGACY TOKEN SUPPORT (database-based tokens for backwards compatibility)
// ============================================================================

async function verifyLegacyToken(token: string, supabaseAdmin: any): Promise<{
  object_path: string;
  content_type: string;
} | null> {
  // Legacy tokens are UUIDs stored in whatsapp_media_tokens table
  if (!token.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return null;
  }
  
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

  console.log("✅ Legacy token verified:", tokenData.object_path);
  return {
    object_path: tokenData.object_path,
    content_type: tokenData.content_type,
  };
}

// ============================================================================
// MIME TYPE DETECTION
// ============================================================================

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    // Audio
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'm4a': 'audio/mp4',
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().split('-')[0];
  console.log(`\n========== [${requestId}] WHATSAPP MEDIA PROXY ==========`);

  // Get client IP for rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || req.headers.get("x-real-ip") 
    || "unknown";

  // Rate limiting check
  if (isRateLimited(clientIp)) {
    console.error(`[${requestId}] ❌ Rate limit exceeded for IP: ${clientIp}`);
    return new Response(
      JSON.stringify({ error: "Too many requests" }), 
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  try {
    const url = new URL(req.url);
    
    // New format: ?path=...&exp=...&token=...
    const path = url.searchParams.get("path");
    const expStr = url.searchParams.get("exp");
    const token = url.searchParams.get("token");
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let objectPath: string;
    let contentType: string;

    // Check if using new HMAC token format
    if (path && expStr && token) {
      console.log(`[${requestId}] Processing HMAC token request`, { ip: clientIp });
      
      // Validate path is not empty
      if (!path.trim()) {
        console.error(`[${requestId}] ❌ Empty path parameter`);
        return new Response(
          JSON.stringify({ error: "Path cannot be empty" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Security: validate path safety
      const pathCheck = isPathSafe(path);
      if (!pathCheck.safe) {
        console.error(`[${requestId}] ❌ Unsafe path rejected:`, pathCheck.reason);
        return new Response(
          JSON.stringify({ error: "Invalid path" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const exp = parseInt(expStr, 10);
      if (isNaN(exp)) {
        console.error(`[${requestId}] ❌ Invalid exp parameter`);
        return new Response(
          JSON.stringify({ error: "Invalid expiration" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const isValid = await verifyToken(path, exp, token);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }), 
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      objectPath = path;
      contentType = getMimeType(path);
      
    } else if (token && !path && !expStr) {
      // Legacy format: ?token=<uuid> (database-based)
      console.log(`[${requestId}] Processing legacy token request`, { ip: clientIp });
      
      const legacyData = await verifyLegacyToken(token, supabaseAdmin);
      if (!legacyData) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }), 
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      objectPath = legacyData.object_path;
      contentType = legacyData.content_type;
      
    } else {
      console.error(`[${requestId}] ❌ Missing required parameters`);
      return new Response(
        JSON.stringify({ error: "Missing token parameters" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download file from storage using SERVICE ROLE
    console.log(`[${requestId}] Downloading from storage:`, { bucket: BUCKET_NAME, path: objectPath });
    
    const { data: fileData, error: fileError } = await supabaseAdmin
      .storage
      .from(BUCKET_NAME)
      .download(objectPath);

    if (fileError || !fileData) {
      console.error(`[${requestId}] ❌ File download error:`, fileError);
      return new Response(
        JSON.stringify({ error: "File not found" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] ✅ Serving file:`, { 
      path: objectPath, 
      contentType, 
      size: fileData.size,
      ip: clientIp
    });
    
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60", // Short cache, private
        "Content-Disposition": "inline",
      },
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Public sale status endpoint for PIX payment verification.
 * Supports both storefront checkouts and standalone checkouts.
 * 
 * GET /functions/v1/ecommerce-sale-status?sale_id=...&storefront_slug=...
 * 
 * For standalone checkouts, pass storefront_slug=_standalone
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const saleId = url.searchParams.get("sale_id");
    const storefrontSlug = url.searchParams.get("storefront_slug");

    if (!saleId) {
      return new Response(JSON.stringify({ success: false, error: "Missing sale_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For standalone checkouts, we just fetch the sale directly
    const isStandalone = !storefrontSlug || storefrontSlug === "_standalone";

    if (isStandalone) {
      // Standalone checkout - fetch sale directly
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("id, organization_id, status, payment_status, total_cents, updated_at")
        .eq("id", saleId)
        .maybeSingle();

      if (saleError) {
        console.error("[ecommerce-sale-status] DB error:", saleError);
        return new Response(JSON.stringify({ success: false, error: "Database error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!sale) {
        return new Response(JSON.stringify({ success: false, error: "Sale not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[ecommerce-sale-status] Standalone sale ${saleId}: payment_status=${sale.payment_status}`);

      return new Response(JSON.stringify({ success: true, sale }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Storefront checkout - verify organization match
    const { data: storefront } = await supabase
      .from("tenant_storefronts")
      .select("organization_id")
      .eq("slug", storefrontSlug)
      .maybeSingle();

    if (!storefront?.organization_id) {
      return new Response(JSON.stringify({ success: false, error: "Storefront not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sale } = await supabase
      .from("sales")
      .select("id, organization_id, status, payment_status, total_cents, updated_at")
      .eq("id", saleId)
      .maybeSingle();

    if (!sale || sale.organization_id !== storefront.organization_id) {
      return new Response(JSON.stringify({ success: false, error: "Sale not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ecommerce-sale-status] Storefront sale ${saleId}: payment_status=${sale.payment_status}`);

    return new Response(JSON.stringify({ success: true, sale }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ecommerce-sale-status] Error:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

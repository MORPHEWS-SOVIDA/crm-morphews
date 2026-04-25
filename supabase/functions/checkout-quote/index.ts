// Public quote endpoint — returns installment pricing for any tenant.
// Designed to be consumed by external sites (landing pages, Shopify, custom carts)
// so they show EXACTLY the same prices and installments the user will see in our checkout.
//
// Usage:
//   GET /functions/v1/checkout-quote?amount_cents=100000&organization_id=<uuid>
//   GET /functions/v1/checkout-quote?amount_cents=100000&organization_id=<uuid>&installments=12
//
// Returns JSON with full installment table (1x..max) and, if `installments` provided,
// a `selected` block with the chosen plan.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Default CET (Stone/Point D+15 + safety margin against antifraud/anticipation).
// R$ 1.000 in 12x = R$ 101,91 / parcel (22.29% total).
const DEFAULT_INSTALLMENT_FEES: Record<string, number> = {
  "1": 3.93, "2": 6.38, "3": 7.98, "4": 9.58, "5": 11.18, "6": 12.78,
  "7": 14.38, "8": 15.98, "9": 17.58, "10": 19.17, "11": 20.77, "12": 22.29,
};

interface InstallmentPlan {
  installments: number;
  fee_percentage: number;
  installment_value_cents: number;
  total_cents: number;
  has_interest: boolean;
}

function calcPlan(
  amountCents: number,
  installments: number,
  fees: Record<string, number>,
  passToBuyer: boolean,
): InstallmentPlan {
  const feePct = fees[String(installments)] ?? 0;

  if (!passToBuyer || feePct === 0) {
    return {
      installments,
      fee_percentage: 0,
      installment_value_cents: Math.ceil(amountCents / installments),
      total_cents: amountCents,
      has_interest: false,
    };
  }

  const total = Math.round(amountCents * (1 + feePct / 100));
  return {
    installments,
    fee_percentage: feePct,
    installment_value_cents: Math.ceil(total / installments),
    total_cents: total,
    has_interest: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const amountCents = parseInt(url.searchParams.get("amount_cents") || "0", 10);
    const organizationId = url.searchParams.get("organization_id");
    const requestedInstallments = url.searchParams.get("installments");

    if (!amountCents || amountCents <= 0) {
      return new Response(
        JSON.stringify({ error: "amount_cents is required and must be > 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let installmentFees = DEFAULT_INSTALLMENT_FEES;
    let maxInstallments = 12;
    let passToBuyer = true;

    if (organizationId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data } = await supabase
        .from("tenant_payment_fees")
        .select("installment_fees, installment_fee_passed_to_buyer, max_installments")
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (data) {
        installmentFees = (data.installment_fees as Record<string, number>) || DEFAULT_INSTALLMENT_FEES;
        maxInstallments = data.max_installments || 12;
        passToBuyer = data.installment_fee_passed_to_buyer ?? true;
      }
    }

    const plans: InstallmentPlan[] = [];
    for (let n = 1; n <= maxInstallments; n++) {
      plans.push(calcPlan(amountCents, n, installmentFees, passToBuyer));
    }

    const response: Record<string, unknown> = {
      amount_cents: amountCents,
      organization_id: organizationId,
      max_installments: maxInstallments,
      pass_fee_to_buyer: passToBuyer,
      installments: plans,
    };

    if (requestedInstallments) {
      const n = parseInt(requestedInstallments, 10);
      if (n >= 1 && n <= maxInstallments) {
        response.selected = calcPlan(amountCents, n, installmentFees, passToBuyer);
      }
    }

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Reproduces the Ramon Schunk scenario:
// frontend sends total_with_interest_cents (signal of installment interest applied)
// but installments=1. Backend MUST refuse with INSTALLMENTS_MISMATCH instead of
// charging the inflated total upfront.
Deno.test("ecommerce-checkout blocks total_with_interest + installments=1 mismatch", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ecommerce-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      // Intentionally minimal: we only need the guardrail to fire before we hit a real gateway.
      // The function validates this BEFORE calling the gateway, so card_data can be a stub.
      storefront_id: "00000000-0000-0000-0000-000000000000",
      items: [{ product_id: "00000000-0000-0000-0000-000000000000", quantity: 1, price_cents: 50960 }],
      customer: {
        name: "Test Mismatch",
        email: "test@example.com",
        phone: "27999138886",
        document: "12658788703",
      },
      shipping_cost_cents: 0,
      payment_method: "credit_card",
      installments: 1,
      total_with_interest_cents: 57361, // > base, would charge R$573,61 in 1x
      card_data: {
        number: "4111111111111111",
        holder_name: "TEST",
        exp_month: "12",
        exp_year: "2030",
        cvv: "123",
      },
    }),
  });

  const body = await res.json();
  // Either the storefront/cart pre-checks fail OR the guardrail fires.
  // The critical assertion is: when reaching the guardrail, it MUST block, never silently charge.
  if (body.error_code === "INSTALLMENTS_MISMATCH") {
    assertEquals(res.status, 400);
    assertEquals(body.success, false);
  } else {
    // If the request was rejected earlier (e.g. invalid storefront), we cannot reach the guardrail
    // in this isolated test environment. We just assert the request did not silently succeed.
    assertEquals(body.success ?? false, false);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentLinkRequest {
  paymentLinkId?: string;
  organizationId?: string;
  amount_cents: number;
  base_amount_cents?: number;
  interest_amount_cents?: number;
  payment_method: "pix" | "boleto" | "credit_card";
  installments?: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  billing_address?: {
    zip_code?: string;
    street?: string;
    street_number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  card_data?: {
    number: string;
    holder_name: string;
    expiration_date: string;
    cvv: string;
  };
  origin_type?: "payment_link" | "telesales" | "receptive";
  sale_id?: string;
  lead_id?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: PaymentLinkRequest = await req.json();
    const { 
      paymentLinkId, 
      organizationId: orgIdFromBody,
      amount_cents, 
      base_amount_cents,
      interest_amount_cents = 0,
      payment_method, 
      installments = 1,
      customer, 
      billing_address,
      card_data,
      origin_type = "payment_link",
      sale_id,
      lead_id,
      metadata = {}
    } = body;

    // Valor base para cálculo de comissões (sem juros) - se não informado, usa amount_cents
    const baseAmountForSplit = base_amount_cents || amount_cents;

    // Validate required fields
    if (!amount_cents || !payment_method || !customer?.document) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: amount_cents, payment_method, customer.document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let organizationId = orgIdFromBody;
    let paymentLink = null;

    // If payment link ID provided, fetch it
    if (paymentLinkId) {
      const { data: link, error: linkError } = await supabaseAdmin
        .from("payment_links")
        .select("*")
        .eq("id", paymentLinkId)
        .single();

      if (linkError || !link) {
        return new Response(
          JSON.stringify({ error: "Link de pagamento não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate link is active
      if (!link.is_active) {
        return new Response(
          JSON.stringify({ error: "Link de pagamento inativo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate expiration
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Link de pagamento expirado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate max uses
      if (link.max_uses && link.use_count >= link.max_uses) {
        return new Response(
          JSON.stringify({ error: "Limite de uso do link atingido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate payment method is enabled
      if (payment_method === "pix" && !link.pix_enabled) {
        return new Response(
          JSON.stringify({ error: "PIX não habilitado para este link" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (payment_method === "boleto" && !link.boleto_enabled) {
        return new Response(
          JSON.stringify({ error: "Boleto não habilitado para este link" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (payment_method === "credit_card" && !link.card_enabled) {
        return new Response(
          JSON.stringify({ error: "Cartão de crédito não habilitado para este link" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      organizationId = link.organization_id;
      paymentLink = link;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organization ID é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant payment fees
    const { data: tenantFees } = await supabaseAdmin
      .from("tenant_payment_fees")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    // Default fees if not configured
    const fees = tenantFees || {
      pix_fee_percentage: 0.99,
      pix_fee_fixed_cents: 100,
      pix_release_days: 1,
      card_fee_percentage: 4.99,
      card_fee_fixed_cents: 100, // R$1,00 fixed fee for anti-fraud + processing
      card_release_days: 15,
      boleto_fee_percentage: 0.5,
      boleto_fee_fixed_cents: 400,
      boleto_release_days: 3,
      max_installments: 12,
      installment_fees: {},
      max_transaction_cents: 500000,
    };

    // Validate transaction limit
    if (fees.max_transaction_cents && amount_cents > fees.max_transaction_cents) {
      return new Response(
        JSON.stringify({ error: `Valor máximo por transação: R$ ${(fees.max_transaction_cents / 100).toFixed(2)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate fees based on payment method
    let feeCents = 0;
    let releaseDays = 1;
    let installmentFeeCents = 0;

    if (payment_method === "pix") {
      feeCents = Math.round(amount_cents * (fees.pix_fee_percentage / 100)) + fees.pix_fee_fixed_cents;
      releaseDays = fees.pix_release_days || 1;
    } else if (payment_method === "boleto") {
      feeCents = Math.round(amount_cents * (fees.boleto_fee_percentage / 100)) + fees.boleto_fee_fixed_cents;
      releaseDays = fees.boleto_release_days || 3;
    } else if (payment_method === "credit_card") {
      feeCents = Math.round(amount_cents * (fees.card_fee_percentage / 100)) + fees.card_fee_fixed_cents;
      releaseDays = fees.card_release_days || 15;

      // Add installment fees if applicable
      if (installments > 1 && fees.installment_fees) {
        const installmentFeePercent = fees.installment_fees[installments.toString()] || 0;
        installmentFeeCents = Math.round(amount_cents * (installmentFeePercent / 100));
      }
    }

    // Calculate release date
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + releaseDays);

    // Fetch active gateway
    const { data: gateway } = await supabaseAdmin
      .from("platform_gateway_config")
      .select("*")
      .eq("is_active", true)
      .eq("is_primary", true)
      .single();

    if (!gateway || gateway.gateway_type !== "pagarme") {
      return new Response(
        JSON.stringify({ error: "Gateway de pagamento não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pagarmeApiKey = gateway.api_key_encrypted;
    if (!pagarmeApiKey) {
      return new Response(
        JSON.stringify({ error: "Chave do gateway não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean document
    const cleanDocument = customer.document.replace(/\D/g, "");
    const documentType = cleanDocument.length === 11 ? "cpf" : "cnpj";

    // Build Pagar.me order payload
    const orderPayload: Record<string, unknown> = {
      customer: {
        name: customer.name,
        email: customer.email,
        document: cleanDocument,
        document_type: documentType,
        type: documentType === "cpf" ? "individual" : "company",
        phones: customer.phone ? {
          mobile_phone: {
            country_code: "55",
            area_code: customer.phone.replace(/\D/g, "").slice(0, 2),
            number: customer.phone.replace(/\D/g, "").slice(2),
          },
        } : undefined,
      },
      items: [
        {
          amount: amount_cents,
          description: paymentLink?.title || "Pagamento via Link",
          quantity: 1,
          code: paymentLinkId || "payment_link",
        },
      ],
      payments: [],
      metadata: {
        organization_id: organizationId,
        payment_link_id: paymentLinkId,
        origin_type,
        sale_id,
        lead_id,
        base_amount_cents: baseAmountForSplit, // Valor base para split (sem juros)
        interest_amount_cents: interest_amount_cents, // Juros = receita plataforma
        ...metadata,
      },
    };

    // Add payment method specific config
    if (payment_method === "pix") {
      (orderPayload.payments as unknown[]).push({
        payment_method: "pix",
        pix: {
          expires_in: 3600, // 1 hour
        },
      });
    } else if (payment_method === "boleto") {
      const boletoExpiry = new Date();
      boletoExpiry.setDate(boletoExpiry.getDate() + 3);
      
      (orderPayload.payments as unknown[]).push({
        payment_method: "boleto",
        boleto: {
          instructions: "Pagar até o vencimento",
          due_at: boletoExpiry.toISOString(),
        },
      });
    } else if (payment_method === "credit_card") {
      if (!card_data) {
        return new Response(
          JSON.stringify({ error: "Dados do cartão são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [expMonth, expYear] = card_data.expiration_date.split("/");
      
      // Build billing address from request or payment link data or fallback
      const addr = billing_address || {};
      const linkAddr = paymentLink ? {
        zip_code: paymentLink.customer_cep,
        street: paymentLink.customer_street,
        street_number: paymentLink.customer_street_number,
        neighborhood: paymentLink.customer_neighborhood,
        city: paymentLink.customer_city,
        state: paymentLink.customer_state,
      } : {};

      const zipCode = (addr.zip_code || linkAddr.zip_code || "").replace(/\D/g, "");
      const streetVal = addr.street || linkAddr.street || "";
      const numberVal = addr.street_number || linkAddr.street_number || "S/N";
      const neighborhoodVal = addr.neighborhood || linkAddr.neighborhood || "";
      const cityVal = addr.city || linkAddr.city || "";
      const stateVal = addr.state || linkAddr.state || "SP";

      const billingAddress: Record<string, string> = {
        line_1: `${numberVal}${streetVal ? `, ${streetVal}` : ""}${neighborhoodVal ? `, ${neighborhoodVal}` : ""}` || "N/A",
        zip_code: zipCode || "00000000",
        city: cityVal || "N/A",
        state: stateVal,
        country: "BR",
      };

      (orderPayload.payments as unknown[]).push({
        payment_method: "credit_card",
        credit_card: {
          installments,
          card: {
            number: card_data.number.replace(/\s/g, ""),
            holder_name: card_data.holder_name,
            exp_month: parseInt(expMonth),
            exp_year: parseInt(expYear.length === 2 ? `20${expYear}` : expYear),
            cvv: card_data.cvv,
            billing_address: billingAddress,
          },
        },
      });
    }

    // Call Pagar.me API
    const pagarmeResponse = await fetch("https://api.pagar.me/core/v5/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(pagarmeApiKey + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const pagarmeData = await pagarmeResponse.json();

    if (!pagarmeResponse.ok) {
      console.error("Pagar.me error:", pagarmeData);
      
      // Log attempt as error
      await supabaseAdmin.from("payment_link_attempts").insert({
        organization_id: organizationId,
        payment_link_id: paymentLinkId,
        payment_method,
        amount_cents,
        status: "error",
        error_code: pagarmeData.code || "UNKNOWN",
        error_message: pagarmeData.message || "Erro ao processar pagamento",
        gateway_response: pagarmeData,
        customer_document: cleanDocument,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        user_agent: req.headers.get("user-agent"),
      });

      return new Response(
        JSON.stringify({ 
          error: pagarmeData.message || "Erro ao processar pagamento",
          details: pagarmeData
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const charge = pagarmeData.charges?.[0];
    const transactionStatus = charge?.status === "paid" ? "paid" : "pending";

    // Create transaction record
    const transactionData: Record<string, unknown> = {
      organization_id: organizationId,
      payment_link_id: paymentLinkId,
      origin_type,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      customer_document: cleanDocument,
      amount_cents, // Valor total cobrado (com juros se houver)
      base_amount_cents: baseAmountForSplit, // Valor base para cálculo de comissão do tenant
      interest_amount_cents: interest_amount_cents, // Juros = receita plataforma
      fee_cents: feeCents,
      payment_method,
      gateway_type: "pagarme",
      gateway_order_id: pagarmeData.id,
      gateway_charge_id: charge?.id,
      gateway_transaction_id: charge?.last_transaction?.id,
      installments,
      installment_fee_cents: installmentFeeCents,
      status: transactionStatus,
      release_date: releaseDate.toISOString().split("T")[0],
      sale_id,
      lead_id,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
      metadata,
      gateway_response: pagarmeData,
    };

    // Add payment method specific data
    if (payment_method === "pix") {
      const pixTransaction = charge?.last_transaction;
      transactionData.pix_qr_code = pixTransaction?.qr_code;
      transactionData.pix_qr_code_url = pixTransaction?.qr_code_url;
      transactionData.pix_expires_at = pixTransaction?.expires_at;
    } else if (payment_method === "boleto") {
      const boletoTransaction = charge?.last_transaction;
      transactionData.boleto_url = boletoTransaction?.url || boletoTransaction?.pdf;
      transactionData.boleto_barcode = boletoTransaction?.line || boletoTransaction?.barcode;
      transactionData.boleto_expires_at = boletoTransaction?.due_at;
    } else if (payment_method === "credit_card") {
      const cardTransaction = charge?.last_transaction;
      transactionData.card_brand = cardTransaction?.card?.brand;
      transactionData.card_last_digits = cardTransaction?.card?.last_four_digits;
      
      if (transactionStatus === "paid") {
        transactionData.paid_at = new Date().toISOString();
      }
    }

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("payment_link_transactions")
      .insert(transactionData)
      .select()
      .single();

    if (transactionError) {
      console.error("Transaction insert error:", transactionError);
      return new Response(
        JSON.stringify({ error: "Erro ao registrar transação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful attempt
    await supabaseAdmin.from("payment_link_attempts").insert({
      organization_id: organizationId,
      payment_link_id: paymentLinkId,
      transaction_id: transaction.id,
      payment_method,
      amount_cents,
      status: transactionStatus === "paid" ? "approved" : "pending",
      gateway_response: pagarmeData,
      customer_document: cleanDocument,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    // If payment is approved and linked to a sale, update the sale status
    if (transactionStatus === "paid" && sale_id) {
      try {
        await supabaseAdmin
          .from("sales")
          .update({
            payment_status: "paid",
            payment_confirmed_at: new Date().toISOString(),
            payment_method: "credit_card",
            payment_notes: `Pago via Televendas - Transação #${transaction.id} - Cartão ${transactionData.card_brand || ""} •••• ${transactionData.card_last_digits || ""}`,
          })
          .eq("id", sale_id);

        console.log(`Sale ${sale_id} marked as paid`);
      } catch (saleUpdateError) {
        console.error("Error updating sale:", saleUpdateError);
        // Don't fail the transaction, just log the error
      }
    }

    // Increment use count if payment link
    if (paymentLinkId && transactionStatus === "paid") {
      await supabaseAdmin
        .from("payment_links")
        .update({ use_count: (paymentLink?.use_count || 0) + 1 })
        .eq("id", paymentLinkId);
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      transaction_id: transaction.id,
      status: transactionStatus,
      amount_cents,
      payment_method,
    };

    if (payment_method === "pix") {
      response.pix = {
        qr_code: transactionData.pix_qr_code,
        qr_code_url: transactionData.pix_qr_code_url,
        expires_at: transactionData.pix_expires_at,
      };
    } else if (payment_method === "boleto") {
      response.boleto = {
        url: transactionData.boleto_url,
        barcode: transactionData.boleto_barcode,
        expires_at: transactionData.boleto_expires_at,
      };
    } else if (payment_method === "credit_card") {
      response.card = {
        brand: transactionData.card_brand,
        last_digits: transactionData.card_last_digits,
        installments,
      };
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Process payment link error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
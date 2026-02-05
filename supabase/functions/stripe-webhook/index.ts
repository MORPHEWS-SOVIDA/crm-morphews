import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Interface para dados de conciliação extraídos do Stripe
interface StripeReconciliationData {
  transactionId: string;
  chargeId: string;
  balanceTransactionId: string | null;
  feeCents: number;
  netAmountCents: number;
  grossAmountCents: number;
  availableOn: string | null;
  cardBrand: string | null;
  cardLastDigits: string | null;
  paymentMethod: string;
  receiptUrl: string | null;
}

// Extrai dados de conciliação do Stripe
async function extractStripeReconciliationData(
  paymentIntent: Stripe.PaymentIntent
): Promise<StripeReconciliationData> {
  let feeCents = 0;
  let netAmountCents = paymentIntent.amount;
  let availableOn: string | null = null;
  let balanceTransactionId: string | null = null;

  // Busca balance_transaction para obter fee e available_on
  const chargeId = paymentIntent.latest_charge as string;
  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ['balance_transaction'],
      });

      if (charge.balance_transaction && typeof charge.balance_transaction === 'object') {
        const bt = charge.balance_transaction as Stripe.BalanceTransaction;
        balanceTransactionId = bt.id;
        feeCents = bt.fee;
        netAmountCents = bt.net;
        availableOn = new Date(bt.available_on * 1000).toISOString();
      }
    } catch (err) {
      console.error('Error fetching charge details:', err);
    }
  }

  // Dados do cartão
  const paymentMethodDetails = paymentIntent.payment_method as string;
  let cardBrand: string | null = null;
  let cardLastDigits: string | null = null;
  let receiptUrl: string | null = null;

  if (chargeId) {
    try {
      const charge = await stripe.charges.retrieve(chargeId);
      cardBrand = charge.payment_method_details?.card?.brand || null;
      cardLastDigits = charge.payment_method_details?.card?.last4 || null;
      receiptUrl = charge.receipt_url || null;
    } catch (err) {
      console.error('Error fetching card details:', err);
    }
  }

  return {
    transactionId: paymentIntent.id,
    chargeId: chargeId || '',
    balanceTransactionId,
    feeCents,
    netAmountCents,
    grossAmountCents: paymentIntent.amount,
    availableOn,
    cardBrand: cardBrand?.toUpperCase() || null,
    cardLastDigits,
    paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
    receiptUrl,
  };
}

// Mapeia bandeira do cartão para o enum do banco
function mapCardBrand(brand: string | null): string | null {
  if (!brand) return null;
  
  const brandMap: Record<string, string> = {
    'VISA': 'visa',
    'MASTERCARD': 'mastercard',
    'AMEX': 'amex',
    'DISCOVER': 'discover',
    'DINERS': 'diners',
    'JCB': 'jcb',
  };
  
  return brandMap[brand.toUpperCase()] || brand.toLowerCase();
}

// Generate a random password
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Normalize Brazilian phone to always have 55 + DD + 9 + 8 digits
function normalizeWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  let clean = phone.replace(/\D/g, '');
  if (!clean) return null;
  
  if (!clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  if (clean.length === 12 && clean.startsWith('55')) {
    clean = clean.slice(0, 4) + '9' + clean.slice(4);
  }
  
  return clean;
}

serve(async (req) => {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    if (!signature) {
      console.error("No stripe-signature header");
      return new Response("No signature", { status: 400 });
    }

    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("Processing event:", event.type);

  try {
    switch (event.type) {
      // ============================================
      // EVENTOS DE PAGAMENTO E-COMMERCE
      // ============================================
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const saleId = paymentIntent.metadata?.sale_id;

        if (!saleId) {
          console.log("No sale_id in metadata, checking for subscription flow");
          break;
        }

        console.log("Payment succeeded for sale:", saleId);

        // Extrai dados de conciliação
        const reconciliation = await extractStripeReconciliationData(paymentIntent);
        console.log("Stripe reconciliation data:", JSON.stringify(reconciliation));

        // Update sale with reconciliation data
        await supabaseAdmin
          .from('sales')
          .update({
            status: 'payment_confirmed',
            payment_status: 'paid',
            gateway_transaction_id: reconciliation.transactionId,
            gateway_fee_cents: reconciliation.feeCents,
            gateway_net_cents: reconciliation.netAmountCents,
          })
          .eq('id', saleId);

        // Log payment attempt with full reconciliation
        await supabaseAdmin
          .from('payment_attempts')
          .insert({
            sale_id: saleId,
            gateway: 'stripe',
            payment_method: reconciliation.paymentMethod,
            amount_cents: reconciliation.grossAmountCents,
            status: 'approved',
            gateway_transaction_id: reconciliation.transactionId,
            gateway_response: {
              raw: paymentIntent,
              reconciliation: {
                charge_id: reconciliation.chargeId,
                balance_transaction_id: reconciliation.balanceTransactionId,
                fee_cents: reconciliation.feeCents,
                net_amount_cents: reconciliation.netAmountCents,
                available_on: reconciliation.availableOn,
                card_brand: reconciliation.cardBrand,
                card_last_digits: reconciliation.cardLastDigits,
                receipt_url: reconciliation.receiptUrl,
              },
            },
          });

        // Create sale installment with reconciliation
        await createStripeInstallment(saleId, reconciliation);

        // Process splits
        await processStripePaymentSplits(saleId, reconciliation);

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const saleId = paymentIntent.metadata?.sale_id;

        if (saleId) {
          const error = paymentIntent.last_payment_error;
          
          await supabaseAdmin
            .from('sales')
            .update({
              payment_status: 'failed',
            })
            .eq('id', saleId);

          await supabaseAdmin
            .from('payment_attempts')
            .insert({
              sale_id: saleId,
              gateway: 'stripe',
              payment_method: paymentIntent.payment_method_types?.[0] || 'card',
              amount_cents: paymentIntent.amount,
              status: 'refused',
              gateway_transaction_id: paymentIntent.id,
              error_code: error?.code || 'payment_failed',
              error_message: error?.message || 'Payment failed',
              gateway_response: { raw: paymentIntent },
            });
        }
        break;
      }

      // ============================================
      // EVENTOS DE ASSINATURA (BILLING)
      // ============================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // ============================================
        // SMS CREDITS PURCHASE
        // ============================================
        if (session.metadata?.type === "sms_credits") {
          const packageId = session.metadata.package_id;
          const smsCount = parseInt(session.metadata.sms_count || "0", 10);
          const priceCents = parseInt(session.metadata.price_cents || "0", 10);
          const organizationId = session.metadata.organization_id;
          const userId = session.metadata.user_id;

          console.log("SMS credits purchase completed:", { 
            packageId, 
            smsCount, 
            priceCents, 
            organizationId 
          });

          if (organizationId && smsCount > 0) {
            try {
              // Create purchase record
              await supabaseAdmin.from("sms_credits_purchases").insert({
                organization_id: organizationId,
                package_id: packageId,
                credits_amount: smsCount,
                price_cents: priceCents,
                payment_method: "stripe",
                payment_reference: session.payment_intent as string || session.id,
                purchased_by: userId,
              });

              // Add credits via RPC
              const { error: rpcError } = await supabaseAdmin.rpc("add_sms_credits", {
                p_organization_id: organizationId,
                p_credits_to_add: smsCount,
              });

              if (rpcError) {
                console.error("Error adding SMS credits:", rpcError);
              } else {
                console.log(`Successfully added ${smsCount} SMS credits to org ${organizationId}`);
              }
            } catch (smsError) {
              console.error("Error processing SMS credits:", smsError);
            }
          }
          break;
        }

        // ============================================
        // VOICE AI MINUTES PURCHASE
        // ============================================
        if (session.metadata?.type === "voice_minutes") {
          const packageId = session.metadata.package_id;
          const minutes = parseInt(session.metadata.minutes || "0", 10);
          const priceCents = parseInt(session.metadata.price_cents || "0", 10);
          const organizationId = session.metadata.organization_id;
          const userId = session.metadata.user_id;

          console.log("Voice AI minutes purchase completed:", { 
            packageId, 
            minutes, 
            priceCents, 
            organizationId 
          });

          if (organizationId && minutes > 0) {
            try {
              // Create purchase record
              await supabaseAdmin.from("voice_minutes_purchases").insert({
                organization_id: organizationId,
                package_id: packageId,
                minutes_amount: minutes,
                price_cents: priceCents,
                payment_method: "stripe",
                payment_reference: session.payment_intent as string || session.id,
                purchased_by: userId,
              });

              // Add minutes via RPC
              const { error: rpcError } = await supabaseAdmin.rpc("add_voice_minutes", {
                p_organization_id: organizationId,
                p_minutes: minutes,
              });

              if (rpcError) {
                console.error("Error adding voice minutes:", rpcError);
              } else {
                console.log(`Successfully added ${minutes} voice minutes to org ${organizationId}`);
              }
            } catch (voiceError) {
              console.error("Error processing voice minutes:", voiceError);
            }
          }
          break;
        }

        // Check if this is an e-commerce checkout (has sale_id)
        if (session.metadata?.sale_id) {
          const saleId = session.metadata.sale_id;
          console.log("E-commerce checkout completed for sale:", saleId);

          // Get payment intent for reconciliation
          if (session.payment_intent) {
            const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
            const reconciliation = await extractStripeReconciliationData(paymentIntent);

            await supabaseAdmin
              .from('sales')
              .update({
                status: 'payment_confirmed',
                payment_status: 'paid',
                gateway_transaction_id: reconciliation.transactionId,
                gateway_fee_cents: reconciliation.feeCents,
                gateway_net_cents: reconciliation.netAmountCents,
              })
              .eq('id', saleId);

            await createStripeInstallment(saleId, reconciliation);
            await processStripePaymentSplits(saleId, reconciliation);
          }
          break;
        }

        // Subscription checkout flow
        const planId = session.metadata?.plan_id;
        const customerEmail = session.metadata?.customer_email || session.customer_email;
        const customerName = session.metadata?.customer_name || "";
        const customerWhatsapp = session.metadata?.customer_whatsapp || "";
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        console.log("Subscription checkout completed:", { planId, customerEmail, customerName });

        if (!planId || !customerEmail) {
          console.error("Missing planId or customerEmail in session");
          break;
        }

        // Get plan details
        const { data: plan } = await supabaseAdmin
          .from("subscription_plans")
          .select("name")
          .eq("id", planId)
          .single();

        const planName = plan?.name || "Morphews CRM";

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === customerEmail);

        let userId: string;
        let tempPassword: string | null = null;

        if (existingUser) {
          console.log("User already exists:", existingUser.id);
          userId = existingUser.id;
        } else {
          tempPassword = generatePassword();
          
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: customerEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              first_name: customerName.split(" ")[0] || "Usuário",
              last_name: customerName.split(" ").slice(1).join(" ") || "",
            },
          });

          if (createError) {
            console.error("Error creating user:", createError);
            throw createError;
          }

          userId = newUser.user.id;
          console.log("New user created:", userId);

          const firstName = customerName.split(" ")[0] || "Usuário";
          const lastName = customerName.split(" ").slice(1).join(" ") || "Novo";

          await supabaseAdmin.from("profiles").upsert({
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            whatsapp: normalizeWhatsApp(customerWhatsapp),
            email: customerEmail,
          }, { onConflict: "user_id" });

          await supabaseAdmin.from("temp_password_resets").insert({
            user_id: userId,
            email: customerEmail,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });

          await supabaseAdmin.from("user_roles").upsert({
            user_id: userId,
            role: "user",
          }, { onConflict: "user_id" });
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("user_id", userId)
          .single();

        let organizationId = profile?.organization_id;

        if (!organizationId) {
          const orgName = customerName ? `${customerName}` : `Organização ${userId.slice(0, 8)}`;
          const orgSlug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || `org-${userId.slice(0, 8)}`;

          const { data: newOrg, error: orgError } = await supabaseAdmin
            .from("organizations")
            .insert({
              name: orgName,
              slug: orgSlug,
              owner_name: customerName || null,
              owner_email: customerEmail,
              phone: customerWhatsapp || null,
            })
            .select()
            .single();

          if (orgError) {
            console.error("Error creating organization:", orgError);
            break;
          }

          organizationId = newOrg.id;
          console.log("Organization created:", organizationId);

          await supabaseAdmin.from("organization_members").insert({
            organization_id: organizationId,
            user_id: userId,
            role: "owner",
          });

          await supabaseAdmin
            .from("profiles")
            .update({ organization_id: organizationId })
            .eq("user_id", userId);
        }

        const { error: subError } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            organization_id: organizationId,
            plan_id: planId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: "active",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }, {
            onConflict: "organization_id",
          });

        if (subError) {
          console.error("Error creating subscription:", subError);
        }

        // ============= IMPLEMENTER COMMISSION PROCESSING =============
        const isImplementerSale = session.metadata?.is_implementer_sale === "true";
        const implementerId = session.metadata?.implementer_id;
        const checkoutLinkId = session.metadata?.checkout_link_id;
        const implementationFeeCents = parseInt(session.metadata?.implementation_fee_cents || "0", 10);

        if (isImplementerSale && implementerId && organizationId) {
          console.log("Processing implementer sale:", { implementerId, implementationFeeCents });

          try {
            // Get the subscription record we just created
            const { data: subscription } = await supabaseAdmin
              .from("subscriptions")
              .select("id")
              .eq("organization_id", organizationId)
              .single();

            // Get plan price for commission calculation
            const { data: planData } = await supabaseAdmin
              .from("subscription_plans")
              .select("price_cents")
              .eq("id", planId)
              .single();

            const planPriceCents = planData?.price_cents || 0;

            // Create implementer_sale record
            const { data: implementerSale, error: saleError } = await supabaseAdmin
              .from("implementer_sales")
              .insert({
                implementer_id: implementerId,
                client_organization_id: organizationId,
                client_subscription_id: subscription?.id || null,
                plan_id: planId,
                implementation_fee_cents: implementationFeeCents,
                first_payment_cents: planPriceCents + implementationFeeCents,
                status: "active",
              })
              .select()
              .single();

            if (saleError) {
              console.error("Error creating implementer sale:", saleError);
            } else {
              console.log("Implementer sale created:", implementerSale.id);

              // Process implementation fee commission (88% to implementer, 12% platform)
              if (implementationFeeCents > 0) {
                const platformFee = Math.round(implementationFeeCents * 0.12);
                const implementerNet = implementationFeeCents - platformFee;

                await supabaseAdmin.from("implementer_commissions").insert({
                  implementer_id: implementerId,
                  implementer_sale_id: implementerSale.id,
                  commission_type: "implementation_fee",
                  gross_amount_cents: implementationFeeCents,
                  platform_fee_cents: platformFee,
                  net_amount_cents: implementerNet,
                  period_month: 1,
                  status: "pending",
                });

                console.log("Implementation fee commission created:", implementerNet);
              }

              // Process first month commission (40% to implementer)
              if (planPriceCents > 0) {
                const firstMonthCommission = Math.round(planPriceCents * 0.40);

                await supabaseAdmin.from("implementer_commissions").insert({
                  implementer_id: implementerId,
                  implementer_sale_id: implementerSale.id,
                  commission_type: "first_month",
                  gross_amount_cents: firstMonthCommission,
                  platform_fee_cents: 0,
                  net_amount_cents: firstMonthCommission,
                  period_month: 1,
                  status: "pending",
                });

                console.log("First month commission created:", firstMonthCommission);
              }

              // Update implementer stats
              const totalCommission = 
                (implementationFeeCents > 0 ? implementationFeeCents - Math.round(implementationFeeCents * 0.12) : 0) +
                Math.round(planPriceCents * 0.40);

              await supabaseAdmin
                .from("implementers")
                .update({
                  total_clients: supabaseAdmin.rpc("increment_counter", { row_id: implementerId, increment_by: 1 }),
                  total_earnings_cents: supabaseAdmin.rpc("increment_counter", { row_id: implementerId, increment_by: totalCommission }),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", implementerId);

              // Simpler update without rpc
              const { data: currentImplementer } = await supabaseAdmin
                .from("implementers")
                .select("total_clients, total_earnings_cents")
                .eq("id", implementerId)
                .single();

              if (currentImplementer) {
                await supabaseAdmin
                  .from("implementers")
                  .update({
                    total_clients: (currentImplementer.total_clients || 0) + 1,
                    total_earnings_cents: (currentImplementer.total_earnings_cents || 0) + totalCommission,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", implementerId);
              }

              // Increment checkout link uses
              if (checkoutLinkId) {
                await supabaseAdmin.rpc("increment_checkout_link_uses", { link_id: checkoutLinkId });
              }
            }
          } catch (implError) {
            console.error("Error processing implementer commissions:", implError);
          }
        }
        // ============= END IMPLEMENTER PROCESSING =============

        await supabaseAdmin
          .from("interested_leads")
          .update({ status: "converted", converted_at: new Date().toISOString() })
          .eq("email", customerEmail);

        console.log("Subscription created/updated successfully");

        if (tempPassword) {
          try {
            const internalSecret = Deno.env.get("INTERNAL_AUTH_SECRET");
            
            const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                "x-internal-secret": internalSecret || "",
              },
              body: JSON.stringify({
                email: customerEmail,
                name: customerName || "Usuário",
                password: tempPassword,
                planName,
              }),
            });

            if (!emailResponse.ok) {
              const errorData = await emailResponse.json();
              console.error("Error sending welcome email:", errorData);
            } else {
              console.log("Welcome email sent successfully");
            }
          } catch (emailError) {
            console.error("Error calling send-welcome-email:", emailError);
          }
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const stripePriceId = subscription.items.data[0]?.price?.id;

        console.log("Subscription updated:", { customerId, stripePriceId, status: subscription.status });

        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id, plan_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (existingSub) {
          let newPlanId = existingSub.plan_id;
          
          if (stripePriceId) {
            const { data: plan } = await supabaseAdmin
              .from("subscription_plans")
              .select("id")
              .eq("stripe_price_id", stripePriceId)
              .single();
            
            if (plan) {
              newPlanId = plan.id;
              console.log("Plan changed to:", newPlanId);
            }
          }

          await supabaseAdmin
            .from("subscriptions")
            .update({
              plan_id: newPlanId,
              status: subscription.status as any,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("id", existingSub.id);

          console.log("Subscription updated in database");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_customer_id", customerId);

        console.log("Subscription canceled");
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;
        
        // Skip first invoice (handled in checkout.session.completed)
        if (invoice.billing_reason === "subscription_create") {
          console.log("Skipping first invoice, already processed in checkout");
          break;
        }

        console.log("Processing recurring invoice:", { customerId, subscriptionId, billingReason: invoice.billing_reason });

        // Find subscription and check for implementer sale
        const { data: internalSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id, organization_id, plan_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!internalSub) {
          console.log("No internal subscription found for:", subscriptionId);
          break;
        }

        // Check if this client has an implementer
        const { data: implementerSale } = await supabaseAdmin
          .from("implementer_sales")
          .select("*, implementer:implementers!implementer_id(*)")
          .eq("client_organization_id", internalSub.organization_id)
          .eq("status", "active")
          .single();

        if (implementerSale) {
          console.log("Found implementer sale:", implementerSale.id);

          // Check if implementer has active subscription
          const { data: implementerSub } = await supabaseAdmin
            .from("subscriptions")
            .select("status")
            .eq("organization_id", implementerSale.implementer.organization_id)
            .eq("status", "active")
            .single();

          if (!implementerSub) {
            console.log("Implementer subscription not active, skipping commission");
            break;
          }

          // Get plan price
          const { data: plan } = await supabaseAdmin
            .from("subscription_plans")
            .select("price_cents")
            .eq("id", internalSub.plan_id)
            .single();

          const planPriceCents = plan?.price_cents || 0;

          if (planPriceCents > 0) {
            // Calculate 10% recurring commission
            const recurringCommission = Math.round(planPriceCents * 0.10);

            // Get the next period month
            const { data: lastCommission } = await supabaseAdmin
              .from("implementer_commissions")
              .select("period_month")
              .eq("implementer_sale_id", implementerSale.id)
              .in("commission_type", ["first_month", "recurring"])
              .order("period_month", { ascending: false })
              .limit(1)
              .single();

            const nextPeriodMonth = (lastCommission?.period_month || 1) + 1;

            // Create recurring commission
            await supabaseAdmin.from("implementer_commissions").insert({
              implementer_id: implementerSale.implementer_id,
              implementer_sale_id: implementerSale.id,
              commission_type: "recurring",
              gross_amount_cents: recurringCommission,
              platform_fee_cents: 0,
              net_amount_cents: recurringCommission,
              period_month: nextPeriodMonth,
              status: "pending",
            });

            // Update implementer totals
            const { data: currentImplementer } = await supabaseAdmin
              .from("implementers")
              .select("total_earnings_cents")
              .eq("id", implementerSale.implementer_id)
              .single();

            if (currentImplementer) {
              await supabaseAdmin
                .from("implementers")
                .update({
                  total_earnings_cents: (currentImplementer.total_earnings_cents || 0) + recurringCommission,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", implementerSale.implementer_id);
            }

            console.log("Recurring commission created:", { 
              amount: recurringCommission, 
              month: nextPeriodMonth 
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);

        console.log("Payment failed, subscription marked as past_due");
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Cria parcela da venda com dados de conciliação do Stripe
async function createStripeInstallment(saleId: string, reconciliation: StripeReconciliationData) {
  const { data: sale } = await supabaseAdmin
    .from('sales')
    .select('organization_id, total_cents')
    .eq('id', saleId)
    .single();

  if (!sale) return;

  const cardBrand = mapCardBrand(reconciliation.cardBrand);
  const transactionDate = new Date();
  const dueDate = reconciliation.availableOn 
    ? new Date(reconciliation.availableOn)
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + 2); // Stripe D+2 standard
        return d;
      })();

  await supabaseAdmin
    .from('sale_installments')
    .insert({
      sale_id: saleId,
      installment_number: 1,
      total_installments: 1,
      amount_cents: reconciliation.grossAmountCents,
      fee_cents: reconciliation.feeCents,
      fee_percentage: reconciliation.feeCents > 0 
        ? Number(((reconciliation.feeCents / reconciliation.grossAmountCents) * 100).toFixed(2))
        : 0,
      net_amount_cents: reconciliation.netAmountCents,
      due_date: dueDate.toISOString().split('T')[0],
      status: 'confirmed',
      transaction_date: transactionDate.toISOString(),
      nsu_cv: reconciliation.chargeId || reconciliation.transactionId,
      card_brand: cardBrand,
      transaction_type: 'credit',
    });

  console.log(`Created Stripe installment for sale ${saleId} with reconciliation data`);
}

// Processa splits para pagamento Stripe
async function processStripePaymentSplits(saleId: string, reconciliation: StripeReconciliationData) {
  const { data: sale } = await supabaseAdmin
    .from('sales')
    .select('id, organization_id, total_cents')
    .eq('id', saleId)
    .single();

  if (!sale) {
    console.error("Sale not found:", saleId);
    return;
  }

  // Fetch platform settings
  const { data: platformSettings } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_key, setting_value');

  const settings = (platformSettings || []).reduce((acc: Record<string, any>, s: any) => {
    acc[s.setting_key] = s.setting_value;
    return acc;
  }, {});

  const platformFees = settings.platform_fees || { percentage: 5.0, fixed_cents: 0 };
  const withdrawalRules = settings.withdrawal_rules || { release_days: 14 };

  const totalCents = sale.total_cents;
  const gatewayFeeCents = reconciliation.feeCents;
  const platformFeeCents = Math.round(totalCents * (platformFees.percentage / 100)) + (platformFees.fixed_cents || 0);

  // Use Stripe's available_on or calculate
  const releaseAt = reconciliation.availableOn 
    ? new Date(reconciliation.availableOn)
    : (() => {
        const date = new Date();
        date.setDate(date.getDate() + (withdrawalRules.release_days || 14));
        return date;
      })();

  // Get tenant virtual account
  let { data: tenantAccount } = await supabaseAdmin
    .from('virtual_accounts')
    .select('id')
    .eq('organization_id', sale.organization_id)
    .eq('account_type', 'tenant')
    .maybeSingle();

  if (!tenantAccount) {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name, email')
      .eq('id', sale.organization_id)
      .single();

    const { data: newAccount } = await supabaseAdmin
      .from('virtual_accounts')
      .insert({
        organization_id: sale.organization_id,
        account_type: 'tenant',
        holder_name: org?.name || 'Tenant',
        holder_email: org?.email || 'tenant@morphews.com',
      })
      .select('id')
      .single();

    tenantAccount = newAccount;
  }

  if (!tenantAccount) {
    console.error("Failed to get or create tenant account");
    return;
  }

  // Check for existing affiliate split
  const { data: existingSplits } = await supabaseAdmin
    .from('sale_splits')
    .select('*')
    .eq('sale_id', saleId);

  let affiliateSplitCents = 0;
  const affiliateSplit = existingSplits?.find((s: any) => s.split_type === 'affiliate');

  if (affiliateSplit) {
    affiliateSplitCents = affiliateSplit.gross_amount_cents;
  }

  const tenantAmount = totalCents - gatewayFeeCents - platformFeeCents - affiliateSplitCents;

  // Create tenant split
  await supabaseAdmin
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id,
      split_type: 'tenant',
      gross_amount_cents: totalCents - affiliateSplitCents,
      fee_cents: gatewayFeeCents + platformFeeCents,
      net_amount_cents: tenantAmount,
      percentage: 100 - (affiliateSplitCents / totalCents * 100),
    });

  // Create tenant transaction
  await supabaseAdmin
    .from('virtual_transactions')
    .insert({
      virtual_account_id: tenantAccount.id,
      sale_id: saleId,
      transaction_type: 'credit',
      amount_cents: tenantAmount,
      fee_cents: gatewayFeeCents + platformFeeCents,
      net_amount_cents: tenantAmount,
      description: `Venda #${saleId.slice(0, 8)} (Stripe - gateway R$${(gatewayFeeCents/100).toFixed(2)} - plataforma R$${(platformFeeCents/100).toFixed(2)})`,
      status: 'pending',
      release_at: releaseAt.toISOString(),
    });

  // Update tenant balance
  const { data: tenantAccountData } = await supabaseAdmin
    .from('virtual_accounts')
    .select('pending_balance_cents, total_received_cents')
    .eq('id', tenantAccount.id)
    .single();

  await supabaseAdmin
    .from('virtual_accounts')
    .update({
      pending_balance_cents: (tenantAccountData?.pending_balance_cents || 0) + tenantAmount,
      total_received_cents: (tenantAccountData?.total_received_cents || 0) + tenantAmount,
    })
    .eq('id', tenantAccount.id);

  // Gateway fee record
  await supabaseAdmin
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id,
      split_type: 'gateway',
      gross_amount_cents: gatewayFeeCents,
      fee_cents: 0,
      net_amount_cents: gatewayFeeCents,
      percentage: (gatewayFeeCents / totalCents) * 100,
    });

  // Platform fee record
  await supabaseAdmin
    .from('sale_splits')
    .insert({
      sale_id: saleId,
      virtual_account_id: tenantAccount.id,
      split_type: 'platform',
      gross_amount_cents: platformFeeCents,
      fee_cents: 0,
      net_amount_cents: platformFeeCents,
      percentage: platformFees.percentage,
    });

  console.log(`Processed Stripe splits for sale ${saleId}: Tenant=${tenantAmount}, Gateway=${gatewayFeeCents}, Platform=${platformFeeCents}`);
}

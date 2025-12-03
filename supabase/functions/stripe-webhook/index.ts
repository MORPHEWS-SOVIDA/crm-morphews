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

// Generate a random password
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
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

    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("Processing event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const planId = session.metadata?.plan_id;
        const customerEmail = session.metadata?.customer_email || session.customer_email;
        const customerName = session.metadata?.customer_name || "";
        const customerWhatsapp = session.metadata?.customer_whatsapp || "";
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        console.log("Checkout completed:", { planId, customerEmail, customerName });

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
          // Create new user with temporary password
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

          // Create profile
          const firstName = customerName.split(" ")[0] || "Usuário";
          const lastName = customerName.split(" ").slice(1).join(" ") || "Novo";

          await supabaseAdmin.from("profiles").upsert({
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            whatsapp: customerWhatsapp || null,
          }, { onConflict: "user_id" });

          // Assign user role
          await supabaseAdmin.from("user_roles").upsert({
            user_id: userId,
            role: "user",
          }, { onConflict: "user_id" });
        }

        // Check if user has an organization
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("organization_id")
          .eq("user_id", userId)
          .single();

        let organizationId = profile?.organization_id;

        // If no organization, create one
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

          // Add user as owner of the organization
          await supabaseAdmin.from("organization_members").insert({
            organization_id: organizationId,
            user_id: userId,
            role: "owner",
          });

          // Update user profile with organization_id
          await supabaseAdmin
            .from("profiles")
            .update({ organization_id: organizationId })
            .eq("user_id", userId);
        }

        // Create or update subscription
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

        // Update interested_leads status
        await supabaseAdmin
          .from("interested_leads")
          .update({ status: "converted", converted_at: new Date().toISOString() })
          .eq("email", customerEmail);

        console.log("Subscription created/updated successfully");

        // Send welcome email with credentials (only for new users)
        if (tempPassword) {
          try {
            const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
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

        // Find subscription by stripe_customer_id
        const { data: existingSub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (existingSub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: subscription.status as any,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("id", existingSub.id);
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

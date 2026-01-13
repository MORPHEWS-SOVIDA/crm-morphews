import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY não configurada');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Usuário não encontrado');
    }

    const { itemType, quantity } = await req.json();

    if (!itemType || !quantity || quantity < 1) {
      throw new Error('itemType e quantity são obrigatórios');
    }

    // Valid item types
    const validTypes = ['extra_users', 'extra_whatsapp_instances', 'extra_energy'];
    if (!validTypes.includes(itemType)) {
      throw new Error(`Tipo inválido. Use: ${validTypes.join(', ')}`);
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      throw new Error('Organização não encontrada');
    }

    // Get existing subscription with plan details
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*, subscription_plans(*)')
      .eq('organization_id', profile.organization_id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      throw new Error('Nenhuma assinatura ativa encontrada');
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      throw new Error('Plano não encontrado');
    }

    // Determine price based on item type
    let priceCents: number;
    let productName: string;
    let updateField: string;
    let currentQuantity: number;

    switch (itemType) {
      case 'extra_users':
        priceCents = plan.extra_user_price_cents || 9700;
        productName = 'Usuário Extra';
        updateField = 'extra_users';
        currentQuantity = subscription.extra_users || 0;
        break;
      case 'extra_whatsapp_instances':
        priceCents = plan.extra_instance_price_cents || 4900;
        productName = 'Instância WhatsApp Extra';
        updateField = 'extra_whatsapp_instances';
        currentQuantity = subscription.extra_whatsapp_instances || 0;
        break;
      case 'extra_energy':
        priceCents = plan.extra_energy_price_cents || 500;
        productName = 'Energia IA (1000 unidades)';
        updateField = 'extra_energy_packs';
        currentQuantity = subscription.extra_energy_packs || 0;
        break;
      default:
        throw new Error('Tipo não suportado');
    }

    console.log(`Adding ${quantity} ${productName} at ${priceCents} cents each`);

    // Get or create the price in Stripe
    const priceIdKey = `stripe_${itemType}_price_id`;
    let stripePriceId = plan[priceIdKey];

    if (!stripePriceId) {
      // Create product and price in Stripe
      const product = await stripe.products.create({
        name: `${productName} - ${plan.name}`,
        metadata: {
          plan_id: plan.id,
          item_type: itemType,
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceCents,
        currency: 'brl',
        recurring: {
          interval: 'month',
        },
        metadata: {
          plan_id: plan.id,
          item_type: itemType,
        },
      });

      stripePriceId = price.id;

      // Save the price ID for future use
      await supabase
        .from('subscription_plans')
        .update({ [priceIdKey]: stripePriceId })
        .eq('id', plan.id);
    }

    // Get current Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    // Check if item already exists in subscription
    const existingItem = stripeSubscription.items.data.find(
      (item: { price: { id: string }, quantity?: number, id: string }) => item.price.id === stripePriceId
    );

    if (existingItem) {
      // Update quantity of existing item
      const newQuantity = (existingItem.quantity || 0) + quantity;
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: newQuantity,
        proration_behavior: 'create_prorations',
      });
    } else {
      // Add new item to subscription
      await stripe.subscriptionItems.create({
        subscription: subscription.stripe_subscription_id,
        price: stripePriceId,
        quantity: quantity,
        proration_behavior: 'create_prorations',
      });
    }

    // Update local subscription record
    const newQuantity = currentQuantity + quantity;
    await supabase
      .from('subscriptions')
      .update({ [updateField]: newQuantity })
      .eq('id', subscription.id);

    // If adding energy, also update the quota
    if (itemType === 'extra_energy') {
      const energyToAdd = quantity * 1000;
      const { data: quota } = await supabase
        .from('energy_quotas')
        .select('bonus_energy')
        .eq('organization_id', profile.organization_id)
        .single();

      const currentBonus = quota?.bonus_energy || 0;
      await supabase
        .from('energy_quotas')
        .upsert({
          organization_id: profile.organization_id,
          bonus_energy: currentBonus + energyToAdd,
        }, { onConflict: 'organization_id' });
    }

    console.log(`Successfully added ${quantity} ${productName}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `${quantity} ${productName}(s) adicionado(s) com sucesso!`,
      newQuantity,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in add-subscription-item:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

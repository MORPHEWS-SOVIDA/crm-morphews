import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CheckoutRequest, PaymentMethod, CardData } from "./types.ts";
import { FallbackEngine } from "./fallback-engine.ts";
import { validateDocument } from "./document-validation.ts";

/**
 * Normalizes Brazilian phone numbers to always include country code 55
 * Input can be: 21987654321, 5521987654321, (21) 98765-4321, etc.
 * Output will always be: 5521987654321 (13 digits) or 5521876543210 (12 digits for landline)
 */
function normalizeBrazilianPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-digits
  const clean = phone.replace(/\D/g, '');
  
  // If already starts with 55 and has 12-13 digits, return as-is
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return clean;
  }
  
  // If has 10-11 digits (local format), prepend 55
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }
  
  // Return cleaned number for edge cases
  return clean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CheckoutRequest = await req.json();
    const { customer, items, payment_method, affiliate_code, coupon_code, coupon_discount_cents, storefront_id, landing_page_id, standalone_checkout_id, offer_id, cart_id, utm } = body;

    // Validate CPF/CNPJ early for credit card payments (gateway requires valid document)
    const docValidation = validateDocument(customer?.document || '');
    if (payment_method === 'credit_card' && !docValidation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: docValidation.message || 'CPF/CNPJ inválido para pagar com cartão.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Determine organization from storefront or landing page
    let organizationId: string | null = null;
    let productItems: { product_id: string; quantity: number; price_cents: number; product_name?: string; product_image_url?: string; is_combo?: boolean; combo_id?: string }[] = items || [];

    // 1a. If cart_id is provided and items are empty, fetch items from cart
    if (cart_id && productItems.length === 0) {
      const { data: cart } = await supabase
        .from('ecommerce_carts')
        .select('items, organization_id, storefront_id')
        .eq('id', cart_id)
        .single();
      
      if (cart?.items && Array.isArray(cart.items)) {
        productItems = cart.items as { product_id: string; quantity: number; price_cents: number }[];
        if (!organizationId) {
          organizationId = cart.organization_id;
        }
      }
    }

    if (storefront_id) {
      const { data: storefront } = await supabase
        .from('tenant_storefronts')
        .select('organization_id')
        .eq('id', storefront_id)
        .single();
      organizationId = storefront?.organization_id;
    } else if (landing_page_id) {
      const { data: landing } = await supabase
        .from('landing_pages')
        .select('organization_id, product_id')
        .eq('id', landing_page_id)
        .single();
      organizationId = landing?.organization_id;

      if (offer_id) {
        const { data: offer } = await supabase
          .from('landing_offers')
          .select('quantity, price_cents')
          .eq('id', offer_id)
          .single();
        
        if (offer && landing) {
          productItems = [{
            product_id: landing.product_id,
            quantity: offer.quantity,
            price_cents: offer.price_cents,
          }];
        }
      }
    } else if (standalone_checkout_id) {
      // Handle standalone checkouts (/pay/:slug)
      const { data: standaloneCheckout } = await supabase
        .from('standalone_checkouts')
        .select('organization_id, product_id')
        .eq('id', standalone_checkout_id)
        .single();
      
      if (standaloneCheckout) {
        organizationId = standaloneCheckout.organization_id;
        console.log(`[Checkout] Standalone checkout ${standalone_checkout_id}: org=${organizationId}`);
      }
    }

    // 1b. Resolve external_product_id aliases FIRST (before enrichment)
    // External sites may send their own product UUIDs that differ from ours
    {
      const { data: aliasMappings } = await supabase
        .from('storefront_products')
        .select('external_product_id, product_id, combo_id, custom_name')
        .in('external_product_id', productItems.map(i => i.product_id).filter(Boolean));
      
      if (aliasMappings && aliasMappings.length > 0) {
        for (const alias of aliasMappings) {
          if (!alias.external_product_id) continue;
          const realId = alias.product_id || alias.combo_id;
          if (realId) {
            console.log(`[Checkout] Resolved external alias ${alias.external_product_id} → ${realId} (${alias.custom_name || 'n/a'})`);
            for (const item of productItems) {
              if (item.product_id === alias.external_product_id) {
                item.product_id = realId;
                if (alias.combo_id) {
                  item.is_combo = true;
                  item.combo_id = alias.combo_id;
                }
              }
            }
          }
        }
      }
    }

    // 1c. Enrich product items with names and images for order_items
    const productIds = productItems.map(i => i.product_id).filter(Boolean);
    const productMap: Record<string, { name: string; image_url?: string }> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('lead_products')
        .select('id, name, image_url')
        .in('id', productIds);
      
      if (products) {
        for (const p of products) {
          productMap[p.id] = { name: p.name, image_url: p.image_url };
        }
      }

      // If some product_ids were NOT found in lead_products, try as product_combos first
      const unresolvedIds = productIds.filter(id => !productMap[id]);
      if (unresolvedIds.length > 0) {
        // Try as combos (kits)
        const { data: combos } = await supabase
          .from('product_combos')
          .select('id, name, image_url')
          .in('id', unresolvedIds);
        
        if (combos) {
          for (const c of combos) {
            productMap[c.id] = { name: c.name, image_url: c.image_url };
            console.log(`[Checkout] Resolved combo ${c.id} → ${c.name}`);
            
            // Resolve a real lead_products ID from combo items for FK constraint
            let realProductId: string | null = null;
            const { data: comboItems } = await supabase
              .from('product_combo_items')
              .select('product_id')
              .eq('combo_id', c.id)
              .limit(1);
            if (comboItems && comboItems.length > 0) {
              realProductId = comboItems[0].product_id;
            }
            
            // Get correct price from product_combo_prices based on quantity
            for (const item of productItems) {
              if (item.product_id === c.id) {
                item.product_name = c.name;
                item.product_image_url = c.image_url;
                item.is_combo = true;
                item.combo_id = c.id;
                // Remap product_id to a real lead_products ID so FK constraint passes
                if (realProductId) {
                  item.product_id = realProductId;
                  productMap[realProductId] = { name: c.name, image_url: c.image_url };
                }
                // If price_cents is 0 or missing, resolve from combo prices
                if (!item.price_cents) {
                  const { data: comboPrice } = await supabase
                    .from('product_combo_prices')
                    .select('regular_price_cents')
                    .eq('combo_id', c.id)
                    .eq('multiplier', item.quantity || 1)
                    .single();
                  if (comboPrice) {
                    // regular_price_cents is already the TOTAL price for this kit/multiplier
                    // e.g. multiplier=5, regular_price_cents=31900 means "5 units for R$319"
                    // So price_cents = total kit price, quantity = 1 (one kit)
                    item.price_cents = comboPrice.regular_price_cents;
                    item.quantity = 1;
                    console.log(`[Checkout] Combo ${c.name} kit=${item.quantity}: total_kit_price=${comboPrice.regular_price_cents}, price_cents=${item.price_cents}`);
                  }
                }
              }
            }
          }
        }

        // Try remaining unresolved via storefront_products (by id OR by combo_id)
        const stillUnresolvedAfterCombos = productIds.filter(id => !productMap[id]);
        if (stillUnresolvedAfterCombos.length > 0) {
          console.warn(`[Checkout] ${stillUnresolvedAfterCombos.length} product IDs not found in lead_products or combos, trying storefront_products resolution...`);
          
          // Try by storefront_products.id first
          const { data: spMappings } = await supabase
            .from('storefront_products')
            .select('id, product_id, combo_id, custom_name, custom_images, product:lead_products(id, name, image_url)')
            .in('id', stillUnresolvedAfterCombos);
        
          if (spMappings) {
            for (const sp of spMappings) {
              const realProduct = sp.product as unknown as { id: string; name: string; image_url?: string } | null;
              if (realProduct) {
                console.log(`[Checkout] Resolved storefront_product ${sp.id} → lead_product ${realProduct.id} (${realProduct.name})`);
                productMap[sp.id] = { name: realProduct.name, image_url: realProduct.image_url };
                for (const item of productItems) {
                  if (item.product_id === sp.id) {
                    item.product_id = realProduct.id;
                    item.product_name = sp.custom_name || realProduct.name;
                    item.product_image_url = realProduct.image_url;
                    productMap[realProduct.id] = { name: sp.custom_name || realProduct.name, image_url: realProduct.image_url };
                  }
                }
              } else if (sp.combo_id) {
                // Combo-only storefront product — resolve via combo
                console.log(`[Checkout] Storefront product ${sp.id} is combo-only, resolving combo ${sp.combo_id}...`);
                const { data: combo } = await supabase
                  .from('product_combos')
                  .select('id, name, image_url')
                  .eq('id', sp.combo_id)
                  .single();
                if (combo) {
                  const comboName = sp.custom_name || combo.name;
                  const { data: comboItems } = await supabase
                    .from('product_combo_items')
                    .select('product_id')
                    .eq('combo_id', combo.id)
                    .limit(1);
                  const realProdId = comboItems?.[0]?.product_id;
                  if (realProdId) {
                    productMap[sp.id] = { name: comboName, image_url: combo.image_url };
                    for (const item of productItems) {
                      if (item.product_id === sp.id) {
                        item.product_id = realProdId;
                        item.product_name = comboName;
                        item.product_image_url = combo.image_url;
                        item.is_combo = true;
                        item.combo_id = combo.id;
                        productMap[realProdId] = { name: comboName, image_url: combo.image_url };
                        console.log(`[Checkout] Resolved combo storefront_product ${sp.id} → combo ${combo.id} → lead_product ${realProdId} (${comboName})`);
                      }
                    }
                  }
                }
              }
            }
          }

          // Also try by storefront_products.combo_id (cart may send combo_id as product_id)
          const stillUnresolvedForComboLookup = productIds.filter(id => !productMap[id]);
          if (stillUnresolvedForComboLookup.length > 0) {
            const { data: spComboMappings } = await supabase
              .from('storefront_products')
              .select('id, combo_id, custom_name, custom_images')
              .in('combo_id', stillUnresolvedForComboLookup);
            
            if (spComboMappings) {
              for (const sp of spComboMappings) {
                if (!sp.combo_id) continue;
                const { data: combo } = await supabase
                  .from('product_combos')
                  .select('id, name, image_url')
                  .eq('id', sp.combo_id)
                  .single();
                if (combo) {
                  const comboName = sp.custom_name || combo.name;
                  const { data: comboItems } = await supabase
                    .from('product_combo_items')
                    .select('product_id')
                    .eq('combo_id', combo.id)
                    .limit(1);
                  const realProdId = comboItems?.[0]?.product_id;
                  if (realProdId) {
                    productMap[sp.combo_id] = { name: comboName, image_url: combo.image_url };
                    for (const item of productItems) {
                      if (item.product_id === sp.combo_id) {
                        item.product_id = realProdId;
                        item.product_name = comboName;
                        item.product_image_url = combo.image_url;
                        item.is_combo = true;
                        item.combo_id = combo.id;
                        productMap[realProdId] = { name: comboName, image_url: combo.image_url };
                        console.log(`[Checkout] Resolved via combo_id lookup: ${sp.combo_id} → lead_product ${realProdId} (${comboName})`);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Last resort: try matching by name from cart items or by storefront product catalog
        const stillUnresolved = productItems.filter(i => !productMap[i.product_id]);
        if (stillUnresolved.length > 0) {
          // Strategy 1: If storefront_id exists, try to find product by name in the storefront's catalog (including combos)
          if (storefront_id) {
            for (const item of stillUnresolved) {
              const itemName = item.product_name;
              if (itemName) {
                console.warn(`[Checkout] Trying storefront catalog resolution for "${itemName}" in storefront ${storefront_id}`);
                // Try regular products
                const { data: spMatch } = await supabase
                  .from('storefront_products')
                  .select('product_id, combo_id, custom_name, product:lead_products(id, name, image_url)')
                  .eq('storefront_id', storefront_id)
                  .limit(100);
                
                if (spMatch) {
                  let resolved = false;
                  for (const sp of spMatch) {
                    const realProduct = sp.product as unknown as { id: string; name: string; image_url?: string } | null;
                    // Match by lead_products name
                    if (realProduct && realProduct.name.toLowerCase() === itemName.toLowerCase()) {
                      console.log(`[Checkout] Storefront-resolved "${itemName}" → ${realProduct.id} (${realProduct.name})`);
                      item.product_id = realProduct.id;
                      item.product_name = realProduct.name;
                      item.product_image_url = realProduct.image_url;
                      productMap[realProduct.id] = { name: realProduct.name, image_url: realProduct.image_url };
                      resolved = true;
                      break;
                    }
                    // Match by custom_name (for combos)
                    if (!resolved && sp.custom_name && sp.custom_name.toLowerCase() === itemName.toLowerCase() && sp.combo_id) {
                      const { data: comboItems } = await supabase
                        .from('product_combo_items')
                        .select('product_id')
                        .eq('combo_id', sp.combo_id)
                        .limit(1);
                      const realProdId = comboItems?.[0]?.product_id;
                      if (realProdId) {
                        console.log(`[Checkout] Storefront combo name-resolved "${itemName}" → combo ${sp.combo_id} → lead_product ${realProdId}`);
                        item.product_id = realProdId;
                        item.product_name = sp.custom_name;
                        item.is_combo = true;
                        item.combo_id = sp.combo_id;
                        productMap[realProdId] = { name: sp.custom_name, image_url: null };
                        resolved = true;
                        break;
                      }
                    }
                  }
                }
              }
            }
          }

          // Strategy 2: Direct name search in lead_products
          const finalUnresolved = productItems.filter(i => !productMap[i.product_id]);
          if (finalUnresolved.length > 0) {
            const itemNames = finalUnresolved.map(i => i.product_name).filter(Boolean);
            if (itemNames.length > 0) {
              console.warn(`[Checkout] Trying name-based resolution for: ${itemNames.join(', ')}`);
              for (const item of finalUnresolved) {
                if (item.product_name) {
                  // Try lead_products first
                  const { data: matchedProducts } = await supabase
                    .from('lead_products')
                    .select('id, name, image_url')
                    .eq('organization_id', organizationId!)
                    .ilike('name', item.product_name)
                    .limit(1);
                  
                  if (matchedProducts && matchedProducts.length > 0) {
                    const mp = matchedProducts[0];
                    console.log(`[Checkout] Name-resolved "${item.product_name}" → ${mp.id} (${mp.name})`);
                    item.product_id = mp.id;
                    productMap[mp.id] = { name: mp.name, image_url: mp.image_url };
                  } else {
                    // Try product_combos by name
                    const { data: matchedCombos } = await supabase
                      .from('product_combos')
                      .select('id, name, image_url')
                      .eq('organization_id', organizationId!)
                      .ilike('name', item.product_name)
                      .limit(1);
                    
                    if (matchedCombos && matchedCombos.length > 0) {
                      const mc = matchedCombos[0];
                      const { data: comboItems } = await supabase
                        .from('product_combo_items')
                        .select('product_id')
                        .eq('combo_id', mc.id)
                        .limit(1);
                      const realProdId = comboItems?.[0]?.product_id;
                      if (realProdId) {
                        console.log(`[Checkout] Combo name-resolved "${item.product_name}" → combo ${mc.id} → lead_product ${realProdId}`);
                        item.product_id = realProdId;
                        item.product_name = mc.name;
                        item.is_combo = true;
                        item.combo_id = mc.id;
                        productMap[realProdId] = { name: mc.name, image_url: mc.image_url };
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!organizationId) {
      throw new Error('Organização não identificada');
    }

    // 2. Create or update lead with UTM data
    const normalizedPhone = normalizeBrazilianPhone(customer.phone);
    
    let { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('whatsapp', normalizedPhone)
      .maybeSingle();

    // Get a default user from the organization for assignment (required for lead and sale)
    let defaultUserId: string | null = null;
    let postSaleFunnelStageId: string | null = null;
    
    // Priority 1: If storefront has a default seller and/or post-sale stage, use it
    if (storefront_id) {
      const { data: sf } = await supabase
        .from('tenant_storefronts')
        .select('default_seller_user_id, settings')
        .eq('id', storefront_id)
        .single();
      if (sf?.default_seller_user_id) {
        defaultUserId = sf.default_seller_user_id;
        console.log(`[Checkout] Using storefront default seller: ${defaultUserId}`);
      }
      if (sf?.settings && typeof sf.settings === 'object' && (sf.settings as Record<string, unknown>).post_sale_funnel_stage_id) {
        postSaleFunnelStageId = (sf.settings as Record<string, unknown>).post_sale_funnel_stage_id as string;
        console.log(`[Checkout] Using storefront post-sale funnel stage: ${postSaleFunnelStageId}`);
      }
    }

    // Priority 2: First org member
    if (!defaultUserId) {
      const { data: orgMembers } = await supabase
        .from('user_organizations')
        .select('user_id')
        .eq('organization_id', organizationId)
        .limit(1);
      defaultUserId = orgMembers?.[0]?.user_id || null;
    }
    
    // Priority 3: Org owner from profiles
    if (!defaultUserId) {
      const { data: orgOwner } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('organization_id', organizationId)
        .limit(1);
      defaultUserId = orgOwner?.[0]?.user_id || null;
    }
    
    if (!defaultUserId) {
      throw new Error('Organização sem usuários cadastrados para atribuição');
    }

    if (!lead) {
      
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          organization_id: organizationId,
          name: customer.name,
          email: customer.email,
          whatsapp: normalizedPhone,
          cpf_cnpj: customer.document || null,
          lead_source: storefront_id ? 'ecommerce' : 'landing_page',
          assigned_to: defaultUserId,
          ...(postSaleFunnelStageId ? { funnel_stage_id: postSaleFunnelStageId } : {}),
          // Attribution UTM data
          src: utm?.src || null,
          utm_source: utm?.utm_source || null,
          utm_medium: utm?.utm_medium || null,
          utm_campaign: utm?.utm_campaign || null,
          utm_term: utm?.utm_term || null,
          utm_content: utm?.utm_content || null,
          fbclid: utm?.fbclid || null,
          gclid: utm?.gclid || null,
          ttclid: utm?.ttclid || null,
          first_touch_url: utm?.first_touch_url || null,
          first_touch_referrer: utm?.first_touch_referrer || null,
          first_touch_at: utm?.first_touch_at || null,
        })
        .select('id')
        .single();
      
      if (leadError) throw leadError;
      lead = newLead;
    } else {
      // Update existing lead: fill missing CPF, name, email, and UTM data
      const updateData: Record<string, unknown> = {};
      
      if (customer.document) {
        updateData.cpf_cnpj = customer.document;
      }
      if (customer.name) {
        updateData.name = customer.name;
      }
      if (customer.email) {
        updateData.email = customer.email;
      }
      
      // UTM data (only if not set before)
      if (utm && Object.keys(utm).length > 0) {
        // We'll handle UTM separately to respect the "don't overwrite" rule
        const { data: existingLead } = await supabase
          .from('leads')
          .select('utm_source')
          .eq('id', lead.id)
          .single();
        
        if (!existingLead?.utm_source) {
          updateData.src = utm.src || null;
          updateData.utm_source = utm.utm_source || null;
          updateData.utm_medium = utm.utm_medium || null;
          updateData.utm_campaign = utm.utm_campaign || null;
          updateData.utm_term = utm.utm_term || null;
          updateData.utm_content = utm.utm_content || null;
          updateData.fbclid = utm.fbclid || null;
          updateData.gclid = utm.gclid || null;
          updateData.ttclid = utm.ttclid || null;
          updateData.first_touch_url = utm.first_touch_url || null;
          updateData.first_touch_referrer = utm.first_touch_referrer || null;
          updateData.first_touch_at = utm.first_touch_at || null;
        }
      }

      // Always update funnel stage if configured for storefront
      if (postSaleFunnelStageId) {
        updateData.funnel_stage_id = postSaleFunnelStageId;
      }
      
      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('leads')
          .update(updateData)
          .eq('id', lead.id);
      }
    }

    // 3. Calculate totals
    const subtotalCents = productItems.reduce((acc, item) => acc + (item.price_cents * item.quantity), 0);
    // NOTE: shipping is currently calculated on frontend (ShippingSelector). We must receive it here.
    const shippingCents = Number.isFinite(Number(body.shipping_cost_cents)) ? Number(body.shipping_cost_cents) : 0;
    const baseTotalCents = subtotalCents + shippingCents;
    
    // Use total with interest if provided (for credit card with installments)
    const totalWithInterest = Number.isFinite(Number(body.total_with_interest_cents)) 
      ? Number(body.total_with_interest_cents) 
      : null;
    const totalCents = totalWithInterest || baseTotalCents;

    // 4. Check affiliate via affiliate_network_members (new) OR partner_associations (legacy)
    let affiliatePartnerId: string | null = null;
    let affiliateVirtualAccountId: string | null = null;
    let affiliateCommissionType: string = 'percentage';
    let affiliateCommissionValue: number = 10;
    let affiliateLiableRefund: boolean = true;
    let affiliateLiableChargeback: boolean = true;
    let affiliateNetworkMemberId: string | null = null;
    
    if (affiliate_code) {
      // NEW: First try to find affiliate via organization_affiliates + affiliate_network_members
      const { data: orgAffiliate } = await supabase
        .from('organization_affiliates')
        .select('id, email, name, user_id, default_commission_type, default_commission_value')
        .eq('organization_id', organizationId)
        .eq('affiliate_code', affiliate_code)
        .eq('is_active', true)
        .maybeSingle();

      if (orgAffiliate) {
        // IMPORTANT: Set affiliatePartnerId to organization_affiliates.id for ecommerce_orders visibility
        affiliatePartnerId = orgAffiliate.id;
        
        // Use default commission from organization_affiliates
        affiliateCommissionType = orgAffiliate.default_commission_type || 'percentage';
        affiliateCommissionValue = Number(orgAffiliate.default_commission_value) || 10;
        
        // Get or create virtual account for this affiliate
        if (orgAffiliate.user_id) {
          const { data: vaByUser } = await supabase
            .from('virtual_accounts')
            .select('id')
            .eq('user_id', orgAffiliate.user_id)
            .maybeSingle();
          
          if (vaByUser) {
            affiliateVirtualAccountId = vaByUser.id;
          } else {
            // Create virtual account for this affiliate user
            const { data: newVA } = await supabase
              .from('virtual_accounts')
              .insert({
                organization_id: organizationId,
                user_id: orgAffiliate.user_id,
                account_type: 'affiliate',
                holder_name: orgAffiliate.name || orgAffiliate.email,
                holder_email: orgAffiliate.email,
              })
              .select('id')
              .single();
            
            affiliateVirtualAccountId = newVA?.id || null;
          }
        }
        
        // Check if this affiliate is part of a network (optional override for commission)
        const { data: networkMember } = await supabase
          .from('affiliate_network_members')
          .select(`
            id, 
            network_id, 
            commission_type, 
            commission_value,
            network:affiliate_networks!inner(id, organization_id, is_active)
          `)
          .eq('affiliate_id', orgAffiliate.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (networkMember) {
          // Override with network member's commission settings if available
          affiliateNetworkMemberId = networkMember.id;
          affiliateCommissionType = networkMember.commission_type || affiliateCommissionType;
          affiliateCommissionValue = Number(networkMember.commission_value) || affiliateCommissionValue;
        }
        
        console.log(`[Checkout] Found affiliate ${affiliate_code} (org_affiliates.id=${orgAffiliate.id}): commission=${affiliateCommissionValue}${affiliateCommissionType === 'percentage' ? '%' : 'c'}`);
      }

      // LEGACY: Fallback to partner_associations if not found via networks
      if (!affiliateNetworkMemberId) {
        // First try to find a partner linked to this specific storefront/landing
        const linkedColumn = storefront_id ? 'linked_storefront_id' : (landing_page_id ? 'linked_landing_id' : null);
        const linkedId = storefront_id || landing_page_id || null;
        
        let partnerQuery = supabase
          .from('partner_associations')
          .select('id, virtual_account_id, commission_type, commission_value, responsible_for_refunds, responsible_for_chargebacks, partner_type')
          .eq('organization_id', organizationId)
          .eq('affiliate_code', affiliate_code)
          .eq('is_active', true);
        
        // Prefer partner linked to this asset
        if (linkedColumn && linkedId) {
          partnerQuery = partnerQuery.eq(linkedColumn, linkedId);
        }
        
        const { data: linkedPartner } = await partnerQuery.maybeSingle();
        
        // If not found linked, try general partner (no links)
        let partner = linkedPartner;
        if (!partner && affiliate_code) {
          const { data: generalPartner } = await supabase
            .from('partner_associations')
            .select('id, virtual_account_id, commission_type, commission_value, responsible_for_refunds, responsible_for_chargebacks, partner_type')
            .eq('organization_id', organizationId)
            .eq('affiliate_code', affiliate_code)
            .eq('is_active', true)
            .is('linked_checkout_id', null)
            .is('linked_landing_id', null)
            .is('linked_storefront_id', null)
            .is('linked_quiz_id', null)
            .maybeSingle();
          partner = generalPartner;
        }
        
        if (partner) {
          affiliatePartnerId = partner.id;
          affiliateVirtualAccountId = partner.virtual_account_id;
          affiliateCommissionType = partner.commission_type || 'percentage';
          affiliateCommissionValue = Number(partner.commission_value) || 10;
          affiliateLiableRefund = partner.responsible_for_refunds ?? true;
          affiliateLiableChargeback = partner.responsible_for_chargebacks ?? true;
          console.log(`[Checkout] Found legacy partner ${affiliate_code}: type=${partner.partner_type}, commission=${affiliateCommissionValue}${affiliateCommissionType === 'percentage' ? '%' : 'c'}`);
        }
      }
    }

    // 5. Create lead address if shipping data exists
    let shippingAddressId: string | null = null;
    if (body.shipping?.address && body.shipping?.city) {
      const { data: leadAddress } = await supabase
        .from('lead_addresses')
        .insert({
          lead_id: lead.id,
          organization_id: organizationId,
          label: 'Entrega',
          is_primary: true,
          street: body.shipping.address,
          neighborhood: body.shipping.neighborhood || null,
          city: body.shipping.city,
          state: body.shipping.state,
          cep: body.shipping.zip,
          complement: body.shipping.complement || null,
        })
        .select('id')
        .single();
      
      if (leadAddress) {
        shippingAddressId = leadAddress.id;
        console.log(`[Checkout] Created lead_address ${shippingAddressId} for lead ${lead.id}`);
      }
    }

    // 6. Create sale in ecommerce_pending status (won't appear in ERP until payment confirmed)
    // This status is used for e-commerce orders awaiting payment
    // Once paid, status changes to payment_confirmed and appears in /vendas
    
    // CRITICAL: E-commerce orders with shipping must always be 'carrier' delivery type
    // Only use 'pickup' when there's no shipping cost AND no shipping address
    const hasShipping = shippingCents > 0 || (body.shipping?.address && body.shipping?.city);
    const deliveryType = hasShipping ? 'carrier' : 'pickup';
    
    const salePayload: Record<string, unknown> = {
      organization_id: organizationId,
      lead_id: lead.id,
      created_by: defaultUserId,
      seller_user_id: defaultUserId, // Assign seller (uses storefront default if configured)
      status: 'ecommerce_pending', // NEW: E-commerce pending status (hidden from ERP)
      payment_status: 'pending',
      delivery_type: deliveryType, // FIXED: Set delivery_type based on shipping
      subtotal_cents: subtotalCents,
      shipping_cost_cents: shippingCents,
      total_cents: totalCents,
      payment_method: payment_method,
      payment_notes: `Checkout via ${storefront_id ? 'loja' : landing_page_id ? 'landing page' : 'standalone checkout'}`,
      src: utm?.src || null,
      utm_source: utm?.utm_source || null,
      utm_medium: utm?.utm_medium || null,
      utm_campaign: utm?.utm_campaign || null,
      utm_term: utm?.utm_term || null,
      utm_content: utm?.utm_content || null,
      fbclid: utm?.fbclid || null,
      gclid: utm?.gclid || null,
      ttclid: utm?.ttclid || null,
      is_ecommerce_origin: true,
    };

    // Add shipping address reference if we created one
    if (shippingAddressId) {
      salePayload.shipping_address_id = shippingAddressId;
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(salePayload)
      .select('id')
      .single();

    if (saleError) throw saleError;

    // 6. Create sale items - with combo explosion
    console.log(`[Checkout] Creating ${productItems.length} sale items for sale ${sale.id}`);
    for (const item of productItems) {
      const productInfo = productMap[item.product_id];
      const itemName = item.product_name || productInfo?.name || 'Produto';
      
      if (item.is_combo && item.combo_id) {
        // COMBO: Create parent item (the combo itself) + child items (individual components)
        const { data: parentItem, error: parentError } = await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            product_id: item.product_id, // FK to first component product
            product_name: itemName,
            quantity: item.quantity,
            unit_price_cents: item.price_cents,
            total_cents: item.price_cents * item.quantity,
            combo_id: item.combo_id,
          })
          .select('id')
          .single();
        
        if (parentError) {
          console.error(`[Checkout] Failed to create combo parent item for ${itemName}:`, parentError);
        } else {
          console.log(`[Checkout] Created combo parent item: ${itemName}, id=${parentItem.id}, combo=${item.combo_id}`);
          
          // Fetch combo components and create child items
          const { data: comboComponents } = await supabase
            .from('product_combo_items')
            .select('product_id, quantity, product:lead_products(id, name, image_url)')
            .eq('combo_id', item.combo_id)
            .order('position');
          
          if (comboComponents && comboComponents.length > 0) {
            for (const comp of comboComponents) {
              const compProduct = comp.product as unknown as { id: string; name: string; image_url?: string } | null;
              const compName = compProduct?.name || 'Componente';
              const { error: childError } = await supabase
                .from('sale_items')
                .insert({
                  sale_id: sale.id,
                  product_id: comp.product_id,
                  product_name: compName,
                  quantity: comp.quantity * item.quantity, // multiply by kit quantity
                  unit_price_cents: 0, // price is on the parent combo
                  total_cents: 0,
                  combo_id: item.combo_id,
                  combo_item_parent_id: parentItem.id,
                });
              
              if (childError) {
                console.error(`[Checkout] Failed to create combo child item ${compName}:`, childError);
              } else {
                console.log(`[Checkout] Created combo child item: ${compName} x${comp.quantity * item.quantity}`);
              }
            }
          }
        }
      } else {
        // Regular product (not a combo)
        const { error: itemError } = await supabase
          .from('sale_items')
          .insert({
            sale_id: sale.id,
            product_id: item.product_id,
            product_name: itemName,
            quantity: item.quantity,
            unit_price_cents: item.price_cents,
            total_cents: item.price_cents * item.quantity,
          });
        
        if (itemError) {
          console.error(`[Checkout] Failed to create sale item for product ${item.product_id} (${itemName}):`, itemError);
        } else {
          console.log(`[Checkout] Created sale item: product=${item.product_id}, name=${itemName}, qty=${item.quantity}, price=${item.price_cents}`);
        }
      }
    }

    // 7. ALWAYS store affiliate attribution when affiliate_code is present
    // The Split Engine will resolve the affiliate on payment confirmation
    // This allows tracking even if the affiliate isn't yet linked to this specific checkout
    if (affiliate_code) {
      // Valid attribution_type values: 'link', 'coupon', 'manual', 'utm'
      // 'link' is used for ?ref= URL parameter (affiliate link)
      const { error: attrError } = await supabase
        .from('affiliate_attributions')
        .insert({
          sale_id: sale.id,
          organization_id: organizationId,
          affiliate_id: affiliatePartnerId || null, // Now properly filled with organization_affiliates.id
          attribution_type: 'link', // ?ref= parameter = affiliate link
          code_or_ref: affiliate_code,
        });
      
      if (attrError) {
        console.error('Failed to create affiliate attribution:', attrError);
      } else {
        console.log(`[Checkout] Attribution created for affiliate code ${affiliate_code} (${affiliatePartnerId ? 'partner' : 'unlinked'})`);
      }
    }

    // 7b. Coupon-based affiliate attribution (double-check)
    // If no affiliate_code via URL but coupon has an affiliate_id, attribute via coupon
    if (!affiliate_code && coupon_code) {
      const { data: couponData } = await supabase
        .from('coupons')
        .select('affiliate_id, code')
        .eq('code', coupon_code)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle();

      if (couponData?.affiliate_id) {
        // Find the affiliate code for this affiliate_id
        const { data: affData } = await supabase
          .from('organization_affiliates')
          .select('affiliate_code')
          .eq('id', couponData.affiliate_id)
          .maybeSingle();

        const { error: couponAttrError } = await supabase
          .from('affiliate_attributions')
          .insert({
            sale_id: sale.id,
            organization_id: organizationId,
            affiliate_id: couponData.affiliate_id,
            attribution_type: 'coupon',
            code_or_ref: affData?.affiliate_code || coupon_code,
          });

        if (!couponAttrError) {
          console.log(`[Checkout] Coupon-based attribution: coupon=${coupon_code} → affiliate=${couponData.affiliate_id}`);
        }
      }

      // Increment coupon usage
      await supabase.rpc('increment_coupon_usage', { coupon_id: couponData?.affiliate_id ? coupon_code : coupon_code });
    }

    // Store coupon info on sale
    if (coupon_code) {
      await supabase
        .from('sales')
        .update({ coupon_code, coupon_discount_cents: coupon_discount_cents || 0 })
        .eq('id', sale.id);
    }


    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const { data: orderData } = await supabase
      .from('ecommerce_orders')
      .insert({
        organization_id: organizationId,
        cart_id: cart_id || null,
        sale_id: sale.id,
        lead_id: lead.id,
        order_number: orderNumber,
        customer_name: customer.name,
        customer_email: customer.email || null,
        customer_phone: normalizedPhone,
        customer_cpf: customer.document || null,
        shipping_cep: body.shipping?.zip || null,
        shipping_street: body.shipping?.address || null,
        shipping_number: body.shipping?.number || null,
        shipping_neighborhood: body.shipping?.neighborhood || null,
        shipping_city: body.shipping?.city || null,
        shipping_state: body.shipping?.state || null,
        shipping_complement: body.shipping?.complement || null,
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        discount_cents: 0,
        total_cents: totalCents,
        status: 'awaiting_payment',
        source: storefront_id ? 'storefront' : 'landing_page',
        storefront_id: storefront_id || null,
        landing_page_id: landing_page_id || null,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
        utm_term: utm?.utm_term || null,
        utm_content: utm?.utm_content || null,
        fbclid: utm?.fbclid || null,
        gclid: utm?.gclid || null,
        ttclid: utm?.ttclid || null,
        affiliate_id: affiliatePartnerId || null, // Now stores partner_association.id
        payment_method: payment_method,
        shipping_method: body.shipping_method_name || null,
      })
      .select('id')
      .single();

    // 8b. Create ecommerce_order_items for product visibility (with combo explosion)
    if (orderData?.id && productItems.length > 0) {
      for (const item of productItems) {
        const productInfo = productMap[item.product_id] || {};
        const itemName = item.product_name || productInfo.name || 'Produto';
        
        // Insert parent item
        const { data: parentOrderItem } = await supabase
          .from('ecommerce_order_items')
          .insert({
            order_id: orderData.id,
            product_id: item.product_id,
            product_name: itemName,
            product_image_url: item.product_image_url || productInfo.image_url || null,
            quantity: item.quantity,
            unit_price_cents: item.price_cents,
            total_cents: item.price_cents * item.quantity,
            combo_id: item.is_combo ? item.combo_id : null,
          })
          .select('id')
          .single();
        
        // If combo, insert child items
        if (item.is_combo && item.combo_id && parentOrderItem?.id) {
          const { data: comboComponents } = await supabase
            .from('product_combo_items')
            .select('product_id, quantity, product:lead_products(id, name, image_url)')
            .eq('combo_id', item.combo_id)
            .order('position');
          
          if (comboComponents) {
            for (const comp of comboComponents) {
              const compProduct = comp.product as unknown as { id: string; name: string; image_url?: string } | null;
              await supabase
                .from('ecommerce_order_items')
                .insert({
                  order_id: orderData.id,
                  product_id: comp.product_id,
                  product_name: compProduct?.name || 'Componente',
                  product_image_url: compProduct?.image_url || null,
                  quantity: comp.quantity * item.quantity,
                  unit_price_cents: 0,
                  total_cents: 0,
                  combo_id: item.combo_id,
                  combo_item_parent_id: parentOrderItem.id,
                });
            }
          }
        }
      }
    }

    // 9. Convert cart if exists
    if (cart_id) {
      await supabase
        .from('ecommerce_carts')
        .update({
          status: 'payment_initiated', // Changed: only mark as converted AFTER payment is confirmed
          converted_sale_id: sale.id,
          lead_id: lead.id,
        })
        .eq('id', cart_id);
    }

    // 10. Initialize Fallback Engine and process payment
    const fallbackEngine = new FallbackEngine(supabaseUrl, supabaseServiceKey);
    await fallbackEngine.initialize(payment_method);

    const paymentResult = await fallbackEngine.processWithFallback({
      sale_id: sale.id,
      organization_id: organizationId,
      amount_cents: totalCents,
      payment_method: payment_method as PaymentMethod,
      installments: body.installments || 1,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: normalizedPhone,
        document: customer.document,
        address: body.shipping ? {
          street: body.shipping.address,
          number: body.shipping.number,
          neighborhood: body.shipping.neighborhood,
          city: body.shipping.city,
          state: body.shipping.state,
          zip_code: body.shipping.zip,
          complement: body.shipping.complement,
        } : undefined,
      },
      postback_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      card_token: body.card_token,
      card_hash: body.card_hash,
      // Map frontend field names to backend CardData interface
      card_data: body.card_data ? {
        number: (body.card_data as unknown as { card_number?: string }).card_number || (body.card_data as CardData).number || '',
        holder_name: (body.card_data as unknown as { card_holder_name?: string }).card_holder_name || (body.card_data as CardData).holder_name || '',
        exp_month: (body.card_data as unknown as { card_expiration_month?: string }).card_expiration_month || (body.card_data as CardData).exp_month || '',
        exp_year: (body.card_data as unknown as { card_expiration_year?: string }).card_expiration_year || (body.card_data as CardData).exp_year || '',
        cvv: (body.card_data as unknown as { card_cvv?: string }).card_cvv || (body.card_data as CardData).cvv || '',
      } as CardData : undefined,
      save_card: body.save_card,
    });

    // 11. Update sale with payment info
    const paymentStatus = paymentResult.response.success ? 'processing' : 'failed';
    await supabase
      .from('sales')
      .update({
        payment_status: paymentStatus,
        gateway_transaction_id: paymentResult.response.transaction_id || null,
      })
      .eq('id', sale.id);

    // 12. Save card if requested and successful
    if (body.save_card && paymentResult.response.success && paymentResult.response.card_id) {
      await supabase
        .from('saved_payment_methods')
        .insert({
          lead_id: lead.id,
          organization_id: organizationId,
          gateway_type: paymentResult.usedGateway,
          card_token: paymentResult.response.card_id,
          card_last_digits: paymentResult.response.card_last_digits,
          card_brand: paymentResult.response.card_brand,
          is_default: true,
        });
    }

    // 13. Send email notification for PIX/Boleto (non-blocking)
    if (paymentResult.response.success && customer.email) {
      const notifType = payment_method === 'pix' ? 'pix_pending' 
                       : payment_method === 'boleto' ? 'boleto_pending' 
                       : null;
      
      if (notifType) {
        try {
          const notifUrl = `${supabaseUrl}/functions/v1/ecommerce-notifications`;
          fetch(notifUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: notifType,
              sale_id: sale.id,
              organization_id: organizationId,
              customer_name: customer.name,
              customer_email: customer.email,
              pix_code: paymentResult.response.pix_code,
              pix_expiration: paymentResult.response.pix_expiration,
              boleto_barcode: paymentResult.response.boleto_barcode,
              boleto_url: paymentResult.response.payment_url,
              items: productItems.map(item => ({
                product_name: productMap[item.product_id]?.name || 'Produto',
                quantity: item.quantity,
                unit_price_cents: item.price_cents,
                total_cents: item.price_cents * item.quantity,
              })),
              subtotal_cents: subtotalCents,
              shipping_cents: shippingCents,
              total_cents: totalCents,
              order_number: orderNumber,
              payment_method: payment_method,
            }),
          }).then(r => console.log(`[Checkout] Notification ${notifType} sent: ${r.status}`))
            .catch(e => console.error(`[Checkout] Notification error:`, e));
        } catch (e) {
          console.error('[Checkout] Failed to trigger notification:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: paymentResult.response.success,
        sale_id: sale.id,
        subtotal_cents: subtotalCents,
        shipping_cost_cents: shippingCents,
        total_cents: totalCents,
        payment_url: paymentResult.response.payment_url,
        pix_code: paymentResult.response.pix_code,
        pix_expiration: paymentResult.response.pix_expiration,
        boleto_barcode: paymentResult.response.boleto_barcode,
        gateway_used: paymentResult.usedGateway,
        attempts_count: paymentResult.attempts.length,
        client_secret: paymentResult.response.client_secret,
        error: paymentResult.response.error_message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

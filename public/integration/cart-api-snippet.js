/**
 * Morphews Cart API v2 - Integration Snippet
 * 
 * Cole este script no site externo para integrar com o checkout Morphews.
 * 
 * Uso:
 *   1. Inclua este script no HTML: <script src="https://crm-morphews.lovable.app/integration/cart-api-snippet.js"></script>
 *   2. Configure o storefront_id do seu checkout
 *   3. Use MorphewsCart.addItem() para adicionar itens
 *   4. Use MorphewsCart.checkout() para redirecionar ao checkout
 * 
 * Exemplo:
 *   MorphewsCart.init({ storefrontId: 'SEU_STOREFRONT_ID' });
 *   MorphewsCart.addItem({ 
 *     product_id: 'xxx', 
 *     name: 'DalFlore Slim Balance',
 *     image_url: 'https://...',
 *     quantity: 1,
 *     kit_size: 6,
 *     unit_price_cents: 10392,
 *     sku: 'SLIM-KIT6'
 *   });
 *   MorphewsCart.checkout(); // redireciona para o checkout Morphews
 */

(function() {
  'use strict';

  var MORPHEWS_API = 'https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/cart-sync';
  var MORPHEWS_CHECKOUT = 'https://crm-morphews.lovable.app/c';
  var MORPHEWS_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaWl6bHhxZnBmcGRmbGd4anRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTIxODYsImV4cCI6MjA4MzE4ODE4Nn0.fg_ErgFi73cPPKgcpvDzJnzRi6mbcRqcY8MgOQqGIGM';

  var config = {
    storefrontId: null,
    landingPageId: null,
    source: 'storefront',
    checkoutBaseUrl: MORPHEWS_CHECKOUT,
  };

  var items = [];
  var customerData = {};

  // Captura UTMs da URL atual
  function getUtmParams() {
    var params = new URLSearchParams(window.location.search);
    var utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'src', 'fbclid', 'gclid', 'ttclid'].forEach(function(key) {
      var val = params.get(key);
      if (val) utm[key] = val;
    });
    var ref = params.get('ref');
    if (ref) utm._affiliate_code = ref;
    return utm;
  }

  window.MorphewsCart = {
    /**
     * Inicializa a integração
     * @param {Object} opts - { storefrontId, landingPageId, source, checkoutBaseUrl }
     */
    init: function(opts) {
      if (opts.storefrontId) config.storefrontId = opts.storefrontId;
      if (opts.landingPageId) config.landingPageId = opts.landingPageId;
      if (opts.source) config.source = opts.source;
      if (opts.checkoutBaseUrl) config.checkoutBaseUrl = opts.checkoutBaseUrl;
      items = [];
      customerData = {};
      console.log('[MorphewsCart] Initialized v2', config);
    },

    /**
     * Adiciona um item ao carrinho (formato rico)
     * @param {Object} item - { 
     *   product_id: string (obrigatório),
     *   name: string (obrigatório - nome do produto),
     *   quantity: number (obrigatório),
     *   kit_size: number (padrão 1 - quantas unidades no kit),
     *   unit_price_cents: number (obrigatório - preço por unidade em centavos),
     *   image_url?: string (URL da imagem do produto),
     *   sku?: string (SKU do kit),
     *   storefront_product_id?: string (ID do produto no storefront)
     * }
     */
    addItem: function(item) {
      if (!item.product_id || !item.name || !item.unit_price_cents) {
        console.error('[MorphewsCart] Item inválido. Campos obrigatórios: product_id, name, unit_price_cents');
        return;
      }

      var kitSize = item.kit_size || 1;
      var quantity = item.quantity || 1;
      var totalPriceCents = quantity * item.unit_price_cents * kitSize;

      // Verifica se já existe - atualiza quantidade
      var existing = items.find(function(i) { 
        return i.product_id === item.product_id && i.kit_size === kitSize; 
      });
      
      if (existing) {
        existing.quantity += quantity;
        existing.total_price_cents = existing.quantity * existing.unit_price_cents * existing.kit_size;
      } else {
        items.push({
          product_id: item.product_id,
          storefront_product_id: item.storefront_product_id || null,
          name: item.name,
          image_url: item.image_url || null,
          quantity: quantity,
          kit_size: kitSize,
          unit_price_cents: item.unit_price_cents,
          total_price_cents: totalPriceCents,
          sku: item.sku || null,
        });
      }
      console.log('[MorphewsCart] Item adicionado:', item.name, '| Total itens:', items.length);
    },

    /**
     * Adiciona item no formato legado (compatibilidade)
     * @param {Object} item - { product_id, quantity, price_cents, name? }
     */
    addItemLegacy: function(item) {
      this.addItem({
        product_id: item.product_id,
        name: item.name || 'Produto',
        quantity: item.quantity || 1,
        kit_size: 1,
        unit_price_cents: item.price_cents,
      });
    },

    /**
     * Remove um item do carrinho
     * @param {string} productId
     * @param {number} kitSize (opcional, remove todos os kits do produto se não especificado)
     */
    removeItem: function(productId, kitSize) {
      if (kitSize !== undefined) {
        items = items.filter(function(i) { 
          return !(i.product_id === productId && i.kit_size === kitSize); 
        });
      } else {
        items = items.filter(function(i) { return i.product_id !== productId; });
      }
    },

    /**
     * Define dados do cliente (opcional, pode preencher no checkout)
     * @param {Object} data - { name, email, phone, cpf }
     */
    setCustomer: function(data) {
      customerData = data || {};
    },

    /**
     * Retorna os itens atuais
     */
    getItems: function() {
      return items.slice();
    },

    /**
     * Retorna o subtotal em centavos
     */
    getSubtotal: function() {
      return items.reduce(function(sum, item) {
        return sum + item.total_price_cents;
      }, 0);
    },

    /**
     * Limpa o carrinho
     */
    clear: function() {
      items = [];
      customerData = {};
    },

    /**
     * Envia o carrinho para o Morphews e redireciona ao checkout
     * @param {Object} opts - { openInNewTab: boolean }
     * @returns {Promise<string>} cart_id
     */
    checkout: function(opts) {
      opts = opts || {};

      if (items.length === 0) {
        alert('Carrinho vazio! Adicione produtos antes de finalizar.');
        return Promise.reject('Carrinho vazio');
      }

      if (!config.storefrontId && !config.landingPageId) {
        console.error('[MorphewsCart] Configure storefrontId ou landingPageId primeiro com MorphewsCart.init()');
        return Promise.reject('Não configurado');
      }

      var utmData = getUtmParams();
      var affiliateCode = utmData._affiliate_code;
      delete utmData._affiliate_code;

      var payload = {
        storefront_id: config.storefrontId || undefined,
        landing_page_id: config.landingPageId || undefined,
        source: config.source,
        items: items,
        utm: Object.keys(utmData).length > 0 ? utmData : undefined,
        affiliate_code: affiliateCode || undefined,
      };

      if (Object.keys(customerData).length > 0) {
        payload.customer = customerData;
      }

      console.log('[MorphewsCart] Criando carrinho...', payload);

      return fetch(MORPHEWS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + MORPHEWS_ANON_KEY,
        },
        body: JSON.stringify(payload),
      })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (!result.success || !result.cart_id) {
          throw new Error(result.error || 'Erro ao criar carrinho');
        }

        console.log('[MorphewsCart] Carrinho criado:', result.cart_id);
        
        var checkoutUrl = config.checkoutBaseUrl + '/' + result.cart_id;

        if (opts.openInNewTab) {
          window.open(checkoutUrl, '_blank');
        } else {
          window.location.href = checkoutUrl;
        }

        return result.cart_id;
      })
      .catch(function(err) {
        console.error('[MorphewsCart] Erro:', err);
        alert('Erro ao finalizar compra. Tente novamente.');
        throw err;
      });
    },
  };
})();

/**
 * Atomic Sales Checkout SDK
 * v1.0.0 — 2026-04-25
 *
 * Lightweight client to compute installment prices that match EXACTLY
 * what the user will pay inside the Atomic Sales / Morphews checkout.
 *
 * Use this on landing pages, Shopify themes, or any external cart so
 * "12x R$ X" displayed on your site is identical to the checkout.
 *
 * USAGE — Browser (CDN / <script>):
 *   <script src="https://crm.morphews.com/checkout-sdk.js"></script>
 *   <script>
 *     AtomicCheckout.configure({ organizationId: 'YOUR-ORG-UUID' });
 *
 *     // Local calculation (no network — uses default fee table)
 *     const plan = AtomicCheckout.calculate({ amountCents: 100000, installments: 12 });
 *     // => { installmentValueCents: 10191, totalCents: 122292, feePercentage: 22.29, hasInterest: true }
 *
 *     // Remote quote (fetches the tenant's REAL fees from the server)
 *     AtomicCheckout.quote({ amountCents: 100000 }).then(res => {
 *       console.log(res.installments); // [{ installments: 1, ... }, ...]
 *     });
 *   </script>
 *
 * USAGE — ES Module:
 *   import { AtomicCheckout } from 'https://crm.morphews.com/checkout-sdk.js';
 */
(function (global) {
  'use strict';

  var API_BASE = 'https://rriizlxqfpfpdflgxjtj.supabase.co/functions/v1/checkout-quote';

  // Default CET (Stone/Point D+15 + safety margin against antifraud/anticipation).
  // R$ 1.000 in 12x = R$ 101,91 / parcel (22.29% total).
  var DEFAULT_FEES = {
    '1': 3.93, '2': 6.38, '3': 7.98, '4': 9.58, '5': 11.18, '6': 12.78,
    '7': 14.38, '8': 15.98, '9': 17.58, '10': 19.17, '11': 20.77, '12': 22.29
  };

  var config = {
    organizationId: null,
    fees: DEFAULT_FEES,
    maxInstallments: 12,
    passFeeToBuyer: true
  };

  function configure(opts) {
    if (opts.organizationId) config.organizationId = opts.organizationId;
    if (opts.fees) config.fees = opts.fees;
    if (opts.maxInstallments) config.maxInstallments = opts.maxInstallments;
    if (typeof opts.passFeeToBuyer === 'boolean') config.passFeeToBuyer = opts.passFeeToBuyer;
  }

  /**
   * Pure local calculation. No network call.
   * Uses the configured fee table (defaults to system table).
   */
  function calculate(opts) {
    var amountCents = opts.amountCents;
    var installments = opts.installments || 1;
    var feePct = (config.fees[String(installments)] != null)
      ? config.fees[String(installments)] : 0;

    if (!config.passFeeToBuyer || feePct === 0) {
      return {
        installments: installments,
        feePercentage: 0,
        installmentValueCents: Math.ceil(amountCents / installments),
        totalCents: amountCents,
        hasInterest: false
      };
    }

    var total = Math.round(amountCents * (1 + feePct / 100));
    return {
      installments: installments,
      feePercentage: feePct,
      installmentValueCents: Math.ceil(total / installments),
      totalCents: total,
      hasInterest: true
    };
  }

  /**
   * Remote quote — pulls THE tenant's real fees from the server.
   * Recommended in production so your site auto-updates if you change fees.
   *
   * Returns: Promise<{
   *   amount_cents, organization_id, max_installments, pass_fee_to_buyer,
   *   installments: [{ installments, fee_percentage, installment_value_cents, total_cents, has_interest }, ...],
   *   selected?: { ... }   // present when `installments` was requested
   * }>
   */
  function quote(opts) {
    var amountCents = opts.amountCents;
    var orgId = opts.organizationId || config.organizationId;
    if (!amountCents) return Promise.reject(new Error('amountCents is required'));

    var url = API_BASE + '?amount_cents=' + encodeURIComponent(amountCents);
    if (orgId) url += '&organization_id=' + encodeURIComponent(orgId);
    if (opts.installments) url += '&installments=' + encodeURIComponent(opts.installments);

    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Quote failed: HTTP ' + r.status);
      return r.json();
    });
  }

  /**
   * Format cents as BRL: 10191 -> "R$ 101,91"
   */
  function formatBRL(cents) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /**
   * Build an installment string: "12x de R$ 101,91"
   */
  function describe(plan) {
    return plan.installments + 'x de ' + formatBRL(plan.installmentValueCents)
      + (plan.hasInterest ? '' : ' sem juros');
  }

  var SDK = {
    version: '1.0.0',
    configure: configure,
    calculate: calculate,
    quote: quote,
    formatBRL: formatBRL,
    describe: describe,
    DEFAULT_FEES: DEFAULT_FEES
  };

  // UMD-ish: attach to window AND export for ES modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SDK;
    module.exports.AtomicCheckout = SDK;
  }
  global.AtomicCheckout = SDK;
})(typeof window !== 'undefined' ? window : this);

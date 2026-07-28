// Promotion codes.
//
// Hardcoded here rather than fetched, because these are demo codes and putting
// them in Firestore would mean shipping a public, writable discount table.
// A real system reads them from a promotions service with per-customer usage
// limits and expiry dates; the shape below is the same minus that plumbing.
//
// Every rule that can reject a code returns a REASON. Silently ignoring an
// invalid code is the worst outcome: the shopper types SAVE10, nothing changes,
// and they cannot tell whether the code is expired, does not apply to their
// cart, or the feature is simply broken.

import { clamp, percentOf } from '../lib/money';

export const PROMOTION_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
  FREE_SHIPPING: 'free_shipping',
};

/**
 * @typedef {object} Promotion
 * @property {string} label shown next to the discount line
 * @property {string} type one of PROMOTION_TYPES
 * @property {number} [rate] decimal rate for percentage promotions
 * @property {number} [amountCents] discount for fixed promotions
 * @property {number} minSubtotalCents minimum merchandise total to qualify
 * @property {number|null} maxDiscountCents cap on the discount, null for none
 */

/** @type {Record<string, Promotion>} */
export const PROMOTIONS = {
  SAVE10: {
    label: '10% off your order',
    type: PROMOTION_TYPES.PERCENTAGE,
    rate: 0.1,
    minSubtotalCents: 0,
    // Capped so a percentage code cannot become unboundedly expensive on a
    // large order. An uncapped percentage promo is how discount abuse starts.
    maxDiscountCents: 2000,
  },
  WELCOME15: {
    label: '15% off orders over $50',
    type: PROMOTION_TYPES.PERCENTAGE,
    rate: 0.15,
    minSubtotalCents: 5000,
    maxDiscountCents: 5000,
  },
  TAKE5: {
    label: '$5 off orders over $25',
    type: PROMOTION_TYPES.FIXED,
    amountCents: 500,
    minSubtotalCents: 2500,
    maxDiscountCents: null,
  },
  FREESHIP: {
    label: 'Free standard shipping',
    type: PROMOTION_TYPES.FREE_SHIPPING,
    minSubtotalCents: 3000,
    maxDiscountCents: null,
  },
};

/** Why a code did not apply. Surfaced to the shopper. */
export const REJECTION = {
  UNKNOWN_CODE: 'unknown_code',
  BELOW_MINIMUM: 'below_minimum',
  EMPTY_CART: 'empty_cart',
  DISABLED: 'disabled',
};

/**
 * Find a promotion by code. Case-insensitive and whitespace-tolerant, because
 * shoppers paste codes out of emails.
 *
 * @param {string} [code]
 * @returns {{ code: string, promotion: Promotion }|null}
 */
export function lookupPromotion(code) {
  if (typeof code !== 'string') return null;

  const normalized = code.trim().toUpperCase();

  if (!normalized || !PROMOTIONS[normalized]) return null;

  return { code: normalized, promotion: PROMOTIONS[normalized] };
}

/**
 * Work out what a code is worth against a given cart.
 *
 * Returns a zero-value result rather than throwing when the code does not
 * apply, so the caller can price the order either way and show the reason.
 *
 * @param {object} input
 * @param {string} [input.code]
 * @param {number} input.merchandiseCents merchandise total before discount
 * @param {number} input.shippingCents shipping before discount
 * @param {boolean} [input.enabled] false when the promotions flag is off
 * @returns {{
 *   code: string|null,
 *   label: string|null,
 *   applied: boolean,
 *   reason: string|null,
 *   discountCents: number,
 *   shippingDiscountCents: number
 * }}
 */
export function applyPromotion({
  code,
  merchandiseCents,
  shippingCents = 0,
  enabled = true,
}) {
  const none = {
    code: null,
    label: null,
    applied: false,
    reason: null,
    discountCents: 0,
    shippingDiscountCents: 0,
  };

  // No code entered at all is not an error - it is the normal case.
  if (!code || (typeof code === 'string' && !code.trim())) {
    return none;
  }

  if (!enabled) {
    return { ...none, code: code.trim().toUpperCase(), reason: REJECTION.DISABLED };
  }

  const found = lookupPromotion(code);

  if (!found) {
    return { ...none, code: code.trim().toUpperCase(), reason: REJECTION.UNKNOWN_CODE };
  }

  const { promotion } = found;
  const base = { ...none, code: found.code, label: promotion.label };

  if (merchandiseCents <= 0) {
    return { ...base, reason: REJECTION.EMPTY_CART };
  }

  // The minimum is checked against merchandise only. Letting shipping charges
  // count towards a spend threshold would mean a shopper could qualify for a
  // discount by upgrading to overnight delivery.
  if (merchandiseCents < promotion.minSubtotalCents) {
    return { ...base, reason: REJECTION.BELOW_MINIMUM };
  }

  if (promotion.type === PROMOTION_TYPES.FREE_SHIPPING) {
    return {
      ...base,
      applied: true,
      shippingDiscountCents: shippingCents,
    };
  }

  const raw =
    promotion.type === PROMOTION_TYPES.PERCENTAGE
      ? percentOf(merchandiseCents, promotion.rate)
      : promotion.amountCents;

  // Two ceilings: the promotion's own cap, and the order itself. A discount
  // larger than the order would produce a negative total, which Stripe rejects
  // and which would otherwise reach the API as a confusing 400.
  const capped = promotion.maxDiscountCents === null ? raw : Math.min(raw, promotion.maxDiscountCents);

  return {
    ...base,
    applied: true,
    discountCents: clamp(capped, 0, merchandiseCents),
  };
}

/**
 * Codes available for display. Not something a real storefront exposes - this
 * is here so the demo is discoverable without reading the source.
 *
 * @returns {Array<{ code: string, label: string }>}
 */
export function listPromotions() {
  return Object.entries(PROMOTIONS).map(([code, promotion]) => ({
    code,
    label: promotion.label,
  }));
}

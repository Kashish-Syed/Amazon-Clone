// Shipping cost rules.
//
// Three service levels, each with a flat base rate, an optional free-shipping
// threshold, and a per-item surcharge once an order exceeds a bundle size.
//
// The threshold is compared against merchandise AFTER discount. That is a
// deliberate business decision, not an accident: if a promo code could push an
// order over the free-shipping line, a $5 discount on a $48 order would cost us
// the discount AND the shipping. Comparing before the discount instead is a
// perfectly defensible policy - it is just a different one, and the difference
// only ever shows up on orders sitting right at the boundary.

export const FREE_SHIPPING_THRESHOLD_CENTS = 5000;

/**
 * @typedef {object} ShippingMethod
 * @property {string} label
 * @property {number} baseCents flat cost before surcharges
 * @property {number|null} freeAboveCents merchandise total at which it is free
 * @property {number} itemsIncluded items covered by the base rate
 * @property {number} perExtraItemCents charged per item beyond itemsIncluded
 * @property {string} estimate human-readable delivery window
 */

/** @type {Record<string, ShippingMethod>} */
export const SHIPPING_METHODS = {
  standard: {
    label: 'Standard',
    baseCents: 599,
    freeAboveCents: FREE_SHIPPING_THRESHOLD_CENTS,
    itemsIncluded: 10,
    perExtraItemCents: 150,
    estimate: '5-7 business days',
  },
  express: {
    label: 'Express',
    baseCents: 1499,
    // Never free: expedited carriers are billed per shipment regardless of cart
    // value, so a free-shipping threshold here would be sold at a loss.
    freeAboveCents: null,
    itemsIncluded: 5,
    perExtraItemCents: 150,
    estimate: '2 business days',
  },
  overnight: {
    label: 'Overnight',
    baseCents: 29.99,
    freeAboveCents: null,
    itemsIncluded: 3,
    perExtraItemCents: 300,
    estimate: 'Next business day',
  },
};

export const DEFAULT_SHIPPING_METHOD = 'standard';

/**
 * Resolve a method id, falling back to standard for anything unrecognised.
 *
 * @param {string} [methodId]
 * @returns {{ id: string, method: ShippingMethod, recognised: boolean }}
 */
export function resolveShippingMethod(methodId) {
  if (methodId && SHIPPING_METHODS[methodId]) {
    return { id: methodId, method: SHIPPING_METHODS[methodId], recognised: true };
  }

  return {
    id: DEFAULT_SHIPPING_METHOD,
    method: SHIPPING_METHODS[DEFAULT_SHIPPING_METHOD],
    recognised: false,
  };
}

/**
 * Work out what to charge for shipping.
 *
 * @param {object} input
 * @param {number} input.merchandiseCents merchandise total after discount
 * @param {number} input.itemCount total units, counting quantities
 * @param {string} [input.methodId]
 * @returns {{
 *   methodId: string,
 *   methodLabel: string,
 *   estimate: string,
 *   recognisedMethod: boolean,
 *   baseCents: number,
 *   surchargeCents: number,
 *   freeShippingApplied: boolean,
 *   shippingCents: number
 * }}
 */
export function computeShipping({ merchandiseCents, itemCount = 0, methodId }) {
  const { id, method, recognised } = resolveShippingMethod(methodId);

  // An empty cart ships nothing. Without this, an empty basket would still be
  // quoted the $5.99 base rate.
  if (itemCount <= 0) {
    return {
      methodId: id,
      methodLabel: method.label,
      estimate: method.estimate,
      recognisedMethod: recognised,
      baseCents: 0,
      surchargeCents: 0,
      freeShippingApplied: false,
      shippingCents: 0,
    };
  }

  const extraItems = Math.max(itemCount - method.itemsIncluded, 0);
  const surchargeCents = extraItems * method.perExtraItemCents;

  const freeShippingApplied =
    method.freeAboveCents !== null && merchandiseCents >= method.freeAboveCents;

  // Free shipping waives the base rate. The per-item surcharge still applies:
  // it covers the extra parcels a large order actually costs us to send.
  const shippingCents = freeShippingApplied
    ? surchargeCents
    : method.baseCents + surchargeCents;

  return {
    methodId: id,
    methodLabel: method.label,
    estimate: method.estimate,
    recognisedMethod: recognised,
    baseCents: freeShippingApplied ? 0 : method.baseCents,
    surchargeCents,
    freeShippingApplied,
    shippingCents,
  };
}

/**
 * Methods available for selection, honouring the express feature flag.
 *
 * @param {{ expressShipping?: boolean }} [features]
 * @returns {Array<{ id: string, label: string, estimate: string, baseCents: number }>}
 */
export function listShippingMethods(features = {}) {
  const allowExpress = features.expressShipping !== false;

  return Object.entries(SHIPPING_METHODS)
    .filter(([id]) => allowExpress || id === DEFAULT_SHIPPING_METHOD)
    .map(([id, method]) => ({
      id,
      label: method.label,
      estimate: method.estimate,
      baseCents: method.baseCents,
    }));
}

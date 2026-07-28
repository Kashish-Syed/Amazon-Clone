// Sales tax estimation.
//
// This is an ESTIMATE shown at checkout, not a filing-grade calculation. Real
// storefronts hand this to Avalara, TaxJar or Stripe Tax, because rates vary by
// county and by product category. The table below is a fixed, deliberately
// small stand-in with the shape of the real thing.
//
// The detail worth noticing: whether shipping is taxable is NOT universal. In
// California it generally is not; in Texas and Ontario it is. Getting that
// wrong produces a total that is off by a few cents to a few dollars - large
// enough to be a real accounting problem, small enough that nobody notices in
// testing.

import { percentOf } from '../lib/money';

/**
 * @typedef {object} TaxRegion
 * @property {string} label
 * @property {number} rate combined rate as a decimal
 * @property {boolean} taxShipping whether shipping charges are taxable here
 */

/** @type {Record<string, TaxRegion>} */
export const TAX_REGIONS = {
  'US-CA': { label: 'California', rate: 0.0725, taxShipping: false },
  'US-NY': { label: 'New York', rate: 0.08875, taxShipping: false },
  'US-TX': { label: 'Texas', rate: 0.0625, taxShipping: true },
  'US-WA': { label: 'Washington', rate: 0.065, taxShipping: true },
  'US-OR': { label: 'Oregon', rate: 0, taxShipping: false },
  'US-DE': { label: 'Delaware', rate: 0, taxShipping: false },
  'CA-ON': { label: 'Ontario', rate: 0.13, taxShipping: true },
  'CA-AB': { label: 'Alberta', rate: 0.05, taxShipping: true },
};

/** Used when the shopper has not told us where they are. */
export const DEFAULT_REGION_CODE = 'US-CA';

/**
 * Look up a region, falling back to the default for unknown codes.
 *
 * @param {string} [code]
 * @returns {{ code: string, region: TaxRegion, recognised: boolean }}
 */
export function resolveRegion(code) {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';

  if (TAX_REGIONS[normalized]) {
    return { code: normalized, region: TAX_REGIONS[normalized], recognised: true };
  }

  return {
    code: DEFAULT_REGION_CODE,
    region: TAX_REGIONS[DEFAULT_REGION_CODE],
    recognised: false,
  };
}

/**
 * Estimate tax on an order.
 *
 * Tax is charged on merchandise AFTER any discount - a discount reduces the
 * sale price, so it reduces the taxable amount with it. Charging tax on the
 * pre-discount figure overcharges the customer.
 *
 * @param {object} input
 * @param {number} input.taxableMerchandiseCents merchandise after discount
 * @param {number} input.shippingCents shipping actually charged
 * @param {string} [input.regionCode]
 * @returns {{
 *   regionCode: string,
 *   regionLabel: string,
 *   rate: number,
 *   recognisedRegion: boolean,
 *   shippingTaxed: boolean,
 *   taxableCents: number,
 *   taxCents: number
 * }}
 */
export function computeTax({ taxableMerchandiseCents, shippingCents = 0, regionCode }) {
  const { code, region, recognised } = resolveRegion(regionCode);

  const taxableCents =
    taxableMerchandiseCents + (region.taxShipping ? shippingCents : 0);

  return {
    regionCode: code,
    regionLabel: region.label,
    rate: region.rate,
    recognisedRegion: recognised,
    shippingTaxed: region.taxShipping,
    taxableCents,
    taxCents: percentOf(taxableCents, region.rate),
  };
}

/**
 * Region codes and labels, for a picker.
 * @returns {Array<{code: string, label: string}>}
 */
export function listRegions() {
  return Object.entries(TAX_REGIONS).map(([code, region]) => ({
    code,
    label: region.label,
  }));
}

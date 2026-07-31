// The pricing engine: cart lines in, a full order breakdown out.
//
// THE ORDER OF OPERATIONS IS THE WHOLE POINT OF THIS FILE.
//
//   1. merchandise      = sum of every line (unit price x quantity)
//   2. discount         = promotion applied to merchandise, capped
//   3. net merchandise  = merchandise - discount
//   4. shipping         = quoted from NET merchandise and unit count
//   5. shipping waiver  = free-shipping promotions applied to that quote
//   6. tax              = rate x (net merchandise + shipping, if the region taxes it)
//   7. total            = net merchandise + shipping charged + tax
//
// Every one of those steps is a decision that could defensibly go the other
// way, and swapping any two of them changes the number a customer is charged
// without producing an error anywhere. Taxing before the discount overcharges.
// Quoting shipping from the pre-discount merchandise hands out free delivery
// that was not earned. Capping the discount after tax lets a total go negative.
//
// Nothing here touches React, Firestore or Stripe. It is all pure functions
// over integers, which is why it is the easiest part of the app to test and
// the hardest part to get right.

import { MAX_AMOUNT_CENTS, allocate } from '../lib/money';
import { itemCount, lineCount, lineTotalCents, merchandiseTotalCents } from './cart';
import { applyPromotion } from './promotions';
import { DEFAULT_SHIPPING_METHOD, computeShipping } from './shipping';
import { DEFAULT_REGION_CODE, computeTax } from './tax';

export const CURRENCY = 'USD';

/** Non-fatal conditions worth showing the shopper or logging. */
export const WARNINGS = {
  UNRECOGNISED_REGION: 'unrecognised_region',
  UNRECOGNISED_SHIPPING_METHOD: 'unrecognised_shipping_method',
  PROMOTION_REJECTED: 'promotion_rejected',
  EXCEEDS_MAXIMUM: 'exceeds_maximum',
};

/**
 * @typedef {object} OrderPricing
 * @property {string} currency
 * @property {number} itemCount total units
 * @property {number} lineCount distinct products
 * @property {object[]} lines per-line breakdown including allocated discount
 * @property {number} merchandiseCents before any adjustment
 * @property {number} discountCents promotional discount on merchandise
 * @property {number} netMerchandiseCents merchandise after discount
 * @property {object} shipping quote, waiver and amount actually charged
 * @property {object} tax region, rate and amount
 * @property {object} promotion outcome of the code that was supplied
 * @property {number} totalCents the amount to charge
 * @property {string[]} warnings
 */

/**
 * Price an order.
 *
 * @param {object} input
 * @param {import('./cart').CartLine[]} input.lines
 * @param {string} [input.promoCode]
 * @param {string} [input.regionCode]
 * @param {string} [input.shippingMethodId]
 * @param {{promotions?: boolean, taxEstimates?: boolean}} [input.features]
 * @returns {OrderPricing}
 */
export function priceOrder({
  lines = [],
  promoCode,
  regionCode = DEFAULT_REGION_CODE,
  shippingMethodId = DEFAULT_SHIPPING_METHOD,
  features = {},
} = {}) {
  const warnings = [];

  const units = itemCount(lines);
  const merchandiseCents = merchandiseTotalCents(lines);

  // --- Step 2: discount on merchandise ------------------------------------
  // Quoted with zero shipping because shipping does not exist yet. Free
  // shipping promotions are settled below, once there is a quote to waive.
  const provisionalPromotion = applyPromotion({
    code: promoCode,
    merchandiseCents,
    shippingCents: 0,
    enabled: features.promotions !== false,
  });

  const discountCents = provisionalPromotion.discountCents;
  const netMerchandiseCents = merchandiseCents - discountCents;

  // --- Step 4: shipping, quoted from the DISCOUNTED merchandise -----------
  const shippingQuote = computeShipping({
    merchandiseCents: netMerchandiseCents,
    itemCount: units,
    methodId: shippingMethodId,
  });

  if (!shippingQuote.recognisedMethod && shippingMethodId !== DEFAULT_SHIPPING_METHOD) {
    warnings.push(WARNINGS.UNRECOGNISED_SHIPPING_METHOD);
  }

  // --- Step 5: settle the promotion against the real shipping figure ------
  // applyPromotion is pure, so re-running it with the quote in hand costs
  // nothing and keeps the free-shipping rule in one place.
  const promotion = applyPromotion({
    code: promoCode,
    merchandiseCents,
    shippingCents: shippingQuote.shippingCents,
    enabled: features.promotions !== false,
  });

  if (promotion.code && !promotion.applied) {
    warnings.push(WARNINGS.PROMOTION_REJECTED);
  }

  const shippingDiscountCents = Math.min(
    promotion.shippingDiscountCents,
    shippingQuote.shippingCents
  );
  const shippingChargedCents = shippingQuote.shippingCents - shippingDiscountCents;

  // --- Step 6: tax --------------------------------------------------------
  const taxEnabled = features.taxEstimates !== false;

  const tax = taxEnabled
    ? computeTax({
        taxableMerchandiseCents: netMerchandiseCents,
        shippingCents: shippingQuote.shippingCents,
        regionCode,
      })
    : {
        regionCode,
        regionLabel: 'Not calculated',
        rate: 0,
        recognisedRegion: true,
        shippingTaxed: false,
        taxableCents: 0,
        taxCents: 0,
      };

  if (taxEnabled && !tax.recognisedRegion && regionCode !== DEFAULT_REGION_CODE) {
    warnings.push(WARNINGS.UNRECOGNISED_REGION);
  }

  // --- Step 7: total ------------------------------------------------------
  const totalCents = netMerchandiseCents + shippingChargedCents + tax.taxCents;

  if (totalCents > MAX_AMOUNT_CENTS) {
    warnings.push(WARNINGS.EXCEEDS_MAXIMUM);
  }

  return {
    currency: CURRENCY,
    itemCount: units,
    lineCount: lineCount(lines),
    lines: buildLineBreakdown(lines, discountCents),
    merchandiseCents,
    discountCents,
    netMerchandiseCents,
    shipping: {
      ...shippingQuote,
      discountCents: shippingDiscountCents,
      chargedCents: shippingChargedCents,
    },
    tax,
    promotion,
    totalCents,
    warnings,
  };
}

/**
 * Spread an order-level discount back across the lines it came from.
 *
 * Needed because the order record stores what each line actually sold for -
 * that is what a refund, a return or a tax report works from. Splitting by
 * line value with largest-remainder allocation guarantees the per-line
 * discounts add up to the order discount exactly, with no stray cent.
 *
 * @param {import('./cart').CartLine[]} lines
 * @param {number} discountCents
 * @returns {object[]}
 */
function buildLineBreakdown(lines, discountCents) {
  if (lines.length === 0) return [];

  const grossPerLine = lines.map(lineTotalCents);
  const discountPerLine =
    discountCents > 0 ? allocate(discountCents, grossPerLine) : grossPerLine.map(() => 0);

  return lines.map((line, index) => ({
    productId: line.productId,
    title: line.title,
    // Carried through so an order record can be rendered months later without
    // re-reading the catalogue - by then the product may have been edited or
    // deleted, and the order should still show what was actually bought.
    image: line.image,
    description: line.description,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    lineTotalCents: grossPerLine[index],
    discountCents: discountPerLine[index],
    netCents: grossPerLine[index] - discountPerLine[index],
  }));
}

/**
 * The pricing of an empty cart. Handy for initial render, so the summary does
 * not have to special-case a null.
 *
 * @returns {OrderPricing}
 */
export function emptyPricing() {
  return priceOrder({ lines: [] });
}

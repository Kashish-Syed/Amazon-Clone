// The cart, as data.
//
// A cart is a list of LINES, not a list of products. Adding the same item twice
// increments a quantity instead of appending a second entry.
//
// The old model pushed a whole product object into an array on every click, so
// two of the same item were two indistinguishable array entries. That made
// "remove" ambiguous (it deleted the first match), made the header count wrong
// once quantities existed, and meant the basket sent to Stripe had no way to
// express "3 of these".
//
// Every function here is pure: it takes lines and returns new lines. Nothing
// mutates, so the reducer can hand the result straight to React and rendering
// stays predictable.

import { multiply } from '../lib/money';

/**
 * Per-line ceiling, independent of stock. Retailers cap quantities to stop one
 * order clearing out inventory and to blunt card-testing with stolen cards.
 */
export const MAX_LINE_QUANTITY = 10;

/**
 * @typedef {object} CartLine
 * @property {string} productId
 * @property {string} title
 * @property {string} description
 * @property {string} image
 * @property {number} unitPriceCents price of one unit at the time it was added
 * @property {number} rating
 * @property {number} quantity
 * @property {number} stock stock level seen when the line was created
 */

/**
 * The most of a given product a shopper may hold.
 *
 * @param {{ stock?: number }} product
 * @returns {number}
 */
export function maxQuantityFor(product) {
  const stock = Number.isFinite(product?.stock) ? product.stock : MAX_LINE_QUANTITY;
  return Math.max(Math.min(stock, MAX_LINE_QUANTITY), 0);
}

/**
 * Build a line from a normalised product.
 *
 * Price is COPIED onto the line rather than referenced. If the catalogue price
 * changes while an item sits in someone's cart, they pay what they were shown.
 *
 * @param {object} product a product from domain/catalog
 * @param {number} [quantity]
 * @returns {CartLine}
 */
export function createLine(product, quantity = 1) {
  return {
    productId: product.id,
    title: product.title,
    description: product.description,
    image: product.image,
    unitPriceCents: product.priceCents,
    rating: product.rating,
    stock: product.stock,
    quantity: Math.min(Math.max(Math.trunc(quantity), 1), maxQuantityFor(product) || 1),
  };
}

/**
 * Add a product, merging into an existing line when one is present.
 *
 * @param {CartLine[]} lines
 * @param {object} product
 * @param {number} [quantity]
 * @returns {{ lines: CartLine[], clamped: boolean }} clamped is true when the
 *   requested quantity was reduced to fit stock or the per-line cap
 */
export function addItem(lines, product, quantity = 1) {
  const requested = Math.max(Math.trunc(quantity), 1);
  const ceiling = maxQuantityFor(product);

  if (ceiling === 0) {
    // Out of stock. Return the cart untouched rather than adding a line the
    // shopper cannot check out with.
    return { lines, clamped: true };
  }

  const index = lines.findIndex((line) => line.productId === product.id);

  if (index === -1) {
    const wanted = Math.min(requested, ceiling);
    return {
      lines: [...lines, { ...createLine(product, wanted), quantity: wanted }],
      clamped: wanted < requested,
    };
  }

  const existing = lines[index];
  const wanted = Math.min(existing.quantity + requested, ceiling);

  const next = [...lines];
  next[index] = { ...existing, quantity: wanted, stock: product.stock };

  return { lines: next, clamped: wanted < existing.quantity + requested };
}

/**
 * Set a line to an exact quantity. Zero removes it.
 *
 * @param {CartLine[]} lines
 * @param {string} productId
 * @param {number} quantity
 * @returns {CartLine[]}
 */
export function setQuantity(lines, productId, quantity) {
  const wanted = Math.trunc(quantity);

  if (wanted <= 0) return removeLine(lines, productId);

  return lines.map((line) => {
    if (line.productId !== productId) return line;

    const ceiling = maxQuantityFor(line) || MAX_LINE_QUANTITY;
    return { ...line, quantity: Math.min(wanted, ceiling) };
  });
}

/**
 * Drop one unit, removing the line when it hits zero.
 *
 * @param {CartLine[]} lines
 * @param {string} productId
 * @returns {CartLine[]}
 */
export function decrementItem(lines, productId) {
  const line = lines.find((candidate) => candidate.productId === productId);

  if (!line) return lines;

  return setQuantity(lines, productId, line.quantity - 1);
}

/**
 * Remove a line entirely, regardless of quantity.
 *
 * @param {CartLine[]} lines
 * @param {string} productId
 * @returns {CartLine[]}
 */
export function removeLine(lines, productId) {
  return lines.filter((line) => line.productId !== productId);
}

/**
 * Total units in the cart, counting quantities.
 *
 * This is what the header badge should show. `lines.length` counts distinct
 * products, so a cart holding three of one item reads as "1".
 *
 * @param {CartLine[]} lines
 * @returns {number}
 */
export function itemCount(lines) {
  return (lines ?? []).reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Number of distinct products.
 *
 * @param {CartLine[]} lines
 * @returns {number}
 */
export function lineCount(lines) {
  return (lines ?? []).length;
}

/**
 * Extended price of a single line.
 *
 * @param {CartLine} line
 * @returns {number} integer cents
 */
export function lineTotalCents(line) {
  return multiply(line.unitPriceCents, line.quantity);
}

/**
 * Merchandise total: every line, before discount, shipping or tax.
 *
 * @param {CartLine[]} lines
 * @returns {number} integer cents
 */
export function merchandiseTotalCents(lines) {
  return (lines ?? []).reduce((sum, line) => sum + lineTotalCents(line), 0);
}

/**
 * Lines whose quantity now exceeds available stock.
 *
 * Stock is captured when a line is created, so it goes stale. Re-checking
 * against a fresh catalogue before checkout is what stops us taking payment
 * for something we cannot ship.
 *
 * @param {CartLine[]} lines
 * @param {object[]} products current catalogue
 * @returns {Array<{ productId: string, requested: number, available: number }>}
 */
export function findStockConflicts(lines, products) {
  const stockById = new Map((products ?? []).map((product) => [product.id, product.stock]));

  return (lines ?? [])
    .map((line) => ({
      productId: line.productId,
      requested: line.quantity,
      // A product that has vanished from the catalogue has no stock at all.
      available: stockById.get(line.productId) ?? 0,
    }))
    .filter((entry) => entry.requested > entry.available);
}

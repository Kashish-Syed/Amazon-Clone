// Turning raw Firestore documents into products the rest of the app can trust.
//
// The `products` collection is not schema-enforced and has been written to by
// hand, by an old seed script, and by the Firebase console. As a result it
// contains a mix of shapes: price as 24.99 and as "24.99", rating as a number
// and as a string, documents with no stock field at all (added before we
// tracked inventory), and one or two with an empty image path.
//
// Rather than let every component defend itself - which is how Product.js and
// CheckoutProduct.js both ended up with their own `Number(rating) || 0` - all
// of that variation is dealt with once, here, at the boundary. Everything
// downstream can assume priceCents is an integer and stock is a number.

import { toCents } from '../lib/money';

/** Shown when a document has no usable image. */
export const PLACEHOLDER_IMAGE = '/images/product1.jpg';

/**
 * Stock level assumed for documents written before inventory tracking existed.
 * Deliberately finite: treating unknown stock as unlimited lets the cart
 * promise quantities the warehouse may not have.
 */
export const DEFAULT_STOCK = 10;

/** Ratings are on a five-point scale. */
export const MAX_RATING = 5;

/** Raised when a document cannot be repaired into a usable product. */
export class ProductValidationError extends Error {
  constructor(message, { productId } = {}) {
    super(message);
    this.name = 'ProductValidationError';
    this.productId = productId;
  }
}

/**
 * Coerce a value that should be a number but might be a numeric string.
 *
 * @param {unknown} value
 * @returns {number|null} null when the value cannot be read as a number
 */
function readNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = typeof value === 'string' ? Number(value.trim()) : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Normalise a single raw Firestore document.
 *
 * @param {object} raw document data, plus an `id`
 * @returns {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   image: string,
 *   priceCents: number,
 *   rating: number,
 *   stock: number,
 *   inStock: boolean
 * }}
 * @throws {ProductValidationError} when price is missing or nonsensical
 */
export function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new ProductValidationError('Product document is not an object');
  }

  const id = raw.id;

  if (!id) {
    throw new ProductValidationError('Product document has no id');
  }

  // Price is the one field we refuse to guess at. A product with no price
  // cannot be sold, and defaulting it to zero would put free items in the
  // catalogue - a silent, expensive failure.
  const price = readNumber(raw.price);

  if (price === null) {
    throw new ProductValidationError(
      `Product ${id} has an unreadable price: ${JSON.stringify(raw.price)}`,
      { productId: id }
    );
  }

  if (price < 0) {
    throw new ProductValidationError(`Product ${id} has a negative price`, { productId: id });
  }

  const rating = readNumber(raw.rating);
  const stock = readNumber(raw.stock);
  const stockLevel = stock === null ? DEFAULT_STOCK : Math.max(Math.trunc(stock), 0);

  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled product',
    description: typeof raw.description === 'string' ? raw.description : '',
    image: typeof raw.image === 'string' && raw.image.trim() ? raw.image.trim() : PLACEHOLDER_IMAGE,
    priceCents: toCents(price),
    // Out-of-range ratings are clamped rather than rejected; a bad rating is a
    // cosmetic problem, not a reason to hide a sellable product.
    rating: rating === null ? 0 : Math.min(Math.max(rating, 0), MAX_RATING),
    stock: stockLevel,
    inStock: stockLevel > 0,
  };
}

/**
 * Normalise a whole collection, keeping what is usable and reporting what is not.
 *
 * One malformed document should not blank the storefront, which is what a
 * `docs.map(normalize)` would do. Callers log `rejected` so the bad rows are
 * visible instead of silently absent.
 *
 * @param {object[]} rawDocuments
 * @returns {{ products: object[], rejected: Array<{id: string|undefined, reason: string}> }}
 */
export function normalizeCatalog(rawDocuments) {
  const products = [];
  const rejected = [];

  for (const raw of rawDocuments ?? []) {
    try {
      products.push(normalizeProduct(raw));
    } catch (error) {
      rejected.push({ id: raw?.id, reason: error.message });
    }
  }

  return { products, rejected };
}

/**
 * Stable display order: in-stock items first, then by title.
 *
 * Firestore returns documents in key order, which is effectively random from a
 * shopper's point of view and changes when a document is rewritten - so the
 * grid used to reshuffle itself for no visible reason.
 *
 * @param {object[]} products
 * @returns {object[]} a new sorted array
 */
export function sortForDisplay(products) {
  return [...products].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

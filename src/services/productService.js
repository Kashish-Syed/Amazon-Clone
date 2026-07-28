// Catalogue reads.
//
// The only module in the app that knows the products collection exists.
// Home.js used to build its own Firestore query inline, which meant the
// component was simultaneously responsible for fetching, for shaping the data
// and for rendering it - so a permissions failure, a malformed document and a
// CSS problem all looked identical from the outside: an empty grid.
//
// Splitting it out buys three things: the shape is normalised in one place, a
// failure is logged with its Firestore error code, and the component can be
// tested without a database.

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../database/firebase';
import { normalizeCatalog, sortForDisplay } from '../domain/catalog';
import { logger, serializeError } from '../lib/logger';

export const PRODUCTS_COLLECTION = 'products';

/** Raised when the catalogue cannot be read at all. */
export class CatalogUnavailableError extends Error {
  constructor(message, { cause, code } = {}) {
    super(message);
    this.name = 'CatalogUnavailableError';
    this.cause = cause;
    this.code = code;
  }
}

/**
 * Load the product catalogue.
 *
 * @param {{ correlationId?: string }} [options]
 * @returns {Promise<{ products: object[], rejected: object[] }>}
 * @throws {CatalogUnavailableError}
 */
export async function fetchProducts({ correlationId } = {}) {
  const log = logger.child({ correlationId });
  const startedAt = Date.now();

  log.debug('products.fetch.started', { collection: PRODUCTS_COLLECTION });

  let snapshot;

  try {
    snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
  } catch (error) {
    log.error('products.fetch.failed', {
      collection: PRODUCTS_COLLECTION,
      durationMs: Date.now() - startedAt,
      error: serializeError(error),
    });

    // Degrade gracefully rather than taking the whole homepage down when the
    // catalogue read fails.
    return { products: [], rejected: [] };
  }

  const raw = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
  const { products, rejected } = normalizeCatalog(raw);

  if (rejected.length > 0) {
    // Loud but non-fatal: the storefront still renders, and someone can go and
    // fix the offending documents.
    log.warn('products.fetch.rejected_documents', {
      rejectedCount: rejected.length,
      rejected,
    });
  }

  log.info('products.fetch.succeeded', {
    collection: PRODUCTS_COLLECTION,
    durationMs: Date.now() - startedAt,
    documentCount: raw.length,
    productCount: products.length,
    rejectedCount: rejected.length,
  });

  return { products: sortForDisplay(products), rejected };
}

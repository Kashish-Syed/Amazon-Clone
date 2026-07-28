// Order reads and writes.
//
// Orders live at users/{uid}/orders/{paymentIntentId}. Using the PaymentIntent
// id as the document id makes the write idempotent for free: if the browser
// retries after a dropped response, the same order is overwritten rather than
// duplicated. An auto-generated id would have produced two orders for one card
// charge, which is the kind of thing you only discover from a support ticket.
//
// SCHEMA VERSIONS
//
// v1 (what shipped originally): { basket: Product[], amount, created }. Every
// basket entry was one unit; there was no quantity, no tax and no shipping,
// and `amount` was whatever Stripe happened to charge.
//
// v2 (current): explicit lines with quantities, plus the full price breakdown
// that produced the total.
//
// Old documents still exist in Firestore, so reads normalise both shapes into
// one. Rendering code should never branch on version.

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../database/firebase';
import { toCents } from '../lib/money';
import { logger, serializeError } from '../lib/logger';

export const ORDER_SCHEMA_VERSION = 2;

/** Raised when an order cannot be persisted after a successful charge. */
export class OrderWriteError extends Error {
  constructor(message, { cause, code } = {}) {
    super(message);
    this.name = 'OrderWriteError';
    this.cause = cause;
    this.code = code;
  }
}

function ordersRef(userId) {
  return collection(db, 'users', userId, 'orders');
}

/**
 * Record a completed order.
 *
 * Called AFTER Stripe confirms the charge. If this throws, the customer has
 * been charged and has no order record - so the caller must surface it rather
 * than swallow it, and the message says as much.
 *
 * @param {object} input
 * @param {string} input.userId
 * @param {string} input.paymentIntentId
 * @param {number} input.chargedAt unix seconds, from the PaymentIntent
 * @param {import('../domain/pricing').OrderPricing} input.pricing
 * @param {string} [input.correlationId]
 * @returns {Promise<{ id: string }>}
 * @throws {OrderWriteError}
 */
export async function createOrder({
  userId,
  paymentIntentId,
  chargedAt,
  pricing,
  correlationId,
}) {
  const log = logger.child({ correlationId, paymentIntentId });

  const document = {
    schemaVersion: ORDER_SCHEMA_VERSION,
    paymentIntentId,
    status: 'succeeded',
    currency: pricing.currency,

    // `created` stays a unix-seconds number because Orders.js orders by it and
    // existing v1 documents use that type. Mixing a Timestamp and a number in
    // one collection makes orderBy() return them in two separate groups.
    created: chargedAt,
    // Written alongside it so we can migrate to server time later without
    // breaking the existing sort.
    createdAt: serverTimestamp(),

    // Kept at the top level under its v1 name. Order.js and any report that
    // predates v2 reads `amount`, and it is the figure Stripe actually took.
    amount: pricing.totalCents,

    lines: pricing.lines.map((line) => ({
      productId: line.productId,
      title: line.title,
      image: line.image ?? null,
      description: line.description ?? '',
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      discountCents: line.discountCents,
      netCents: line.netCents,
    })),

    totals: {
      merchandiseCents: pricing.merchandiseCents,
      discountCents: pricing.discountCents,
      netMerchandiseCents: pricing.netMerchandiseCents,
      shippingCents: pricing.shipping.chargedCents,
      taxCents: pricing.tax.taxCents,
      totalCents: pricing.totalCents,
    },

    // Captured so a total can be re-derived and audited months later, after the
    // rate table or the promo has changed.
    context: {
      promoCode: pricing.promotion.code ?? null,
      regionCode: pricing.tax.regionCode,
      taxRate: pricing.tax.rate,
      shippingMethodId: pricing.shipping.methodId,
    },
  };

  try {
    await setDoc(doc(ordersRef(userId), paymentIntentId), document);

    log.info('order.created', {
      userId,
      totalCents: pricing.totalCents,
      lineCount: pricing.lines.length,
    });

    return { id: paymentIntentId };
  } catch (error) {
    log.error('order.create.failed', { userId, error: serializeError(error) });

    throw new OrderWriteError(
      'Your payment went through, but we could not save the order. ' +
        'Please contact support with your payment reference before trying again.',
      { cause: error, code: error?.code }
    );
  }
}

/**
 * Convert a stored order - either schema version - into one display shape.
 *
 * @param {string} id
 * @param {object} data
 * @returns {{
 *   id: string,
 *   schemaVersion: number,
 *   created: number|null,
 *   totalCents: number,
 *   currency: string,
 *   lines: object[],
 *   totals: object|null
 * }}
 */
export function normalizeOrder(id, data) {
  const version = Number(data?.schemaVersion) || 1;

  if (version >= 2) {
    return {
      id,
      schemaVersion: version,
      created: typeof data.created === 'number' ? data.created : null,
      totalCents: data.amount ?? data.totals?.totalCents ?? 0,
      currency: data.currency ?? 'USD',
      lines: data.lines ?? [],
      totals: data.totals ?? null,
    };
  }

  // v1: a flat basket where each entry is a single unit and price is in
  // dollars. Collapse repeats into quantities so the two versions render the
  // same way.
  const byProduct = new Map();

  for (const item of data?.basket ?? []) {
    const key = item?.id ?? item?.productId ?? item?.title ?? 'unknown';
    const existing = byProduct.get(key);

    if (existing) {
      existing.quantity += 1;
      existing.lineTotalCents += existing.unitPriceCents;
      existing.netCents = existing.lineTotalCents;
      continue;
    }

    let unitPriceCents = 0;

    try {
      unitPriceCents = toCents(item?.price ?? 0);
    } catch {
      // A v1 basket entry with an unparseable price still belongs in the
      // order history; showing it at zero beats hiding the order entirely.
      unitPriceCents = 0;
    }

    byProduct.set(key, {
      productId: key,
      title: item?.title ?? 'Unknown item',
      image: item?.image,
      description: item?.description,
      quantity: 1,
      unitPriceCents,
      lineTotalCents: unitPriceCents,
      discountCents: 0,
      netCents: unitPriceCents,
    });
  }

  return {
    id,
    schemaVersion: 1,
    created: typeof data?.created === 'number' ? data.created : null,
    totalCents: data?.amount ?? 0,
    currency: 'USD',
    lines: [...byProduct.values()],
    totals: null,
  };
}

/**
 * Watch a user's orders, newest first.
 *
 * @param {object} input
 * @param {string} input.userId
 * @param {(orders: object[]) => void} input.onChange
 * @param {(error: Error) => void} [input.onError]
 * @param {string} [input.correlationId]
 * @returns {() => void} unsubscribe
 */
export function subscribeToOrders({ userId, onChange, onError, correlationId }) {
  const log = logger.child({ correlationId, userId });
  const ordersQuery = query(ordersRef(userId), orderBy('created', 'desc'));

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((document) =>
        normalizeOrder(document.id, document.data())
      );

      log.debug('orders.snapshot', { orderCount: orders.length });
      onChange(orders);
    },
    (error) => {
      // onSnapshot swallows errors unless you pass this second callback, so a
      // rules change used to leave the orders page stuck on "no orders yet"
      // with nothing in the console.
      log.error('orders.subscribe.failed', { error: serializeError(error) });
      onError?.(error);
    }
  );
}

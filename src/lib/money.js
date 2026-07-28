// Money handling.
//
// RULE: every monetary amount that crosses a module boundary is an INTEGER
// NUMBER OF CENTS. Never a float, never a string.
//
// Floats cannot represent most decimal fractions exactly. 0.1 + 0.2 is
// 0.30000000000000004, and 16.08 * 100 is 1607.9999999999998 - so a naive
// `price * 100` truncates to 1607 and undercharges by a cent. A cart that adds
// float dollars drifts on large orders, and Stripe rejects a non-integer
// amount outright. Working in cents makes every intermediate value exact, and
// the only rounding happens where we explicitly ask for it.
//
// Dollars exist in exactly two places: values read out of Firestore (converted
// on the way in) and text shown to a human (converted on the way out).

/** Largest order we will price. Guards against a corrupt quantity or price. */
export const MAX_AMOUNT_CENTS = 99_999_00;

/**
 * Round half away from zero.
 *
 * Math.round breaks ties towards positive infinity, so it rounds -0.5 to -0
 * and 0.5 to 1 - asymmetric, which shows up as an off-by-one cent on refunds
 * and negative adjustments. Tax and percentage discounts use this instead.
 *
 * @param {number} value
 * @returns {number}
 */
export function roundHalfUp(value) {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Convert a dollar amount to integer cents.
 *
 * Accepts a number or a numeric string, because the products collection in
 * Firestore contains both - some documents were seeded with price: "24.99"
 * and others with price: 24.99.
 *
 * @param {number|string} dollars
 * @returns {number} integer cents
 * @throws {TypeError} if the value is not a finite number
 */
export function toCents(dollars) {
  // Number() is far too forgiving on its own: Number(null), Number('') and
  // Number(false) are all 0, so a missing price would quietly become a free
  // product instead of an error. Reject those before converting.
  if (dollars === null || dollars === undefined || typeof dollars === 'boolean') {
    throw new TypeError(`Cannot convert ${JSON.stringify(dollars)} to cents`);
  }

  if (typeof dollars === 'string' && dollars.trim() === '') {
    throw new TypeError('Cannot convert an empty string to cents');
  }

  const amount = typeof dollars === 'string' ? Number(dollars.trim()) : Number(dollars);

  if (!Number.isFinite(amount)) {
    throw new TypeError(`Cannot convert ${JSON.stringify(dollars)} to cents`);
  }

  return roundHalfUp(amount * 100);
}

/**
 * Convert integer cents back to a dollar number. For display and for the
 * order records we write to Firestore.
 *
 * @param {number} cents
 * @returns {number}
 */
export function toDollars(cents) {
  assertCents(cents);
  return cents / 100;
}

/**
 * Multiply an amount by a whole-number quantity.
 *
 * @param {number} cents
 * @param {number} quantity
 * @returns {number}
 */
export function multiply(cents, quantity) {
  assertCents(cents);

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new TypeError(`Quantity must be a non-negative integer, got ${quantity}`);
  }

  return cents * quantity;
}

/**
 * Take a percentage of an amount, rounded to the nearest cent.
 *
 * @param {number} cents
 * @param {number} rate decimal rate, e.g. 0.0725 for 7.25%
 * @returns {number}
 */
export function percentOf(cents, rate) {
  assertCents(cents);

  if (!Number.isFinite(rate) || rate < 0) {
    throw new TypeError(`Rate must be a non-negative number, got ${rate}`);
  }

  return roundHalfUp(cents * rate);
}

/**
 * Split an amount across N buckets in the given proportions, without losing or
 * inventing a cent.
 *
 * Naively rounding each share independently does not work: a $10.00 discount
 * split three ways gives 333 + 333 + 333 = 999, and the missing cent means the
 * order lines no longer sum to the order total. This uses the largest-remainder
 * method - floor every share, then hand the leftover cents out one at a time to
 * whichever buckets were rounded down hardest.
 *
 * @param {number} cents amount to distribute
 * @param {number[]} weights relative weights, one per bucket
 * @returns {number[]} integer cents per bucket, summing exactly to `cents`
 */
export function allocate(cents, weights) {
  assertCents(cents);

  if (!Array.isArray(weights) || weights.length === 0) {
    throw new TypeError('allocate() needs at least one weight');
  }

  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new TypeError('allocate() weights must be non-negative finite numbers');
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  // No weight anywhere: put everything in the first bucket rather than dividing
  // by zero and returning NaN.
  if (totalWeight === 0) {
    return weights.map((_, index) => (index === 0 ? cents : 0));
  }

  const shares = weights.map((weight) => Math.floor((cents * weight) / totalWeight));
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: (cents * weight) / totalWeight - shares[index],
  }));

  let leftover = cents - shares.reduce((sum, share) => sum + share, 0);

  // Biggest fractional part gets the first spare cent. Ties break on index so
  // the result is deterministic and the tests are not order-dependent.
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; leftover > 0; i = (i + 1) % remainders.length) {
    shares[remainders[i].index] += 1;
    leftover -= 1;
  }

  return shares;
}

/**
 * Clamp an amount into a range. Used to stop a discount exceeding the order.
 *
 * @param {number} cents
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(cents, min, max) {
  return Math.min(Math.max(cents, min), max);
}

/**
 * Format cents for display, e.g. 129900 -> "$1,299.00".
 *
 * @param {number} cents
 * @param {{currency?: string, locale?: string}} [options]
 * @returns {string}
 */
export function format(cents, options = {}) {
  assertCents(cents);

  const { currency = 'USD', locale = 'en-US' } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * True when the value is usable as a monetary amount.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidCents(value) {
  return Number.isInteger(value) && Number.isFinite(value);
}

function assertCents(cents) {
  if (!isValidCents(cents)) {
    throw new TypeError(
      `Expected an integer number of cents, got ${JSON.stringify(cents)}. ` +
        'Amounts must be integers - use toCents() at the boundary.'
    );
  }
}

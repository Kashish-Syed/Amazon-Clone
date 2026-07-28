// Talking to the payments backend.
//
// The backend is a Supabase Edge Function (supabase/functions/payments) that
// holds the Stripe secret key and returns a PaymentIntent client secret. It
// lives there rather than in a Firebase Cloud Function because deploying Cloud
// Functions requires the paid Blaze plan and this project is on Spark.
//
// The amount is validated here as well as on the server. Client-side checks are
// not security - the server re-validates and is the only thing that counts -
// but they turn a confusing 400 from Stripe into a clear message next to the
// button, and they stop us spending a network round trip on a request we
// already know is malformed.

import { httpClient } from '../lib/http';
import { MAX_AMOUNT_CENTS } from '../lib/money';
import { logger, newCorrelationId, serializeError } from '../lib/logger';

/**
 * Stripe's floor for a USD card charge. Below this the API rejects the
 * PaymentIntent outright.
 */
export const MIN_AMOUNT_CENTS = 50;

/** Raised when we cannot obtain a client secret. */
export class PaymentSetupError extends Error {
  constructor(message, { cause, status, retryable = true } = {}) {
    super(message);
    this.name = 'PaymentSetupError';
    this.cause = cause;
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Check an amount before sending it.
 *
 * @param {number} amountCents
 * @returns {string|null} an error message, or null when the amount is fine
 */
export function validateAmount(amountCents) {
  if (!Number.isInteger(amountCents)) {
    return 'Order total must be a whole number of cents.';
  }

  if (amountCents < MIN_AMOUNT_CENTS) {
    return `Orders must be at least $${(MIN_AMOUNT_CENTS / 100).toFixed(2)}.`;
  }

  if (amountCents > MAX_AMOUNT_CENTS) {
    return 'Order total is too large to process online. Please contact support.';
  }

  return null;
}

/**
 * Create a PaymentIntent and return its client secret.
 *
 * @param {object} input
 * @param {number} input.amountCents
 * @param {string} [input.currency]
 * @param {string} [input.correlationId] ties this to the surrounding checkout
 * @returns {Promise<{ clientSecret: string, correlationId: string }>}
 * @throws {PaymentSetupError}
 */
export async function createPaymentIntent({
  amountCents,
  currency = 'usd',
  correlationId = newCorrelationId(),
}) {
  const log = logger.child({ correlationId });

  const problem = validateAmount(amountCents);

  if (problem) {
    log.warn('payment.intent.invalid_amount', { amountCents, problem });
    // Not retryable: sending the same bad amount again will fail identically.
    throw new PaymentSetupError(problem, { retryable: false });
  }

  log.info('payment.intent.requested', { amountCents, currency });

  let response;

  try {
    response = await httpClient.post('', null, {
      params: { total: amountCents, currency },
      headers: { 'X-Correlation-Id': correlationId },
    });
  } catch (error) {
    const status = error.response?.status;

    log.error('payment.intent.failed', { status, error: serializeError(error) });

    throw new PaymentSetupError(
      error.response?.data?.error ??
        'Could not reach the payment service. Please try again in a moment.',
      {
        cause: error,
        status,
        // A 4xx means we sent something wrong; retrying will not help. A 5xx,
        // a timeout or a network drop might clear on its own.
        retryable: !status || status >= 500,
      }
    );
  }

  const clientSecret = response.data?.clientSecret;

  if (!clientSecret) {
    // A 200 with the wrong body is worse than an error status, because
    // everything downstream assumes success. Catch it here.
    log.error('payment.intent.malformed_response', {
      status: response.status,
      keys: Object.keys(response.data ?? {}),
    });

    throw new PaymentSetupError('The payment service returned an unexpected response.', {
      status: response.status,
    });
  }

  log.info('payment.intent.created', { amountCents });

  return { clientSecret, correlationId };
}

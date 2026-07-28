import { httpClient } from '../lib/http';
import {
  MIN_AMOUNT_CENTS,
  PaymentSetupError,
  createPaymentIntent,
  validateAmount,
} from './paymentService';

jest.mock('../lib/http', () => ({
  httpClient: { post: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateAmount', () => {
  it('accepts a normal order', () => {
    expect(validateAmount(2999)).toBeNull();
  });

  it('accepts exactly the minimum', () => {
    expect(validateAmount(MIN_AMOUNT_CENTS)).toBeNull();
  });

  it('rejects a float, which is what a dollars/cents mix-up looks like', () => {
    expect(validateAmount(29.99)).toMatch(/whole number of cents/);
  });

  it('rejects an amount below the Stripe minimum', () => {
    expect(validateAmount(49)).toMatch(/at least/);
  });

  it('rejects an empty order', () => {
    expect(validateAmount(0)).toMatch(/at least/);
  });

  it('rejects an implausibly large order', () => {
    expect(validateAmount(100_000_00)).toMatch(/too large/);
  });
});

describe('createPaymentIntent', () => {
  it('returns the client secret', async () => {
    httpClient.post.mockResolvedValue({ status: 201, data: { clientSecret: 'cs_test_123' } });

    const result = await createPaymentIntent({ amountCents: 2999 });

    expect(result.clientSecret).toBe('cs_test_123');
  });

  it('sends the amount in cents as the total parameter', async () => {
    httpClient.post.mockResolvedValue({ status: 201, data: { clientSecret: 'cs' } });

    await createPaymentIntent({ amountCents: 2999, correlationId: 'abcd1234' });

    const [, body, options] = httpClient.post.mock.calls[0];

    expect(body).toBeNull();
    expect(options.params).toEqual({ total: 2999, currency: 'usd' });
    expect(options.headers['X-Correlation-Id']).toBe('abcd1234');
  });

  it('refuses a bad amount without making a request', async () => {
    await expect(createPaymentIntent({ amountCents: 12.5 })).rejects.toBeInstanceOf(
      PaymentSetupError
    );

    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it('marks a client-side validation failure as not retryable', async () => {
    await expect(createPaymentIntent({ amountCents: 1 })).rejects.toHaveProperty(
      'retryable',
      false
    );
  });

  it('marks a 400 as not retryable, because the same request will fail again', async () => {
    httpClient.post.mockRejectedValue({
      response: { status: 400, data: { error: 'total must be an integer' } },
    });

    const attempt = createPaymentIntent({ amountCents: 2999 });

    await expect(attempt).rejects.toHaveProperty('retryable', false);
    // The server's own message is more specific than anything we could write.
    await expect(attempt).rejects.toThrow('total must be an integer');
  });

  it('marks a 500 as retryable', async () => {
    httpClient.post.mockRejectedValue({ response: { status: 500, data: {} } });

    await expect(createPaymentIntent({ amountCents: 2999 })).rejects.toHaveProperty(
      'retryable',
      true
    );
  });

  it('marks a network failure with no response as retryable', async () => {
    httpClient.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });

    const attempt = createPaymentIntent({ amountCents: 2999 });

    await expect(attempt).rejects.toHaveProperty('retryable', true);
    await expect(attempt).rejects.toThrow(/Could not reach the payment service/);
  });

  it('treats a 200 with no client secret as a failure', async () => {
    // A success status with the wrong body is worse than an error, because
    // everything downstream assumes it worked.
    httpClient.post.mockResolvedValue({ status: 200, data: { ok: true } });

    await expect(createPaymentIntent({ amountCents: 2999 })).rejects.toThrow(
      /unexpected response/
    );
  });
});

import { setDoc } from 'firebase/firestore';
import { ORDER_SCHEMA_VERSION, OrderWriteError, createOrder, normalizeOrder } from './orderService';
import { priceOrder } from '../domain/pricing';

// The SDK is mocked so these tests describe our behaviour, not Firestore's.
jest.mock('../database/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  setDoc: jest.fn(),
}));

const line = (overrides = {}) => ({
  productId: 'p1',
  title: 'Hair Mask',
  description: 'Deep conditioning.',
  image: '/images/product1.jpg',
  unitPriceCents: 1000,
  rating: 4.8,
  stock: 25,
  quantity: 2,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createOrder', () => {
  const pricing = () =>
    priceOrder({ lines: [line()], regionCode: 'US-CA', shippingMethodId: 'standard' });

  it('writes a v2 document keyed by the PaymentIntent id', async () => {
    setDoc.mockResolvedValue(undefined);

    const result = await createOrder({
      userId: 'u1',
      paymentIntentId: 'pi_123',
      chargedAt: 1730000000,
      pricing: pricing(),
    });

    expect(result).toEqual({ id: 'pi_123' });

    const [, document] = setDoc.mock.calls[0];

    expect(document.schemaVersion).toBe(ORDER_SCHEMA_VERSION);
    expect(document.paymentIntentId).toBe('pi_123');
    expect(document.created).toBe(1730000000);
    expect(document.status).toBe('succeeded');
  });

  it('records the amount that was actually charged', async () => {
    setDoc.mockResolvedValue(undefined);
    const quote = pricing();

    await createOrder({
      userId: 'u1',
      paymentIntentId: 'pi_123',
      chargedAt: 1730000000,
      pricing: quote,
    });

    const [, document] = setDoc.mock.calls[0];

    expect(document.amount).toBe(quote.totalCents);
    expect(document.totals.totalCents).toBe(quote.totalCents);
  });

  it('captures the tax rate and promo code so the total can be audited later', async () => {
    setDoc.mockResolvedValue(undefined);

    await createOrder({
      userId: 'u1',
      paymentIntentId: 'pi_123',
      chargedAt: 1730000000,
      pricing: priceOrder({
        lines: [line({ unitPriceCents: 10000, quantity: 1 })],
        promoCode: 'SAVE10',
        regionCode: 'US-TX',
      }),
    });

    const [, document] = setDoc.mock.calls[0];

    expect(document.context).toMatchObject({
      promoCode: 'SAVE10',
      regionCode: 'US-TX',
      taxRate: 0.0625,
      shippingMethodId: 'standard',
    });
  });

  it('keeps the product image on each line', async () => {
    setDoc.mockResolvedValue(undefined);

    await createOrder({
      userId: 'u1',
      paymentIntentId: 'pi_123',
      chargedAt: 1730000000,
      pricing: pricing(),
    });

    const [, document] = setDoc.mock.calls[0];

    expect(document.lines[0].image).toBe('/images/product1.jpg');
    expect(document.lines[0].quantity).toBe(2);
  });

  it('raises a clear error when the write fails after a successful charge', async () => {
    setDoc.mockRejectedValue(Object.assign(new Error('nope'), { code: 'permission-denied' }));

    const attempt = createOrder({
      userId: 'u1',
      paymentIntentId: 'pi_123',
      chargedAt: 1730000000,
      pricing: pricing(),
    });

    // The customer's money has already moved, so this must never be swallowed.
    await expect(attempt).rejects.toBeInstanceOf(OrderWriteError);
    await expect(attempt).rejects.toThrow(/payment went through/i);
  });
});

describe('normalizeOrder', () => {
  it('passes a v2 document through', () => {
    const order = normalizeOrder('pi_1', {
      schemaVersion: 2,
      created: 1730000000,
      amount: 2599,
      currency: 'USD',
      lines: [{ productId: 'p1', title: 'A', quantity: 2, unitPriceCents: 1000 }],
      totals: { totalCents: 2599 },
    });

    expect(order.schemaVersion).toBe(2);
    expect(order.totalCents).toBe(2599);
    expect(order.lines).toHaveLength(1);
  });

  it('reads a v1 document, which had no schemaVersion at all', () => {
    const order = normalizeOrder('pi_old', {
      created: 1700000000,
      amount: 2000,
      basket: [
        { id: 'p1', title: 'Hair Mask', price: 10, image: '/a.jpg' },
        { id: 'p2', title: 'Lip Mask', price: '5.00', image: '/b.jpg' },
      ],
    });

    expect(order.schemaVersion).toBe(1);
    expect(order.totalCents).toBe(2000);
    expect(order.totals).toBeNull();
    expect(order.lines).toHaveLength(2);
    expect(order.lines[0]).toMatchObject({ quantity: 1, unitPriceCents: 1000 });
    // v1 stored prices as dollars, sometimes as strings.
    expect(order.lines[1].unitPriceCents).toBe(500);
  });

  it('collapses repeated v1 basket entries into a quantity', () => {
    const order = normalizeOrder('pi_old', {
      created: 1700000000,
      amount: 3000,
      basket: [
        { id: 'p1', title: 'Hair Mask', price: 10 },
        { id: 'p1', title: 'Hair Mask', price: 10 },
        { id: 'p1', title: 'Hair Mask', price: 10 },
      ],
    });

    expect(order.lines).toHaveLength(1);
    expect(order.lines[0].quantity).toBe(3);
    expect(order.lines[0].lineTotalCents).toBe(3000);
  });

  it('shows a v1 item with an unreadable price at zero rather than hiding the order', () => {
    const order = normalizeOrder('pi_old', {
      created: 1700000000,
      amount: 0,
      basket: [{ id: 'p1', title: 'Mystery', price: 'free' }],
    });

    expect(order.lines[0].unitPriceCents).toBe(0);
  });

  it('tolerates a document with no basket and no lines', () => {
    const order = normalizeOrder('pi_empty', { created: 1700000000, amount: 0 });

    expect(order.lines).toEqual([]);
    expect(order.totalCents).toBe(0);
  });

  it('reports a missing timestamp as null instead of NaN', () => {
    expect(normalizeOrder('pi_x', { amount: 100 }).created).toBeNull();
  });
});

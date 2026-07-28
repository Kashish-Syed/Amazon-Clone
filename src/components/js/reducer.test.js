import reducer, { ACTIONS, initialState, selectItemCount, selectPricing } from './reducer';

const product = (overrides = {}) => ({
  id: 'p1',
  title: 'Hair Mask',
  description: 'Deep conditioning.',
  image: '/images/product1.jpg',
  priceCents: 1000,
  rating: 4.8,
  stock: 25,
  inStock: true,
  ...overrides,
});

const withLines = (lines) => ({ ...initialState, lines });

describe('unknown actions', () => {
  it('leaves state untouched instead of wiping it', () => {
    // The reducer used to fall off the end of the switch and return undefined,
    // which blew away the cart and the signed-in user together.
    const state = withLines([{ productId: 'p1', quantity: 2, unitPriceCents: 1000 }]);

    expect(reducer(state, { type: 'NOT_A_REAL_ACTION' })).toBe(state);
  });

  it('survives a malformed action object', () => {
    const state = withLines([]);

    expect(reducer(state, {})).toBe(state);
  });
});

describe('ADD_TO_CART', () => {
  it('adds a line', () => {
    const next = reducer(initialState, { type: ACTIONS.ADD_TO_CART, product: product() });

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0].quantity).toBe(1);
  });

  it('increments rather than duplicating on a repeat', () => {
    const once = reducer(initialState, { type: ACTIONS.ADD_TO_CART, product: product() });
    const twice = reducer(once, { type: ACTIONS.ADD_TO_CART, product: product() });

    expect(twice.lines).toHaveLength(1);
    expect(twice.lines[0].quantity).toBe(2);
  });

  it('does not add an out-of-stock product', () => {
    const next = reducer(initialState, {
      type: ACTIONS.ADD_TO_CART,
      product: product({ stock: 0, inStock: false }),
    });

    expect(next.lines).toHaveLength(0);
  });

  it('leaves the previous state object alone', () => {
    const before = withLines([]);

    reducer(before, { type: ACTIONS.ADD_TO_CART, product: product() });

    expect(before.lines).toHaveLength(0);
  });
});

describe('quantity actions', () => {
  const seeded = () =>
    reducer(reducer(initialState, { type: ACTIONS.ADD_TO_CART, product: product() }), {
      type: ACTIONS.SET_QUANTITY,
      productId: 'p1',
      quantity: 3,
    });

  it('SET_QUANTITY sets an exact count', () => {
    expect(seeded().lines[0].quantity).toBe(3);
  });

  it('DECREMENT_ITEM drops one', () => {
    const next = reducer(seeded(), { type: ACTIONS.DECREMENT_ITEM, productId: 'p1' });

    expect(next.lines[0].quantity).toBe(2);
  });

  it('REMOVE_FROM_CART drops the whole line', () => {
    const next = reducer(seeded(), { type: ACTIONS.REMOVE_FROM_CART, productId: 'p1' });

    expect(next.lines).toEqual([]);
  });
});

describe('EMPTY_CART', () => {
  it('clears the cart and the promo code together', () => {
    const state = {
      ...withLines([{ productId: 'p1', quantity: 1, unitPriceCents: 1000 }]),
      checkout: { ...initialState.checkout, promoCode: 'SAVE10' },
    };

    const next = reducer(state, { type: ACTIONS.EMPTY_CART });

    expect(next.lines).toEqual([]);
    // Leaving the code behind would silently discount the next, unrelated order.
    expect(next.checkout.promoCode).toBe('');
  });

  it('keeps the region and shipping choices', () => {
    const state = {
      ...withLines([]),
      checkout: { promoCode: '', regionCode: 'US-TX', shippingMethodId: 'express' },
    };

    const next = reducer(state, { type: ACTIONS.EMPTY_CART });

    expect(next.checkout.regionCode).toBe('US-TX');
    expect(next.checkout.shippingMethodId).toBe('express');
  });
});

describe('SET_USER', () => {
  it('stores the user', () => {
    const user = { uid: 'u1', email: 'a@b.com' };

    expect(reducer(initialState, { type: ACTIONS.SET_USER, user }).user).toBe(user);
  });

  it('normalises a missing user to null rather than undefined', () => {
    expect(reducer(initialState, { type: ACTIONS.SET_USER, user: undefined }).user).toBeNull();
  });
});

describe('checkout selections', () => {
  it('stores an uppercased promo code', () => {
    const next = reducer(initialState, { type: ACTIONS.SET_PROMO_CODE, code: 'SAVE10' });

    expect(next.checkout.promoCode).toBe('SAVE10');
  });

  it('stores the region', () => {
    expect(
      reducer(initialState, { type: ACTIONS.SET_REGION, regionCode: 'CA-ON' }).checkout.regionCode
    ).toBe('CA-ON');
  });

  it('stores the shipping method', () => {
    expect(
      reducer(initialState, { type: ACTIONS.SET_SHIPPING_METHOD, methodId: 'overnight' }).checkout
        .shippingMethodId
    ).toBe('overnight');
  });
});

describe('selectors', () => {
  it('selectItemCount counts units, not lines', () => {
    const state = withLines([
      { productId: 'a', quantity: 3, unitPriceCents: 1000 },
      { productId: 'b', quantity: 2, unitPriceCents: 500 },
    ]);

    expect(selectItemCount(state)).toBe(5);
  });

  it('selectPricing runs the pricing engine over current state', () => {
    const state = {
      ...withLines([{ productId: 'a', quantity: 2, unitPriceCents: 1000 }]),
      checkout: { promoCode: '', regionCode: 'US-OR', shippingMethodId: 'standard' },
    };

    const pricing = selectPricing(state);

    expect(pricing.merchandiseCents).toBe(2000);
    expect(pricing.totalCents).toBe(2000 + pricing.shipping.chargedCents);
  });

  it('selectPricing on the initial state is a valid zero order', () => {
    const pricing = selectPricing(initialState);

    expect(pricing.totalCents).toBe(0);
    expect(pricing.itemCount).toBe(0);
  });
});

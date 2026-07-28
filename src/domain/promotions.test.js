import {
  PROMOTIONS,
  REJECTION,
  applyPromotion,
  listPromotions,
  lookupPromotion,
} from './promotions';

describe('lookupPromotion', () => {
  it('is case-insensitive and tolerates padding', () => {
    expect(lookupPromotion('  save10  ')?.code).toBe('SAVE10');
  });

  it('returns null for anything unknown', () => {
    expect(lookupPromotion('NOPE')).toBeNull();
    expect(lookupPromotion('')).toBeNull();
    expect(lookupPromotion(undefined)).toBeNull();
    expect(lookupPromotion(42)).toBeNull();
  });
});

describe('applyPromotion', () => {
  it('treats no code as the normal case, not an error', () => {
    const result = applyPromotion({ merchandiseCents: 5000 });

    expect(result).toMatchObject({ applied: false, reason: null, discountCents: 0 });
  });

  it('reports an unknown code rather than ignoring it', () => {
    const result = applyPromotion({ code: 'BOGUS', merchandiseCents: 5000 });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe(REJECTION.UNKNOWN_CODE);
    expect(result.code).toBe('BOGUS');
  });

  it('reports why a valid code did not qualify', () => {
    // WELCOME15 needs $50; this cart is $10.
    const result = applyPromotion({ code: 'WELCOME15', merchandiseCents: 1000 });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe(REJECTION.BELOW_MINIMUM);
    expect(result.label).toBe(PROMOTIONS.WELCOME15.label);
  });

  it('applies a percentage discount', () => {
    expect(applyPromotion({ code: 'SAVE10', merchandiseCents: 10000 }).discountCents).toBe(1000);
  });

  it('caps a percentage discount so it cannot run away on a large order', () => {
    // 10% of $500 is $50, but SAVE10 is capped at $20.
    expect(applyPromotion({ code: 'SAVE10', merchandiseCents: 50000 }).discountCents).toBe(2000);
  });

  it('applies a fixed discount', () => {
    expect(applyPromotion({ code: 'TAKE5', merchandiseCents: 3000 }).discountCents).toBe(500);
  });

  it('never discounts more than the order is worth', () => {
    // A discount larger than the cart would make the total negative, which
    // Stripe rejects outright.
    const result = applyPromotion({ code: 'TAKE5', merchandiseCents: 2500 });

    expect(result.discountCents).toBeLessThanOrEqual(2500);
  });

  it('waives shipping rather than discounting merchandise for a free-shipping code', () => {
    const result = applyPromotion({
      code: 'FREESHIP',
      merchandiseCents: 4000,
      shippingCents: 599,
    });

    expect(result.applied).toBe(true);
    expect(result.discountCents).toBe(0);
    expect(result.shippingDiscountCents).toBe(599);
  });

  it('rejects everything when the promotions feature is switched off', () => {
    const result = applyPromotion({
      code: 'SAVE10',
      merchandiseCents: 10000,
      enabled: false,
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe(REJECTION.DISABLED);
    expect(result.discountCents).toBe(0);
  });

  it('rejects a code against an empty cart', () => {
    const result = applyPromotion({ code: 'SAVE10', merchandiseCents: 0 });

    expect(result.reason).toBe(REJECTION.EMPTY_CART);
  });

  it('ignores shipping when checking the minimum spend', () => {
    // Otherwise upgrading to overnight delivery could unlock a discount.
    const result = applyPromotion({
      code: 'WELCOME15',
      merchandiseCents: 4000,
      shippingCents: 2999,
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe(REJECTION.BELOW_MINIMUM);
  });
});

describe('listPromotions', () => {
  it('returns every code with its label', () => {
    expect(listPromotions()).toEqual(
      Object.entries(PROMOTIONS).map(([code, promotion]) => ({
        code,
        label: promotion.label,
      }))
    );
  });
});

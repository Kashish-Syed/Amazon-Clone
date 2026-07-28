import { WARNINGS, emptyPricing, priceOrder } from './pricing';
import { REJECTION } from './promotions';

// $10.00 per unit unless a test says otherwise. Prices are chosen so the
// expected figures below can be checked by hand.
const line = (overrides = {}) => ({
  productId: 'p1',
  title: 'Item',
  description: '',
  image: '/images/product1.jpg',
  unitPriceCents: 1000,
  rating: 4,
  stock: 25,
  quantity: 1,
  ...overrides,
});

// Oregon has no sales tax, which isolates whichever rule a test is about.
const NO_TAX = 'US-OR';

describe('the arithmetic holds together', () => {
  const scenarios = [
    { name: 'empty cart', input: { lines: [] } },
    { name: 'single item', input: { lines: [line()] } },
    { name: 'discounted', input: { lines: [line({ quantity: 6 })], promoCode: 'SAVE10' } },
    {
      name: 'taxed with taxable shipping',
      input: { lines: [line({ quantity: 2 })], regionCode: 'US-TX' },
    },
    {
      name: 'express with surcharge',
      input: { lines: [line({ quantity: 9 })], shippingMethodId: 'express' },
    },
    {
      name: 'free shipping code',
      input: { lines: [line({ quantity: 4 })], promoCode: 'FREESHIP' },
    },
  ];

  it.each(scenarios)('$name: total is net + shipping + tax', ({ input }) => {
    const pricing = priceOrder(input);

    expect(pricing.totalCents).toBe(
      pricing.netMerchandiseCents + pricing.shipping.chargedCents + pricing.tax.taxCents
    );
  });

  it.each(scenarios)('$name: net is merchandise minus discount', ({ input }) => {
    const pricing = priceOrder(input);

    expect(pricing.netMerchandiseCents).toBe(pricing.merchandiseCents - pricing.discountCents);
  });

  it.each(scenarios)('$name: every figure is a whole number of cents', ({ input }) => {
    const pricing = priceOrder(input);

    for (const value of [
      pricing.merchandiseCents,
      pricing.discountCents,
      pricing.netMerchandiseCents,
      pricing.shipping.chargedCents,
      pricing.tax.taxCents,
      pricing.totalCents,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('an empty cart', () => {
  it('costs nothing and is not charged for shipping', () => {
    const pricing = emptyPricing();

    expect(pricing.itemCount).toBe(0);
    expect(pricing.merchandiseCents).toBe(0);
    expect(pricing.shipping.chargedCents).toBe(0);
    expect(pricing.tax.taxCents).toBe(0);
    expect(pricing.totalCents).toBe(0);
  });
});

describe('merchandise', () => {
  it('multiplies unit price by quantity', () => {
    const pricing = priceOrder({ lines: [line({ quantity: 3 })], regionCode: NO_TAX });

    expect(pricing.merchandiseCents).toBe(3000);
    expect(pricing.itemCount).toBe(3);
    expect(pricing.lineCount).toBe(1);
  });

  it('sums across lines', () => {
    const pricing = priceOrder({
      lines: [line({ quantity: 2 }), line({ productId: 'p2', unitPriceCents: 2477 })],
      regionCode: NO_TAX,
    });

    expect(pricing.merchandiseCents).toBe(2000 + 2477);
    expect(pricing.itemCount).toBe(3);
    expect(pricing.lineCount).toBe(2);
  });
});

describe('shipping', () => {
  it('charges the standard rate below the free-shipping threshold', () => {
    const pricing = priceOrder({ lines: [line()], regionCode: NO_TAX });

    expect(pricing.shipping.chargedCents).toBe(599);
    expect(pricing.totalCents).toBe(1599);
  });

  it('is free at exactly the threshold', () => {
    // $50.00 - the boundary itself, which is where off-by-one bugs live.
    const pricing = priceOrder({ lines: [line({ quantity: 5 })], regionCode: NO_TAX });

    expect(pricing.merchandiseCents).toBe(5000);
    expect(pricing.shipping.freeShippingApplied).toBe(true);
    expect(pricing.shipping.chargedCents).toBe(0);
    expect(pricing.totalCents).toBe(5000);
  });

  it('is charged one cent below the threshold', () => {
    const pricing = priceOrder({
      lines: [line({ quantity: 4 }), line({ productId: 'p2', unitPriceCents: 999 })],
      regionCode: NO_TAX,
    });

    expect(pricing.merchandiseCents).toBe(4999);
    expect(pricing.shipping.freeShippingApplied).toBe(false);
    expect(pricing.shipping.chargedCents).toBe(599);
  });

  it('is quoted from the DISCOUNTED merchandise, so a discount can cost the free shipping', () => {
    // $50.00 of goods qualifies for free shipping. TAKE5 knocks $5 off, which
    // drops the order to $45 and back into paid shipping. Quoting shipping
    // before the discount instead would hand out $5.99 of delivery for free.
    const pricing = priceOrder({
      lines: [line({ quantity: 5 })],
      promoCode: 'TAKE5',
      regionCode: NO_TAX,
    });

    expect(pricing.discountCents).toBe(500);
    expect(pricing.netMerchandiseCents).toBe(4500);
    expect(pricing.shipping.freeShippingApplied).toBe(false);
    expect(pricing.shipping.chargedCents).toBe(599);
    expect(pricing.totalCents).toBe(5099);
  });

  it('adds a per-item surcharge beyond the included bundle', () => {
    // Express covers 5 items; 9 items means 4 extra at $1.50 each.
    const pricing = priceOrder({
      lines: [line({ quantity: 9 })],
      shippingMethodId: 'express',
      regionCode: NO_TAX,
    });

    expect(pricing.shipping.baseCents).toBe(1499);
    expect(pricing.shipping.surchargeCents).toBe(600);
    expect(pricing.shipping.chargedCents).toBe(2099);
  });

  it('never makes express free, however large the order', () => {
    const pricing = priceOrder({
      lines: [line({ quantity: 10, unitPriceCents: 10000 })],
      shippingMethodId: 'express',
      regionCode: NO_TAX,
    });

    expect(pricing.shipping.freeShippingApplied).toBe(false);
    expect(pricing.shipping.chargedCents).toBeGreaterThan(0);
  });

  it('falls back to standard for an unknown method and warns', () => {
    const pricing = priceOrder({
      lines: [line()],
      shippingMethodId: 'teleport',
      regionCode: NO_TAX,
    });

    expect(pricing.shipping.methodId).toBe('standard');
    expect(pricing.warnings).toContain(WARNINGS.UNRECOGNISED_SHIPPING_METHOD);
  });
});

describe('tax', () => {
  it('is charged on merchandise AFTER the discount', () => {
    const pricing = priceOrder({
      lines: [line({ unitPriceCents: 10000 })],
      promoCode: 'SAVE10',
      regionCode: 'US-CA',
    });

    expect(pricing.discountCents).toBe(1000);
    expect(pricing.netMerchandiseCents).toBe(9000);
    // 7.25% of $90.00 = $6.525, rounded to $6.53.
    expect(pricing.tax.taxCents).toBe(653);
    // Taxing the pre-discount $100.00 would have produced $7.25 - overcharging
    // the customer by 72 cents.
    expect(pricing.tax.taxCents).not.toBe(725);
    expect(pricing.totalCents).toBe(9653);
  });

  it('excludes shipping in a region that does not tax it', () => {
    const pricing = priceOrder({ lines: [line()], regionCode: 'US-CA' });

    expect(pricing.tax.shippingTaxed).toBe(false);
    expect(pricing.tax.taxableCents).toBe(1000);
    // 7.25% of $10.00 = $0.725 -> $0.73
    expect(pricing.tax.taxCents).toBe(73);
    expect(pricing.totalCents).toBe(1672);
  });

  it('includes shipping in a region that does tax it', () => {
    const pricing = priceOrder({ lines: [line()], regionCode: 'US-TX' });

    expect(pricing.tax.shippingTaxed).toBe(true);
    expect(pricing.tax.taxableCents).toBe(1599);
    // 6.25% of $15.99 = $0.999375 -> $1.00
    expect(pricing.tax.taxCents).toBe(100);
    expect(pricing.totalCents).toBe(1699);
  });

  it('charges nothing in a zero-rate region', () => {
    const pricing = priceOrder({ lines: [line()], regionCode: 'US-OR' });

    expect(pricing.tax.taxCents).toBe(0);
  });

  it('falls back to the default region for an unknown code and warns', () => {
    const pricing = priceOrder({ lines: [line()], regionCode: 'XX-ZZ' });

    expect(pricing.tax.regionCode).toBe('US-CA');
    expect(pricing.warnings).toContain(WARNINGS.UNRECOGNISED_REGION);
  });

  it('is skipped entirely when the tax feature is switched off', () => {
    const pricing = priceOrder({
      lines: [line()],
      regionCode: 'US-CA',
      features: { taxEstimates: false },
    });

    expect(pricing.tax.taxCents).toBe(0);
    expect(pricing.totalCents).toBe(1599);
  });
});

describe('promotions', () => {
  it('caps a percentage discount', () => {
    const pricing = priceOrder({
      lines: [line({ unitPriceCents: 50000 })],
      promoCode: 'SAVE10',
      regionCode: NO_TAX,
    });

    expect(pricing.discountCents).toBe(2000);
  });

  it('waives the shipping charge for a free-shipping code', () => {
    const pricing = priceOrder({
      lines: [line({ unitPriceCents: 3500 })],
      promoCode: 'FREESHIP',
      regionCode: NO_TAX,
    });

    expect(pricing.discountCents).toBe(0);
    expect(pricing.shipping.discountCents).toBe(599);
    expect(pricing.shipping.chargedCents).toBe(0);
    expect(pricing.totalCents).toBe(3500);
  });

  it('warns when a code was entered but did not apply', () => {
    const pricing = priceOrder({
      lines: [line()],
      promoCode: 'WELCOME15',
      regionCode: NO_TAX,
    });

    expect(pricing.promotion.applied).toBe(false);
    expect(pricing.promotion.reason).toBe(REJECTION.BELOW_MINIMUM);
    expect(pricing.warnings).toContain(WARNINGS.PROMOTION_REJECTED);
    expect(pricing.discountCents).toBe(0);
  });

  it('ignores codes when the feature flag is off', () => {
    const pricing = priceOrder({
      lines: [line({ unitPriceCents: 10000 })],
      promoCode: 'SAVE10',
      regionCode: NO_TAX,
      features: { promotions: false },
    });

    expect(pricing.discountCents).toBe(0);
    expect(pricing.promotion.reason).toBe(REJECTION.DISABLED);
  });
});

describe('per-line breakdown', () => {
  it('splits the discount across lines without losing a cent', () => {
    const pricing = priceOrder({
      lines: [
        line({ productId: 'a', unitPriceCents: 1000 }),
        line({ productId: 'b', unitPriceCents: 999 }),
        line({ productId: 'c', unitPriceCents: 1 }),
      ],
      promoCode: 'SAVE10',
      regionCode: NO_TAX,
    });

    const allocated = pricing.lines.reduce((sum, item) => sum + item.discountCents, 0);

    expect(pricing.discountCents).toBe(200);
    expect(allocated).toBe(pricing.discountCents);
  });

  it('makes net line values add up to the order net', () => {
    const pricing = priceOrder({
      lines: [
        line({ productId: 'a', quantity: 3 }),
        line({ productId: 'b', unitPriceCents: 2477, quantity: 2 }),
      ],
      promoCode: 'SAVE10',
      regionCode: NO_TAX,
    });

    const net = pricing.lines.reduce((sum, item) => sum + item.netCents, 0);

    expect(net).toBe(pricing.netMerchandiseCents);
  });

  it('carries the image through so an order can be rendered later', () => {
    const pricing = priceOrder({ lines: [line()], regionCode: NO_TAX });

    expect(pricing.lines[0].image).toBe('/images/product1.jpg');
  });

  it('reports zero discount per line when there is no promotion', () => {
    const pricing = priceOrder({ lines: [line(), line({ productId: 'b' })], regionCode: NO_TAX });

    expect(pricing.lines.map((item) => item.discountCents)).toEqual([0, 0]);
  });
});

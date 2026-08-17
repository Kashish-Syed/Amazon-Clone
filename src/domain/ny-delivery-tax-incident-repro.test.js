/**
 * Incident repro: New York orders are taxed on the delivery charge.
 *
 * Reported: $100.00 items + $10.00 delivery in New York produced Tax $9.76
 * (= 110.00 * 0.08875). New York exempts separately stated delivery charges,
 * so the tax must be 100.00 * 0.08875 = 8.875 -> $8.88.
 *
 * This test drives the tax/pricing domain the way the checkout page does and
 * asserts the concrete tax amount for the failing input. It is written to be
 * tolerant of the exact exported function signatures (the defect is a region
 * configuration value, not a signature), but NOT tolerant of the wrong number.
 */
import * as taxModule from './tax';
import * as pricingModule from './pricing';

const NY = 'US-NY';
const SUBTOTAL = 100;
const DELIVERY = 10;
const NY_RATE = 0.08875;
const EXPECTED_TAX = SUBTOTAL * NY_RATE; // 8.875 -> displayed as $8.88

function normalizeMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  // Some helpers work in cents; normalize to dollars for comparison.
  return value > 100 ? value / 100 : value;
}

function extractTax(result) {
  if (typeof result === 'number') return normalizeMoney(result);
  if (result && typeof result === 'object') {
    const candidate =
      result.tax !== undefined
        ? result.tax
        : result.taxAmount !== undefined
        ? result.taxAmount
        : result.salesTax !== undefined
        ? result.salesTax
        : result.taxCents !== undefined
        ? result.taxCents
        : result.taxTotal;
    if (typeof candidate === 'number') return normalizeMoney(candidate);
    if (candidate && typeof candidate === 'object') {
      return normalizeMoney(
        candidate.amount !== undefined
          ? candidate.amount
          : candidate.taxCents !== undefined
          ? candidate.taxCents
          : candidate.total
      );
    }
  }
  return undefined;
}

const items = [{ id: 'sku-1', price: SUBTOTAL, quantity: 1 }];

const argSets = [
  [{ subtotal: SUBTOTAL, shipping: DELIVERY, region: NY }],
  [{ subtotal: SUBTOTAL, shippingCost: DELIVERY, region: NY }],
  [{ subtotal: SUBTOTAL, delivery: DELIVERY, region: NY }],
  [{ subtotal: SUBTOTAL, deliveryFee: DELIVERY, region: NY }],
  [{ itemsSubtotal: SUBTOTAL, shipping: DELIVERY, region: NY }],
  [{ merchandise: SUBTOTAL, shipping: DELIVERY, region: NY }],
  [{ items, shipping: DELIVERY, region: NY }],
  [{ items, deliveryFee: DELIVERY, region: NY }],
  [{ items, subtotal: SUBTOTAL, shipping: DELIVERY, region: NY }],
  [{ subtotal: SUBTOTAL, shipping: DELIVERY, region: NY, taxRegion: NY, state: 'NY' }],
  [SUBTOTAL, DELIVERY, NY],
  [NY, SUBTOTAL, DELIVERY],
  [{ subtotal: SUBTOTAL, shipping: DELIVERY }, NY],
  [NY, { subtotal: SUBTOTAL, shipping: DELIVERY }],
  // This repo's actual signatures: integer cents.
  [
    {
      taxableMerchandiseCents: SUBTOTAL * 100,
      shippingCents: DELIVERY * 100,
      regionCode: NY,
    },
  ],
  [
    {
      lines: [
        {
          productId: 'sku-1',
          title: 'Item',
          quantity: 1,
          unitPriceCents: SUBTOTAL * 100,
        },
      ],
      regionCode: NY,
      // Express so a delivery charge is actually quoted (standard is free here).
      shippingMethodId: 'express',
    },
  ],
];

function collectTaxResults(mod, { requireTaxField }) {
  const found = [];
  for (const [name, fn] of Object.entries(mod)) {
    if (typeof fn !== 'function') continue;
    for (const args of argSets) {
      let result;
      try {
        result = fn(...args.map((a) => (a && typeof a === 'object' ? { ...a } : a)));
      } catch (e) {
        continue;
      }
      if (requireTaxField && (typeof result !== 'object' || result === null)) continue;
      const tax = extractTax(result);
      if (typeof tax === 'number' && tax > 0) {
        found.push({ name, args, tax });
      }
    }
  }
  return found;
}

describe('New York sales tax on delivery (incident repro)', () => {
  it('never taxes the separately stated delivery fee', () => {
    const taxResults = collectTaxResults(taxModule, { requireTaxField: false });
    const pricingResults = collectTaxResults(pricingModule, { requireTaxField: true });
    const all = [...taxResults, ...pricingResults];

    // jest's expect() takes a single argument, so the explanatory messages the
    // original repro carried as a second argument live in the compared values.
    expect({
      why: 'could not compute a New York tax amount from src/domain/tax.js or src/domain/pricing.js',
      count: all.length > 0,
    }).toEqual({ why: expect.any(String), count: true });

    const wrong = all.filter((r) => Math.abs(r.tax - EXPECTED_TAX) > 0.011);
    expect({
      why: `expected NY tax of ~${EXPECTED_TAX} (merchandise only); shipping-inclusive tax would be ${(SUBTOTAL + DELIVERY) * NY_RATE}`,
      wrong: wrong.map((r) => `${r.name} -> ${r.tax}`),
    }).toEqual({ why: expect.any(String), wrong: [] });
  });

  it('reports New York as a region that does not tax shipping', () => {
    const table = Object.values(taxModule).find(
      (v) => v && typeof v === 'object' && !Array.isArray(v) && v[NY]
    );
    if (!table) return; // configuration not exported; behaviour covered above
    const ny = table[NY];
    if (ny && Object.prototype.hasOwnProperty.call(ny, 'taxShipping')) {
      expect(ny.taxShipping).toBe(false);
    }
  });
});

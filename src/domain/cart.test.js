import {
  MAX_LINE_QUANTITY,
  addItem,
  decrementItem,
  findStockConflicts,
  itemCount,
  lineCount,
  lineTotalCents,
  maxQuantityFor,
  merchandiseTotalCents,
  removeLine,
  setQuantity,
} from './cart';

const product = (overrides = {}) => ({
  id: 'p1',
  title: 'Hair Mask',
  description: 'Deep conditioning.',
  image: '/images/product1.jpg',
  priceCents: 2477,
  rating: 4.8,
  stock: 25,
  inStock: true,
  ...overrides,
});

describe('maxQuantityFor', () => {
  it('is capped by the per-line limit even when stock is plentiful', () => {
    expect(maxQuantityFor(product({ stock: 500 }))).toBe(MAX_LINE_QUANTITY);
  });

  it('is capped by stock when stock is the tighter constraint', () => {
    expect(maxQuantityFor(product({ stock: 3 }))).toBe(3);
  });

  it('is zero for an out-of-stock product', () => {
    expect(maxQuantityFor(product({ stock: 0 }))).toBe(0);
  });
});

describe('addItem', () => {
  it('creates a line the first time', () => {
    const { lines } = addItem([], product());

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ productId: 'p1', quantity: 1, unitPriceCents: 2477 });
  });

  it('merges a repeat into a quantity instead of appending a second line', () => {
    const first = addItem([], product()).lines;
    const { lines } = addItem(first, product());

    // The old model pushed the product twice and produced two identical entries.
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });

  it('keeps separate products on separate lines', () => {
    const first = addItem([], product()).lines;
    const { lines } = addItem(first, product({ id: 'p2' }));

    expect(lines.map((line) => line.productId)).toEqual(['p1', 'p2']);
  });

  it('clamps to available stock and says so', () => {
    const { lines, clamped } = addItem([], product({ stock: 2 }), 5);

    expect(lines[0].quantity).toBe(2);
    expect(clamped).toBe(true);
  });

  it('clamps to the per-line limit', () => {
    const { lines, clamped } = addItem([], product({ stock: 100 }), 50);

    expect(lines[0].quantity).toBe(MAX_LINE_QUANTITY);
    expect(clamped).toBe(true);
  });

  it('refuses to add an out-of-stock product at all', () => {
    const existing = [];
    const { lines, clamped } = addItem(existing, product({ stock: 0 }));

    expect(lines).toBe(existing);
    expect(clamped).toBe(true);
  });

  it('does not mutate the array it was given', () => {
    const before = addItem([], product()).lines;
    const snapshot = JSON.parse(JSON.stringify(before));

    addItem(before, product());

    expect(before).toEqual(snapshot);
  });

  it('copies the price onto the line so a later catalogue change cannot alter it', () => {
    const { lines } = addItem([], product({ priceCents: 1000 }));
    const [line] = addItem(lines, product({ priceCents: 9999 })).lines;

    // Quantity goes up; the price the shopper was shown does not move.
    expect(line.quantity).toBe(2);
    expect(line.unitPriceCents).toBe(1000);
  });
});

describe('setQuantity', () => {
  it('sets an exact quantity', () => {
    const lines = addItem([], product()).lines;

    expect(setQuantity(lines, 'p1', 4)[0].quantity).toBe(4);
  });

  it('removes the line at zero', () => {
    const lines = addItem([], product()).lines;

    expect(setQuantity(lines, 'p1', 0)).toEqual([]);
  });

  it('ignores an unknown product', () => {
    const lines = addItem([], product()).lines;

    expect(setQuantity(lines, 'nope', 3)).toEqual(lines);
  });
});

describe('decrementItem', () => {
  it('drops one unit', () => {
    const lines = addItem([], product(), 3).lines;

    expect(decrementItem(lines, 'p1')[0].quantity).toBe(2);
  });

  it('removes the line when the last unit goes', () => {
    const lines = addItem([], product()).lines;

    expect(decrementItem(lines, 'p1')).toEqual([]);
  });

  it('is a no-op for a product that is not in the cart', () => {
    expect(decrementItem([], 'ghost')).toEqual([]);
  });
});

describe('removeLine', () => {
  it('removes the whole line regardless of quantity', () => {
    const lines = addItem([], product(), 5).lines;

    expect(removeLine(lines, 'p1')).toEqual([]);
  });
});

describe('counting', () => {
  const twoProducts = () => {
    const first = addItem([], product(), 3).lines;
    return addItem(first, product({ id: 'p2', priceCents: 1000 }), 2).lines;
  };

  it('itemCount sums quantities, not lines', () => {
    expect(itemCount(twoProducts())).toBe(5);
  });

  it('lineCount counts distinct products', () => {
    expect(lineCount(twoProducts())).toBe(2);
  });

  it('tolerates a missing cart', () => {
    expect(itemCount(undefined)).toBe(0);
    expect(merchandiseTotalCents(undefined)).toBe(0);
  });
});

describe('totals', () => {
  it('extends a line by its quantity', () => {
    const lines = addItem([], product({ priceCents: 2477 }), 3).lines;

    expect(lineTotalCents(lines[0])).toBe(7431);
  });

  it('sums the whole cart', () => {
    const first = addItem([], product({ priceCents: 2477 }), 3).lines;
    const lines = addItem(first, product({ id: 'p2', priceCents: 1000 }), 2).lines;

    expect(merchandiseTotalCents(lines)).toBe(7431 + 2000);
  });
});

describe('findStockConflicts', () => {
  it('flags a line that now exceeds available stock', () => {
    const lines = addItem([], product({ stock: 10 }), 6).lines;
    const catalogue = [product({ stock: 2 })];

    expect(findStockConflicts(lines, catalogue)).toEqual([
      { productId: 'p1', requested: 6, available: 2 },
    ]);
  });

  it('treats a product that has vanished from the catalogue as unavailable', () => {
    const lines = addItem([], product(), 1).lines;

    expect(findStockConflicts(lines, [])).toEqual([
      { productId: 'p1', requested: 1, available: 0 },
    ]);
  });

  it('finds nothing when stock is sufficient', () => {
    const lines = addItem([], product(), 2).lines;

    expect(findStockConflicts(lines, [product({ stock: 25 })])).toEqual([]);
  });
});

import {
  DEFAULT_STOCK,
  PLACEHOLDER_IMAGE,
  ProductValidationError,
  normalizeCatalog,
  normalizeProduct,
  sortForDisplay,
} from './catalog';

const raw = (overrides = {}) => ({
  id: 'abc123',
  title: 'Hair Mask',
  description: 'Deep-conditioning treatment.',
  image: '/images/product1.jpg',
  price: 24.77,
  rating: 4.8,
  ...overrides,
});

describe('normalizeProduct', () => {
  it('converts price to integer cents', () => {
    expect(normalizeProduct(raw()).priceCents).toBe(2477);
  });

  it('accepts a price stored as a string', () => {
    // Documents seeded by hand carry "19.00" rather than 19.
    expect(normalizeProduct(raw({ price: '19.00' })).priceCents).toBe(1900);
  });

  it('accepts a rating stored as a string', () => {
    expect(normalizeProduct(raw({ rating: '4' })).rating).toBe(4);
  });

  it('clamps a rating outside the five-point scale', () => {
    expect(normalizeProduct(raw({ rating: 9 })).rating).toBe(5);
    expect(normalizeProduct(raw({ rating: -3 })).rating).toBe(0);
  });

  it('defaults a missing rating to zero rather than NaN', () => {
    expect(normalizeProduct(raw({ rating: undefined })).rating).toBe(0);
  });

  it('assumes a default stock level for documents written before inventory existed', () => {
    const product = normalizeProduct(raw({ stock: undefined }));

    expect(product.stock).toBe(DEFAULT_STOCK);
    expect(product.inStock).toBe(true);
  });

  it('treats zero stock as out of stock', () => {
    const product = normalizeProduct(raw({ stock: 0 }));

    expect(product.stock).toBe(0);
    expect(product.inStock).toBe(false);
  });

  it('substitutes a placeholder for a missing image', () => {
    expect(normalizeProduct(raw({ image: '' })).image).toBe(PLACEHOLDER_IMAGE);
    expect(normalizeProduct(raw({ image: undefined })).image).toBe(PLACEHOLDER_IMAGE);
  });

  it('falls back to a title rather than rendering "undefined"', () => {
    expect(normalizeProduct(raw({ title: '   ' })).title).toBe('Untitled product');
  });

  it.each([undefined, null, '', 'free', {}])(
    'rejects a product whose price is %p instead of selling it for nothing',
    (price) => {
      expect(() => normalizeProduct(raw({ price }))).toThrow(ProductValidationError);
    }
  );

  it('rejects a negative price', () => {
    expect(() => normalizeProduct(raw({ price: -5 }))).toThrow(ProductValidationError);
  });

  it('rejects a document with no id', () => {
    expect(() => normalizeProduct(raw({ id: undefined }))).toThrow(ProductValidationError);
  });
});

describe('normalizeCatalog', () => {
  it('keeps good documents and reports bad ones', () => {
    const { products, rejected } = normalizeCatalog([
      raw({ id: 'ok-1' }),
      raw({ id: 'bad-1', price: undefined }),
      raw({ id: 'ok-2' }),
    ]);

    // One malformed document must not blank the whole storefront.
    expect(products.map((product) => product.id)).toEqual(['ok-1', 'ok-2']);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].id).toBe('bad-1');
  });

  it('handles an empty or missing collection', () => {
    expect(normalizeCatalog([])).toEqual({ products: [], rejected: [] });
    expect(normalizeCatalog(undefined)).toEqual({ products: [], rejected: [] });
  });
});

describe('sortForDisplay', () => {
  it('puts in-stock products first, then sorts by title', () => {
    const products = normalizeCatalog([
      raw({ id: '1', title: 'Zebra Print', stock: 5 }),
      raw({ id: '2', title: 'Anua Cleanser', stock: 0 }),
      raw({ id: '3', title: 'Brass Keychain', stock: 2 }),
    ]).products;

    expect(sortForDisplay(products).map((product) => product.title)).toEqual([
      'Brass Keychain',
      'Zebra Print',
      'Anua Cleanser',
    ]);
  });

  it('does not mutate its input', () => {
    const products = normalizeCatalog([raw({ id: '1', title: 'B' }), raw({ id: '2', title: 'A' })])
      .products;
    const before = products.map((product) => product.id);

    sortForDisplay(products);

    expect(products.map((product) => product.id)).toEqual(before);
  });
});

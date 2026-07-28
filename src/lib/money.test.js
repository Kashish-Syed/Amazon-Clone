import {
  allocate,
  clamp,
  format,
  isValidCents,
  multiply,
  percentOf,
  roundHalfUp,
  toCents,
  toDollars,
} from './money';

describe('roundHalfUp', () => {
  it('rounds .5 away from zero in both directions', () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(-0.5)).toBe(-1);
  });

  it('differs from Math.round on negative halves', () => {
    // Math.round(-0.5) is -0, which is the asymmetry this exists to avoid.
    expect(Math.round(-0.5)).toBe(-0);
    expect(roundHalfUp(-0.5)).toBe(-1);
  });

  it('leaves whole numbers alone', () => {
    expect(roundHalfUp(7)).toBe(7);
    expect(roundHalfUp(-7)).toBe(-7);
  });
});

describe('toCents', () => {
  it('converts a float price without drifting', () => {
    // These are the prices where IEEE-754 bites: the naive `price * 100`
    // lands just under the whole cent, so truncating undercharges by one.
    expect(16.08 * 100).toBe(1607.9999999999998);
    expect(Math.trunc(16.08 * 100)).toBe(1607);
    expect(toCents(16.08)).toBe(1608);

    expect(4.35 * 100).toBe(434.99999999999994);
    expect(toCents(4.35)).toBe(435);
  });

  it('converts prices that happen to be exact', () => {
    expect(toCents(29.99)).toBe(2999);
    expect(toCents(24.77)).toBe(2477);
  });

  it('accepts numeric strings, which Firestore actually contains', () => {
    expect(toCents('24.99')).toBe(2499);
    expect(toCents('  12.50  ')).toBe(1250);
  });

  it('handles zero', () => {
    expect(toCents(0)).toBe(0);
    expect(toCents('0')).toBe(0);
  });

  it.each([null, undefined, '', '   ', 'free', {}, NaN, Infinity, true])(
    'rejects %p rather than silently treating it as zero',
    (value) => {
      expect(() => toCents(value)).toThrow(TypeError);
    }
  );
});

describe('toDollars', () => {
  it('round-trips with toCents', () => {
    expect(toDollars(toCents(19.95))).toBe(19.95);
  });

  it('refuses a non-integer amount', () => {
    expect(() => toDollars(10.5)).toThrow(TypeError);
  });
});

describe('multiply', () => {
  it('scales by a quantity', () => {
    expect(multiply(2999, 3)).toBe(8997);
  });

  it('returns zero for a zero quantity', () => {
    expect(multiply(2999, 0)).toBe(0);
  });

  it.each([-1, 1.5, NaN])('rejects a quantity of %p', (quantity) => {
    expect(() => multiply(1000, quantity)).toThrow(TypeError);
  });
});

describe('percentOf', () => {
  it('rounds to the nearest cent', () => {
    // 2999 * 0.0725 = 217.4275
    expect(percentOf(2999, 0.0725)).toBe(217);
    // 1000 * 0.0725 = 72.5, which must round up, not to even.
    expect(percentOf(1000, 0.0725)).toBe(73);
  });

  it('returns zero at a zero rate', () => {
    expect(percentOf(12345, 0)).toBe(0);
  });

  it('rejects a negative rate', () => {
    expect(() => percentOf(1000, -0.1)).toThrow(TypeError);
  });
});

describe('allocate', () => {
  it('never loses a cent to rounding', () => {
    const shares = allocate(1000, [1, 1, 1]);

    // Rounding each third independently would give 333+333+333 = 999.
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(1000);
    expect(shares).toEqual([334, 333, 333]);
  });

  it('gives the spare cent to the largest remainder', () => {
    const shares = allocate(200, [1000, 999, 1]);

    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(200);
    expect(shares).toEqual([100, 100, 0]);
  });

  it('splits proportionally when it divides evenly', () => {
    expect(allocate(300, [1000, 2000])).toEqual([100, 200]);
  });

  it('puts everything in the first bucket when all weights are zero', () => {
    expect(allocate(500, [0, 0, 0])).toEqual([500, 0, 0]);
  });

  it('handles a zero amount', () => {
    expect(allocate(0, [3, 7])).toEqual([0, 0]);
  });

  it('is deterministic for tied remainders', () => {
    expect(allocate(5, [1, 1])).toEqual([3, 2]);
    expect(allocate(5, [1, 1])).toEqual(allocate(5, [1, 1]));
  });

  it('rejects an empty weight list', () => {
    expect(() => allocate(100, [])).toThrow(TypeError);
  });
});

describe('clamp', () => {
  it('bounds a value at both ends', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe('format', () => {
  it('renders cents as currency', () => {
    expect(format(129900)).toBe('$1,299.00');
    expect(format(0)).toBe('$0.00');
    expect(format(5)).toBe('$0.05');
  });

  it('refuses a float, which would mean cents got mixed up with dollars', () => {
    expect(() => format(12.99)).toThrow(TypeError);
  });
});

describe('isValidCents', () => {
  it.each([[0, true], [100, true], [-100, true], [10.5, false], [NaN, false], ['100', false]])(
    'isValidCents(%p) is %p',
    (value, expected) => {
      expect(isValidCents(value)).toBe(expected);
    }
  );
});

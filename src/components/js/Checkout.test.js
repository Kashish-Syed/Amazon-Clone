import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Checkout from './Checkout';
import { StateProvider } from './StateProvider';
import reducer, { initialState } from './reducer';

// An end-to-end check through the UI: cart lines in, rendered money out.
//
// This is the test that would have caught the original bug, where the cart page
// and the amount sent to Stripe were computed by two separate pieces of
// arithmetic and quietly disagreed.

const line = (overrides = {}) => ({
  productId: 'p1',
  title: 'Hair Mask',
  description: 'Deep-conditioning treatment.',
  image: '/images/product1.jpg',
  unitPriceCents: 1000,
  rating: 4.8,
  stock: 25,
  quantity: 1,
  ...overrides,
});

// Oregon charges no sales tax, so every figure below stays checkable by hand.
const renderCheckout = (lines, checkout = {}) =>
  render(
    <MemoryRouter>
      <StateProvider
        reducer={reducer}
        initialState={{
          ...initialState,
          lines,
          checkout: { ...initialState.checkout, regionCode: 'US-OR', ...checkout },
        }}
      >
        <Checkout />
      </StateProvider>
    </MemoryRouter>
  );

// The same amount legitimately appears in more than one place - a line total
// and the order total can coincide - so every assertion is scoped to the row or
// card it belongs to rather than searched for across the whole page.
const summaryRow = (name) => within(screen.getByTestId(`summary-${name}`));
const cartLine = (productId) => within(screen.getByTestId(`cart-line-${productId}`));

const applyCode = (code) => {
  fireEvent.change(screen.getByLabelText(/promo code/i), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
};

describe('an empty cart', () => {
  it('says so instead of rendering nothing', () => {
    renderCheckout([]);

    // Scoped past the "Your cart is empty" button label, which also matches.
    expect(screen.getByText(/your cart is empty\. browse/i)).toBeInTheDocument();
  });

  it('disables the checkout button', () => {
    renderCheckout([]);

    expect(screen.getByRole('button', { name: /cart is empty/i })).toBeDisabled();
  });

  it('shows a zero total rather than a blank or NaN', () => {
    renderCheckout([]);

    expect(summaryRow('total').getByText('$0.00')).toBeInTheDocument();
  });
});

describe('a cart with items', () => {
  it('shows the extended price on the line, not the unit price', () => {
    renderCheckout([line({ quantity: 3 })]);

    // 3 x $10.00. Showing $10.00 as the line price is the bug that arrives
    // with quantities.
    expect(cartLine('p1').getByText('$30.00')).toBeInTheDocument();
    expect(cartLine('p1').getByText('($10.00 each)')).toBeInTheDocument();
    expect(cartLine('p1').getByText('Quantity: 3')).toBeInTheDocument();
  });

  it('omits the unit price when there is only one', () => {
    renderCheckout([line({ quantity: 1 })]);

    expect(cartLine('p1').queryByText(/each/)).not.toBeInTheDocument();
  });

  it('adds shipping to the order total', () => {
    renderCheckout([line({ quantity: 3 })]);

    expect(summaryRow('items').getByText('$30.00')).toBeInTheDocument();
    expect(summaryRow('shipping').getByText('$5.99')).toBeInTheDocument();
    // $30.00 + $5.99, no tax in Oregon.
    expect(summaryRow('total').getByText('$35.99')).toBeInTheDocument();
  });

  it('shows free shipping once the threshold is met', () => {
    renderCheckout([line({ quantity: 5 })]);

    expect(summaryRow('shipping').getByText('Free')).toBeInTheDocument();
    expect(summaryRow('total').getByText('$50.00')).toBeInTheDocument();
  });

  it('tells the shopper how much more is needed for free shipping', () => {
    renderCheckout([line({ quantity: 3 })]);

    expect(
      screen.getByText('Add $20.00 more for free standard shipping.')
    ).toBeInTheDocument();
  });

  it('drops that prompt once shipping is already free', () => {
    renderCheckout([line({ quantity: 5 })]);

    expect(screen.queryByText(/more for free standard shipping/)).not.toBeInTheDocument();
  });

  it('counts units rather than lines', () => {
    renderCheckout([
      line({ quantity: 3 }),
      line({ productId: 'p2', title: 'Lip Mask', quantity: 2 }),
    ]);

    expect(screen.getByText('Items (5 items)')).toBeInTheDocument();
  });

  it('renders one card per distinct product', () => {
    renderCheckout([
      line({ quantity: 3 }),
      line({ productId: 'p2', title: 'Lip Mask', quantity: 2 }),
    ]);

    expect(screen.getByText('Hair Mask')).toBeInTheDocument();
    expect(screen.getByText('Lip Mask')).toBeInTheDocument();
  });
});

describe('removing items', () => {
  it('decrements a multi-unit line rather than clearing it', () => {
    renderCheckout([line({ quantity: 3 })]);

    fireEvent.click(screen.getByRole('button', { name: /remove one/i }));

    expect(screen.getByText('Quantity: 2')).toBeInTheDocument();
  });

  it('recalculates the total after a decrement', () => {
    renderCheckout([line({ quantity: 5 })]);

    // $50.00 with free shipping; dropping to 4 units costs $40.00 + $5.99.
    fireEvent.click(screen.getByRole('button', { name: /remove one/i }));

    expect(summaryRow('total').getByText('$45.99')).toBeInTheDocument();
  });

  it('clears the line entirely with remove all', () => {
    renderCheckout([line({ quantity: 3 })]);

    fireEvent.click(screen.getByRole('button', { name: /remove all/i }));

    // Scoped past the "Your cart is empty" button label, which also matches.
    expect(screen.getByText(/your cart is empty\. browse/i)).toBeInTheDocument();
  });

  it('removes a single-unit line in one click', () => {
    renderCheckout([line({ quantity: 1 })]);

    fireEvent.click(screen.getByRole('button', { name: /remove from cart/i }));

    // Scoped past the "Your cart is empty" button label, which also matches.
    expect(screen.getByText(/your cart is empty\. browse/i)).toBeInTheDocument();
  });
});

describe('promotions', () => {
  it('applies a valid code and shows the discount', () => {
    renderCheckout([line({ quantity: 5 })]);

    applyCode('TAKE5');

    expect(summaryRow('discount').getByText('−$5.00')).toBeInTheDocument();
    // $50.00 - $5.00 = $45.00, which falls below the free-shipping threshold,
    // so $5.99 of shipping comes back: $50.99.
    expect(summaryRow('total').getByText('$50.99')).toBeInTheDocument();
  });

  it('accepts a lowercase code', () => {
    renderCheckout([line({ quantity: 5 })]);

    applyCode('take5');

    expect(summaryRow('total').getByText('$50.99')).toBeInTheDocument();
  });

  it('explains why an unknown code did nothing', () => {
    renderCheckout([line({ quantity: 5 })]);

    applyCode('BOGUS');

    expect(screen.getByText('"BOGUS" is not a valid code.')).toBeInTheDocument();
  });

  it('explains why a real code did not qualify', () => {
    renderCheckout([line({ quantity: 1 })]);

    applyCode('WELCOME15');

    expect(
      screen.getByText('"WELCOME15" does not apply to this order yet.')
    ).toBeInTheDocument();
  });

  it('clears an applied code', () => {
    renderCheckout([line({ quantity: 5 })]);

    applyCode('TAKE5');
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    expect(summaryRow('total').getByText('$50.00')).toBeInTheDocument();
  });
});

import React from 'react';
import '../css/Checkout.css';
import Subtotal from './Subtotal';
import CheckoutProduct from './CheckoutProduct';
import { useStateValue } from './StateProvider';

function Checkout() {
  const [{ lines }] = useStateValue();

  return (
    <div className="checkout">
      <img className="checkout_ad" src="/images/name_banner.png" alt="Name Banner" />

      <div className="checkout_content">
        <div className="checkout_left">
          <h2 className="checkout_title">Your shopping cart</h2>

          {/* An empty cart needs to say so. Previously it rendered an empty
              div, which is indistinguishable from a cart that failed to load. */}
          {lines.length === 0 && (
            <p className="checkout_empty">
              Your cart is empty. Browse the homepage to add something.
            </p>
          )}

          {lines.map((line) => (
            // Keyed by product id, which is genuinely unique now that repeats
            // are merged into a quantity rather than appended as duplicates.
            <CheckoutProduct key={line.productId} line={line} />
          ))}
        </div>

        <div className="checkout_right">
          <Subtotal />
        </div>
      </div>
    </div>
  );
}

export default Checkout;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/Subtotal.css';
import { useStateValue } from './StateProvider';
import { selectPricing } from './reducer';
import OrderSummary from './OrderSummary';
import PromoCodeField from './PromoCodeField';
import { FREE_SHIPPING_THRESHOLD_CENTS } from '../../domain/shipping';
import { format } from '../../lib/money';

function Subtotal() {
  const [state] = useStateValue();
  const navigate = useNavigate();

  // One call, one source of truth. This component does not add anything up.
  const pricing = selectPricing(state);

  const shortfallCents = FREE_SHIPPING_THRESHOLD_CENTS - pricing.merchandiseCents;
  const qualifiesForFreeShipping = pricing.shipping.freeShippingApplied;
  const isEmpty = pricing.itemCount === 0;

  return (
    <div className="subtotal">
      <OrderSummary pricing={pricing} />

      {!isEmpty && !qualifiesForFreeShipping && shortfallCents > 0 && (
        <p className="subtotal_freeShipping">
          {`Add ${format(shortfallCents)} more for free standard shipping.`}
        </p>
      )}

      <PromoCodeField />

      <small className="subtotal_gift">
        <input type="checkbox" /> This order contains a gift
      </small>

      <button
        type="button"
        className="button-effect"
        disabled={isEmpty}
        onClick={() => navigate('/payment')}
      >
        {isEmpty ? 'Your cart is empty' : 'Proceed to checkout'}
      </button>
    </div>
  );
}

export default Subtotal;

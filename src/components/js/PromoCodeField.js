import React, { useState } from 'react';
import '../css/PromoCodeField.css';
import { useStateValue } from './StateProvider';
import { ACTIONS } from './reducer';
import { listPromotions } from '../../domain/promotions';
import { config } from '../../config';

// Promo code entry.
//
// The applied code lives in reducer state, not in this component, because the
// pricing engine needs it and so does the order record written after payment.
// A code held in local component state would vanish on navigation to /payment
// and the shopper would silently lose their discount between the cart page and
// the card form.
function PromoCodeField() {
  const [{ checkout }, dispatch] = useStateValue();
  const [draft, setDraft] = useState(checkout.promoCode);

  if (!config.features.promotions) return null;

  const apply = (event) => {
    event.preventDefault();
    dispatch({ type: ACTIONS.SET_PROMO_CODE, code: draft.trim().toUpperCase() });
  };

  const clear = () => {
    setDraft('');
    dispatch({ type: ACTIONS.SET_PROMO_CODE, code: '' });
  };

  return (
    <form className="promoCode" onSubmit={apply}>
      <label className="promoCode_label" htmlFor="promo-code">
        Promo code
      </label>

      <div className="promoCode_controls">
        <input
          id="promo-code"
          className="promoCode_input"
          type="text"
          value={draft}
          placeholder="e.g. SAVE10"
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="button-effect" disabled={!draft.trim()}>
          Apply
        </button>
        {checkout.promoCode && (
          <button type="button" className="promoCode_clear" onClick={clear}>
            Clear
          </button>
        )}
      </div>

      {/* Demo affordance. A real storefront would never list its own codes. */}
      <p className="promoCode_hint">
        Try: {listPromotions().map((promotion) => promotion.code).join(', ')}
      </p>
    </form>
  );
}

export default PromoCodeField;

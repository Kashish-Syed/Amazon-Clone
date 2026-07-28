import React from 'react';
import '../css/OrderSummary.css';
import { format } from '../../lib/money';
import { WARNINGS } from '../../domain/pricing';

// The price breakdown, rendered from a pricing result.
//
// Shared by the cart page and the payment page on purpose. When each page did
// its own arithmetic, the cart could show one number and Stripe could be sent
// another, and nothing in the app noticed the disagreement.
//
// This component does no arithmetic of its own beyond reading fields off the
// object it is handed. If a figure here is wrong, the bug is in
// domain/pricing.js, not in the markup.

const WARNING_TEXT = {
  [WARNINGS.UNRECOGNISED_REGION]:
    'We do not have a tax rate for that region, so this estimate uses the default.',
  [WARNINGS.UNRECOGNISED_SHIPPING_METHOD]:
    'That delivery speed is unavailable; standard shipping has been applied.',
  [WARNINGS.EXCEEDS_MAXIMUM]:
    'This order is too large to pay for online. Please contact support.',
};

/**
 * @param {{ pricing: import('../../domain/pricing').OrderPricing, compact?: boolean }} props
 */
function OrderSummary({ pricing, compact = false }) {
  const {
    itemCount,
    merchandiseCents,
    discountCents,
    shipping,
    tax,
    promotion,
    totalCents,
    warnings,
  } = pricing;

  return (
    <div className={`orderSummary${compact ? ' orderSummary--compact' : ''}`}>
      {/* Labels are built as single strings rather than as JSX with embedded
          expressions. React renders the latter as several sibling text nodes,
          which breaks any lookup by visible text - in tests and for screen
          readers alike.

          Each row also carries a data-testid. The same amount legitimately
          appears in more than one row (a line total and the order total can
          coincide), so tests need to say WHICH figure they mean. */}
      <div className="orderSummary_row" data-testid="summary-items">
        <span>{`Items (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`}</span>
        <span>{format(merchandiseCents)}</span>
      </div>

      {discountCents > 0 && (
        <div className="orderSummary_row orderSummary_row--credit" data-testid="summary-discount">
          <span>{promotion.label ?? 'Discount'}</span>
          <span>{`−${format(discountCents)}`}</span>
        </div>
      )}

      <div className="orderSummary_row" data-testid="summary-shipping">
        <span>{`Shipping${shipping.methodLabel ? ` (${shipping.methodLabel})` : ''}`}</span>
        <span>{shipping.chargedCents === 0 ? 'Free' : format(shipping.chargedCents)}</span>
      </div>

      {shipping.discountCents > 0 && (
        <div
          className="orderSummary_row orderSummary_row--credit"
          data-testid="summary-shipping-discount"
        >
          <span>Shipping discount</span>
          <span>{`−${format(shipping.discountCents)}`}</span>
        </div>
      )}

      <div className="orderSummary_row" data-testid="summary-tax">
        <span>
          {`Estimated tax${
            tax.rate > 0 ? ` (${tax.regionLabel}, ${(tax.rate * 100).toFixed(3)}%)` : ''
          }`}
        </span>
        <span>{format(tax.taxCents)}</span>
      </div>

      <div className="orderSummary_row orderSummary_row--total" data-testid="summary-total">
        <span>Order total</span>
        <span>{format(totalCents)}</span>
      </div>

      {/* A code that was typed but did not apply must say why. Dropping it
          silently leaves the shopper unable to tell a broken feature from a
          cart that simply does not qualify. */}
      {promotion.code && !promotion.applied && (
        <p className="orderSummary_note orderSummary_note--warn" role="status">
          {promotion.reason === 'unknown_code'
            ? `"${promotion.code}" is not a valid code.`
            : `"${promotion.code}" does not apply to this order yet.`}
        </p>
      )}

      {warnings
        .filter((warning) => WARNING_TEXT[warning])
        .map((warning) => (
          <p key={warning} className="orderSummary_note orderSummary_note--warn">
            {WARNING_TEXT[warning]}
          </p>
        ))}
    </div>
  );
}

export default OrderSummary;

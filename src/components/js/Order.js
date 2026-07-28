import React from 'react';
import moment from 'moment';
import '../css/Order.css';
import CheckoutProduct from './CheckoutProduct';
import { format } from '../../lib/money';

/**
 * A single past order.
 *
 * Takes an order already normalised by orderService.normalizeOrder, so this
 * component never has to know that two schema versions exist in Firestore.
 * Branching on version inside the view is how rendering code slowly turns into
 * a migration script.
 *
 * @param {{ order: object }} props
 */
function Order({ order }) {
  const { totals } = order;

  return (
    <div className="order">
      <div className="order_header">
        {/* These were <h4> inside <p>, which is invalid HTML nesting - the
            browser closes the <p> early and React logs a DOM nesting warning. */}
        <div className="order_info">
          <div className="order_date">
            <h4>Order placed:</h4>{' '}
            {order.created
              ? moment.unix(order.created).format('MMMM Do YYYY, h:mma')
              : 'Date unavailable'}
          </div>
        </div>
        <div className="order_info">
          <div className="order_id">
            <h4>Order id: </h4>
            <small>{order.id}</small>
          </div>
        </div>
      </div>

      <div className="order_items">
        {order.lines.map((line) => (
          <CheckoutProduct key={line.productId} line={line} readOnly />
        ))}
      </div>

      {/* Only v2 orders recorded a breakdown. v1 stored a single total and
          nothing else, so there is genuinely nothing to itemise for them. */}
      {totals && (
        <div className="order_totals">
          <div className="order_totalsRow">
            <span>Items</span>
            <span>{format(totals.merchandiseCents)}</span>
          </div>
          {totals.discountCents > 0 && (
            <div className="order_totalsRow">
              <span>Discount</span>
              <span>&minus;{format(totals.discountCents)}</span>
            </div>
          )}
          <div className="order_totalsRow">
            <span>Shipping</span>
            <span>{format(totals.shippingCents)}</span>
          </div>
          <div className="order_totalsRow">
            <span>Tax</span>
            <span>{format(totals.taxCents)}</span>
          </div>
        </div>
      )}

      <h3 className="order_total">Order total: {format(order.totalCents)}</h3>
    </div>
  );
}

export default Order;

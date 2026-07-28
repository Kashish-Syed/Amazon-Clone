import React from 'react';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import '../css/CheckoutProduct.css';
import { useStateValue } from './StateProvider';
import { ACTIONS } from './reducer';
import { format } from '../../lib/money';

const StyledRating = styled(Rating)({
  '& .MuiRating-iconFilled': {
    color: '#ea8d3a',
  },
});

/**
 * One line in the cart, in the payment review list, or in a past order.
 *
 * Renders a CART LINE, not a product: it has a quantity, and the price shown is
 * the extended price (unit x quantity) with the unit price underneath. Showing
 * only the unit price - which is what this did before quantities existed - made
 * a cart holding three of something look like it cost a third of what it did.
 *
 * @param {{ line: object, readOnly?: boolean }} props
 */
function CheckoutProduct({ line, readOnly = false }) {
  const [, dispatch] = useStateValue();

  const quantity = line.quantity ?? 1;
  const unitPriceCents = line.unitPriceCents ?? 0;
  const extendedCents = unitPriceCents * quantity;

  const remove = () => {
    dispatch({ type: ACTIONS.REMOVE_FROM_CART, productId: line.productId });
  };

  const decrement = () => {
    dispatch({ type: ACTIONS.DECREMENT_ITEM, productId: line.productId });
  };

  return (
    <div className="checkoutProduct" data-testid={`cart-line-${line.productId}`}>
      <img
        className="checkouProduct_image"
        src={line.image}
        alt={line.title}
        style={{ width: '200px', height: 'auto' }}
      />

      <div className="checkoutProduct_info">
        <p className="checkoutProduct_title">{line.title}</p>
        <p className="checkoutProduct_description">{line.description}</p>

        <p className="checkoutProduct_price">
          <strong>{format(extendedCents)}</strong>
          {quantity > 1 && (
            <small className="checkoutProduct_unitPrice">
              {` (${format(unitPriceCents)} each)`}
            </small>
          )}
        </p>

        <p className="checkoutProduct_quantity">{`Quantity: ${quantity}`}</p>

        {line.rating !== undefined && (
          <Typography sx={{ mt: 1 }}>
            <StyledRating
              name={`rating-${line.productId}`}
              value={line.rating ?? 0}
              precision={0.1}
              readOnly
            />
          </Typography>
        )}

        {!readOnly && (
          <div className="checkoutProduct_actions">
            <button type="button" className="button-effect" onClick={decrement}>
              {quantity > 1 ? 'Remove one' : 'Remove from cart'}
            </button>
            {quantity > 1 && (
              <button type="button" className="button-effect" onClick={remove}>
                Remove all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CheckoutProduct;

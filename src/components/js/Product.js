import React from 'react';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import '../css/App.css';
import '../css/Product.css';
import { useStateValue } from './StateProvider';
import { ACTIONS } from './reducer';
import { MAX_LINE_QUANTITY, maxQuantityFor } from '../../domain/cart';
import { format } from '../../lib/money';

const MAX_DESCRIPTION_LENGTH = 100;

// Defined once at module scope. It used to be created inside the component,
// which meant a brand new styled component - and therefore a fresh class name
// and a remount of the rating - on every single render.
const StyledRating = styled(Rating)({
  '& .MuiRating-iconFilled': {
    color: '#ea8d3a',
  },
});

/**
 * A single catalogue tile.
 *
 * Takes the whole normalised product rather than eight separate props. The
 * previous signature meant every call site had to remember to forward each
 * field, and Checkout quietly dropped `rating` by forgetting one of them.
 *
 * @param {{ product: object }} props
 */
function Product({ product }) {
  const [{ lines }, dispatch] = useStateValue();

  const inCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  const ceiling = maxQuantityFor(product);
  const atLimit = inCart >= ceiling;

  const truncatedDescription =
    product.description && product.description.length > MAX_DESCRIPTION_LENGTH
      ? `${product.description.slice(0, MAX_DESCRIPTION_LENGTH)}...`
      : product.description;

  const addToCart = () => {
    dispatch({ type: ACTIONS.ADD_TO_CART, product, quantity: 1 });
  };

  const buttonLabel = () => {
    if (!product.inStock) return 'Out of stock';
    if (atLimit) {
      return ceiling >= MAX_LINE_QUANTITY ? `Limit ${MAX_LINE_QUANTITY} per order` : 'All stock in cart';
    }
    return inCart > 0 ? `Add another (${inCart} in cart)` : 'Add to cart';
  };

  return (
    <div className="product pop-out">
      <div className="product_info">
        <p style={{ marginBottom: '5px' }}>
          <strong>{product.title}</strong>
        </p>
        <p style={{ marginBottom: '5px' }}>{truncatedDescription}</p>

        <p className="product_price">
          {/* Formatted from integer cents in one place, so the tile, the cart
              and the receipt can never disagree about the price. */}
          <strong>{format(product.priceCents)}</strong>
        </p>

        <Typography sx={{ mt: 1 }}>
          <StyledRating
            name={`rating-${product.id}`}
            value={product.rating}
            precision={0.1}
            readOnly
          />
        </Typography>

        {product.inStock && product.stock <= 5 && (
          <p className="product_stock">{`Only ${product.stock} left`}</p>
        )}
      </div>

      <img className="product_img" src={product.image} alt={product.title} />

      <button
        type="button"
        className="button-effect"
        onClick={addToCart}
        disabled={!product.inStock || atLimit}
      >
        {buttonLabel()}
      </button>
    </div>
  );
}

export default Product;

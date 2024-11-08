import React from 'react'
import '../css/CheckoutProduct.css';
import { useStateValue } from './StateProvider';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

function CheckoutProduct({ id, image, title, description, price, rating, hideButton}) {
  const [{ basket }, dispatch] = useStateValue();

  const removeFromBasket = () => {
    dispatch({
      type: 'REMOVE_FROM_CART',
      id: id,
    })
  }

  const StyledRating = styled(Rating)({
    '& .MuiRating-iconFilled': {
      color: '#ea8d3a',
    },
  });

  return (
    <div className='checkoutProduct'>
      <img className='checkouProduct_image' src={image} style={{ width: '200px', height: 'auto' }}/>
      <div className='checkoutProduct_info'>
        <p className='checkoutProduct_title'>{title}</p>
        <p className='checkoutProduct_description'>{description}</p>
        <p className='checkoutProduct_price'>
            <small>$</small>
            <strong>{price}</strong>
        </p>
        <Typography sx={{ mt: 1 }}>
          <StyledRating name="half-rating-read" value={rating} precision={0.1} readOnly />
        </Typography>
        {!hideButton && (
          <button className='button-effect' onClick={removeFromBasket}>Remove From Cart</button>
        )}
      </div>
    </div>
  )
}

export default CheckoutProduct

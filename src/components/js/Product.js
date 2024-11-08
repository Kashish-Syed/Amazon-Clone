import React from 'react'
import "../css/Product.css"
import { useStateValue } from './StateProvider'
import '../css/App.css';
import Rating from '@mui/material/Rating';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';

function Product({ id, title, description, image, price, rating}) {

  const [state, dispatch] = useStateValue();

  const MAX_LENGTH = 100;

  const truncatedDescription = (description && description.length > MAX_LENGTH)
    ? description.slice(0, MAX_LENGTH) + '...'
    : description;

  const addToCart = () => {
    // dispatch the item into the data layer
    dispatch({
      type: 'ADD_TO_CART',
      item: {
        id: id,
        title: title,
        description: truncatedDescription,
        image: image,
        price: price,
        rating: rating,
      },
    });
  };
  
  const StyledRating = styled(Rating)({
    '& .MuiRating-iconFilled': {
      color: '#ea8d3a',
    },
  });

  return (
    <div className='product pop-out'>
      
      <div className='product_info'>
        <p style={{ marginBottom : '5px' }}><strong>{title}</strong></p>
        <p style={{ marginBottom : '5px' }}>{truncatedDescription}</p>

        <p className='product_price'>
          <small>$ </small>
          <strong>{price}</strong>
        </p>

        <Typography sx={{ mt: 1 }}>
          <StyledRating name="half-rating-read" value={rating} precision={0.1} readOnly />
        </Typography>
      </div>

      <img className='product_img' src={image} alt='Product Image'/>
      <button className='button-effect' onClick={addToCart}>Add to cart</button>

    </div>
  )
}

export default Product

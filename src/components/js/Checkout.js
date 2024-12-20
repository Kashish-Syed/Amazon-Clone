import React from 'react'
import '../css/Checkout.css';
import Subtotal from './Subtotal';
import CheckoutProduct from './CheckoutProduct';
import { useStateValue } from './StateProvider';

function Checkout() {
  const [{ basket }, dispatch] = useStateValue()

  return (
    <div className='checkout'>
      <img className='checkout_ad' src='/images/name_banner.png' alt='Name Banner'/>
      <div className='checkout_content'>
        <div className='checkout_left'>
          <h2 className='checkout_title'>Your shopping cart</h2>
          {basket.map(item => (
            <CheckoutProduct
              key={item.id} // Added a key prop for list items
              id={item.id}
              title={item.title}
              description={item.description}
              image={item.image}
              price={item.price}
              rating={item.rating}
            />
          ))}
        </div>

        <div className='checkout_right'>
          <Subtotal />
        </div>
      </div>
    </div>
  );
}

export default Checkout

import React from 'react'
import '../css/Checkout.css';
import Subtotal from './Subtotal';

function Checkout() {
  return (
    <div className='checkout'>
      <div className='checkout_left'>
        {/* <img className='checkout_ad' src='/images/background_banner.jpg' alt=''/> */}
        <div className='checkout_title'>
            <h2>Your checkout cart</h2>
            {/* cart */}
            {/* cart */}
        </div>
      </div>

      <div className='checkout_right'>
        <Subtotal />
      </div>
    </div>
  )
}

export default Checkout

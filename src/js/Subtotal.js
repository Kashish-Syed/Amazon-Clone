import React from 'react'
import '../css/Subtotal.css';
import CurrencyFormat from "react-currency-format";
import { useStateValue } from './StateProvider';
import { getBasketTotal } from './reducer';
import { useNavigate } from 'react-router-dom';

function Subtotal() {
    const [{ basket }, dispatch] = useStateValue();
    const navigate = useNavigate();

  return (
    <div className='subtotal'>
        <CurrencyFormat
            renderText={(value) => (
                <>
                {/* use the value here */}
                    <p>
                        Subtotal ({basket.length} items): <strong>{value}</strong>
                    </p>
                    <small className='subtotal_gift'>
                        <input type='checkbox' /> This order contains a gift
                    </small>
                </>
            )}
            decimalScale={2}
            value={getBasketTotal(basket)} // implement later
            displayType={"text"}
            thousandSeparator={true}
            prefix={"$"}
        />

        <button onClick={e => navigate('/payment')}>Checkout</button>
    </div>
  )
}

export default Subtotal

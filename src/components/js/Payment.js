import React, { useEffect, useState } from 'react';
import '../css/Payment.css';
import { useStateValue } from './StateProvider';
import CheckoutProduct from './CheckoutProduct';
import { Link } from '@mui/material';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import CurrencyFormat from 'react-currency-format';
import { getBasketTotal } from './reducer';
import axios from './axios';
import { useNavigate } from 'react-router-dom';
import { db } from '../../database/firebase';
import { collection, doc, setDoc } from "firebase/firestore";

function Payment() {
    const [{ basket, user }, dispatch] = useStateValue();

    const stripe = useStripe();
    const elements = useElements();
    const navigate = useNavigate();

    const [succeeded, setSucceeded] = useState(false);
    const [processing, setProcessing] = useState("")
    const [error, setError] = useState(null);
    const [disabled, setDisabled] = useState(true);
    const [clientSecret, setClientSecret] = useState(null);

    useEffect(() => {
        // generate the special stripe secret which allows us to charge a customer
        const getClientSecret = async () => {
            try{
                const response = await axios({
                    method: 'post',
                    // stripe expects the total in a currencies sub units
                    // for example: for $10 it wants 1000. If you are ding dollars it changes into cents
                    url: `/payments/create?total=${getBasketTotal(basket) * 100}`
                });
                setClientSecret(response.data.clientSecret);
            } catch (error) {
                console.error('Error fetching client secret: ', error);
            }
        }
        getClientSecret();
    }, [basket]);

    const handleSubmit = async (event) => {
        // does all the stripe implementation
        event.preventDefault();
        setProcessing(true);

        const payload = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: elements.getElement(CardElement)
            }
        }).then(({ paymentIntent }) => {
            // paymentIntent = payment confirmation

            const ordersCollection = collection(db, 'users', user?.uid, 'orders');
            const orderDoc = doc(ordersCollection, paymentIntent.id);

            setDoc(orderDoc, {
                basket: basket,
                amount: paymentIntent.amount,
                created: paymentIntent.created,
            });

            setSucceeded(true);
            setError(null);
            setProcessing(false);

            dispatch({
                type: 'EMPTY_CART'
            })

            navigate('/orders', { replace: true });

        })
    }

    const handleChange = event => {
        // listen for any changes in the CardElement
        // and display any errors as the customer types their card details
        setDisabled(event.empty);
        setError(event.error ? event.error.message : "");
    }

  return (
    <div className='payment'>
      <div className='payment_container'>
        <h1>
            Checkout (<Link to='/checkout'>{basket?.length} items</Link>)
        </h1>
        {/* Payment section: delivery address */}
        <div className='payment_section'>
            <div className='payment_title'>
                <h3>Delivery Address</h3>
            </div>
            <div className='payment_address'>
                <p>{user?.email}</p>
                <p>Address Line 1</p>
                <p>Address Line 2</p>
            </div>
        </div>

        {/* Payment section: reviewing the items */}
        <div className='payment_section'>
            <div className='payment_title'>
                <h3>Review Items and Delivery</h3>
            </div>
            <div className='payment_items'>
                {/* All the products are going to show here */}
                {/* pull the basket here */}
                {basket.map(item => (
                    <CheckoutProduct
                        id={item.id}
                        title={item.title}
                        description={item.description}
                        image={item.image}
                        price={item.price}
                        rating={item.rating}
                    />
                ))}
            </div>
        </div>

        {/* Payment section: payment method */}
        <div className='payment_section'>
            <div className='payment_title'>
                <h3>Payment method</h3>
            </div>
            <div className='payment_details'>
                {/* stripe implementation here */}
                <form onSubmit={handleSubmit}>
                    <CardElement onChange={handleChange} />

                    <div className='payment_priceContainer'>
                        <CurrencyFormat
                            renderText={(value) => (
                                <h3>Order Total: {value}</h3>
                            )}
                            decimalScale={2}
                            value={getBasketTotal(basket)}
                            displayType={'text'}
                            thousandSeparator={true}
                            prefix={'$'}
                        />
                        <button disabled={processing || disabled || succeeded}>
                            <span>{processing ? <p>Processing</p> : "Buy Now"}</span>
                        </button>
                    </div>

                    {error && <div>{error}</div>}
                </form>
            </div>
        </div>

      </div>
    </div>
  )
}

export default Payment

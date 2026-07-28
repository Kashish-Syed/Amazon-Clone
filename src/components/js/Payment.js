import React, { useEffect, useState } from 'react';
import '../css/Payment.css';
import { useStateValue } from './StateProvider';
import CheckoutProduct from './CheckoutProduct';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import CurrencyFormat from 'react-currency-format';
import { getBasketTotal } from './reducer';
import axios from './axios';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../../database/firebase';
import { collection, doc, setDoc } from "firebase/firestore";

function Payment() {
    const [{ basket, user }, dispatch] = useStateValue();

    const stripe = useStripe();
    const elements = useElements();
    const navigate = useNavigate();

    const [succeeded, setSucceeded] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [disabled, setDisabled] = useState(true);
    const [clientSecret, setClientSecret] = useState(null);

    // Stripe works in the currency's smallest unit, so $10.00 is sent as 1000.
    // Math.round matters: floating-point prices like 29.99 * 100 produce
    // 2998.9999999999995, and Stripe rejects a non-integer amount.
    const totalInCents = Math.round(getBasketTotal(basket) * 100);

    useEffect(() => {
        // Generate the Stripe client secret that allows us to charge this customer.
        if (basket.length === 0) {
            setClientSecret(null);
            return;
        }

        let cancelled = false;

        const getClientSecret = async () => {
            try {
                const response = await axios.post('', null, {
                    params: { total: totalInCents },
                });
                if (!cancelled) {
                    setClientSecret(response.data.clientSecret);
                    setError(null);
                }
            } catch (err) {
                // Previously this only logged to the console, so a dead payments
                // endpoint left the Buy button silently inert with no user feedback.
                console.error('Error fetching client secret: ', err);
                if (!cancelled) {
                    setClientSecret(null);
                    setError(
                        err.response?.data?.error ??
                        'Could not reach the payment service. Please try again later.'
                    );
                }
            }
        };

        getClientSecret();

        // Guard against an out-of-order response overwriting newer state when the
        // basket changes quickly.
        return () => { cancelled = true; };
    }, [basket, totalInCents]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements || !clientSecret || processing) {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(
                clientSecret,
                { payment_method: { card: elements.getElement(CardElement) } }
            );

            // A declined card returns an error and NO paymentIntent. The previous
            // code went straight to paymentIntent.id and threw a TypeError here.
            if (stripeError) {
                setError(stripeError.message);
                setProcessing(false);
                return;
            }

            const ordersCollection = collection(db, 'users', user.uid, 'orders');
            const orderDoc = doc(ordersCollection, paymentIntent.id);

            // Awaited so we do not navigate to /orders before the write lands.
            await setDoc(orderDoc, {
                basket: basket,
                amount: paymentIntent.amount,
                created: paymentIntent.created,
            });

            setSucceeded(true);
            setError(null);
            setProcessing(false);

            dispatch({ type: 'EMPTY_CART' });

            navigate('/orders', { replace: true });
        } catch (err) {
            console.error('Payment failed: ', err);
            setError('Something went wrong while processing your payment.');
            setProcessing(false);
        }
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
                {basket.map((item, index) => (
                    <CheckoutProduct
                        key={`${item.id}-${index}`}
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
                        <button disabled={processing || disabled || succeeded || !clientSecret}>
                            <span>{processing ? "Processing..." : "Buy Now"}</span>
                        </button>
                    </div>

                    {error && <div className='payment_error'>{error}</div>}
                </form>
            </div>
        </div>

      </div>
    </div>
  )
}

export default Payment

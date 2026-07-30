import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import '../css/Payment.css';
import { useStateValue } from './StateProvider';
import { ACTIONS, selectPricing } from './reducer';
import CheckoutProduct from './CheckoutProduct';
import OrderSummary from './OrderSummary';
import DeliveryOptions from './DeliveryOptions';
import { createPaymentIntent } from '../../services/paymentService';
import { createOrder } from '../../services/orderService';
import { format } from '../../lib/money';
import { logger, newCorrelationId, serializeError } from '../../lib/logger';

function Payment() {
  const [state, dispatch] = useStateValue();
  const { lines, user } = state;

  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  const [clientSecret, setClientSecret] = useState(null);
  const [setupError, setSetupError] = useState(null);
  const [cardError, setCardError] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // One id for the whole checkout attempt, shared by the client secret request,
  // the order write, and the Supabase function's own logs. Without it, three
  // separate log streams cannot be lined up when something goes wrong.
  const correlationId = useRef(newCorrelationId());

  const pricing = selectPricing(state);
  const { totalCents, itemCount } = pricing;

  const requestClientSecret = useCallback(
    async (amountCents, signal) => {
      if (amountCents <= 0) {
        setClientSecret(null);
        return;
      }

      try {
        const result = await createPaymentIntent({
          amountCents,
          correlationId: correlationId.current,
        });

        if (signal.cancelled) return;

        setClientSecret(result.clientSecret);
        setSetupError(null);
      } catch (error) {
        if (signal.cancelled) return;

        // The service already logged the cause. What matters here is that the
        // failure reaches the screen: the original code only console.logged it,
        // so a dead payments endpoint left the Buy button permanently disabled
        // with no explanation anywhere in the UI.
        setClientSecret(null);
        setSetupError(error.message);
      }
    },
    []
  );

  useEffect(() => {
    // A cancellation flag rather than AbortController, because we are guarding
    // against a stale RESPONSE being applied, not trying to cancel the request.
    // Changing the cart quickly can leave two requests in flight, and the older
    // one must not overwrite the newer client secret.
    const signal = { cancelled: false };

    requestClientSecret(totalCents, signal);

    return () => {
      signal.cancelled = true;
    };
  }, [totalCents, requestClientSecret]);

  // Checkout requires an account, because orders are written to
  // users/{uid}/orders and the Firestore rules reject an unauthenticated write.
  // Without this guard the shopper reaches the card form, pays, and only then
  // hits a permission error - after the money has moved.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret || processing || succeeded) {
      return;
    }

    setProcessing(true);
    setCardError(null);

    const log = logger.child({ correlationId: correlationId.current });

    try {
      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card: elements.getElement(CardElement) } }
      );

      // A declined card returns an error and NO paymentIntent. Reading
      // paymentIntent.id here threw a TypeError, so a perfectly ordinary
      // decline surfaced as a crash instead of "your card was declined".
      if (stripeError) {
        log.warn('payment.declined', {
          code: stripeError.code,
          declineCode: stripeError.decline_code,
        });
        setCardError(stripeError.message);
        setProcessing(false);
        return;
      }

      log.info('payment.succeeded', {
        paymentIntentId: paymentIntent.id,
        amountCents: paymentIntent.amount,
      });

      // The charge has already gone through at this point. If the order write
      // fails the customer must be told explicitly - which is why createOrder
      // throws a message saying so rather than failing quietly.
      await createOrder({
        userId: user.uid,
        paymentIntentId: paymentIntent.id,
        chargedAt: paymentIntent.created,
        pricing,
        correlationId: correlationId.current,
      });

      setSucceeded(true);
      setProcessing(false);
      dispatch({ type: ACTIONS.EMPTY_CART });
      navigate('/orders', { replace: true });
    } catch (error) {
      log.error('payment.failed', { error: serializeError(error) });
      setCardError(error.message ?? 'Something went wrong while processing your payment.');
      setProcessing(false);
    }
  };

  const handleCardChange = (event) => {
    setCardComplete(event.complete);
    setCardError(event.error ? event.error.message : null);
  };

  const blockingError = setupError ?? cardError;
  const canSubmit = Boolean(stripe && clientSecret && cardComplete && !processing && !succeeded);

  if (itemCount === 0) {
    return (
      <div className="payment">
        <div className="payment_container">
          <h1>Checkout</h1>
          <p>
            Your cart is empty. <Link to="/">Find something to buy</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment">
      <div className="payment_container">
        <h1>
          Checkout (<Link to="/checkout">{itemCount} items</Link>)
        </h1>

        <div className="payment_section">
          <div className="payment_title">
            <h3>Delivery</h3>
          </div>
          <div className="payment_address">
            <p>{user?.email}</p>
            <DeliveryOptions />
          </div>
        </div>

        <div className="payment_section">
          <div className="payment_title">
            <h3>Review items and delivery</h3>
          </div>
          <div className="payment_items">
            {lines.map((line) => (
              <CheckoutProduct key={line.productId} line={line} readOnly />
            ))}
          </div>
        </div>

        <div className="payment_section">
          <div className="payment_title">
            <h3>Payment method</h3>
          </div>
          <div className="payment_details">
            <OrderSummary pricing={pricing} compact />

            <form onSubmit={handleSubmit}>
              <CardElement onChange={handleCardChange} />

              <div className="payment_priceContainer">
                <h3>Order total: {format(totalCents)}</h3>
                <button type="submit" disabled={!canSubmit}>
                  <span>{processing ? 'Processing…' : 'Buy Now'}</span>
                </button>
              </div>

              {blockingError && (
                <div className="payment_error" role="alert">
                  {blockingError}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Payment;

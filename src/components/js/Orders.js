import React, { useEffect, useState } from 'react';
import '../css/Orders.css';
import { useStateValue } from './StateProvider';
import { subscribeToOrders } from '../../services/orderService';
import Order from './Order';
import { newCorrelationId } from '../../lib/logger';

const STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  SIGNED_OUT: 'signed_out',
  FAILED: 'failed',
};

function Orders() {
  const [{ user, authResolved }] = useStateValue();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Until Firebase has answered, `user` being null means nothing. Announcing
    // "Sign in to see your orders" here makes the page flash that message at a
    // shopper who is in fact signed in.
    if (!authResolved) {
      setStatus(STATUS.LOADING);
      return undefined;
    }

    if (!user) {
      setOrders([]);
      setStatus(STATUS.SIGNED_OUT);
      return undefined;
    }

    setStatus(STATUS.LOADING);

    const unsubscribe = subscribeToOrders({
      userId: user.id,
      correlationId: newCorrelationId(),
      onChange: (next) => {
        setOrders(next);
        setStatus(STATUS.READY);
      },
      onError: (caught) => {
        // onSnapshot only reports errors if you pass this callback. Without it
        // a rules rejection left the page sitting on "You have no orders yet",
        // which reads as "you have never bought anything".
        setError(
          caught?.code === 'permission-denied'
            ? 'You are not allowed to read these orders. Check the Firestore rules.'
            : 'We could not load your orders. Please refresh to try again.'
        );
        setStatus(STATUS.FAILED);
      },
    });

    return () => unsubscribe();
  }, [user, authResolved]);

  return (
    <div className="orders">
      <h1>Your Orders</h1>

      <div className="orders_order">
        {status === STATUS.LOADING && <p role="status">Loading your orders&hellip;</p>}

        {status === STATUS.SIGNED_OUT && <p>Sign in to see your orders.</p>}

        {status === STATUS.FAILED && (
          <p role="alert" className="orders_error">
            {error}
          </p>
        )}

        {status === STATUS.READY && orders.length === 0 && <p>You have no orders yet.</p>}

        {status === STATUS.READY &&
          orders.map((order) => <Order key={order.id} order={order} />)}
      </div>
    </div>
  );
}

export default Orders;

export { STATUS };

import React, { useEffect } from 'react';
import '../css/App.css';
import Header from './Header';
import Home from './Home';
import Login from './Login';
import Payment from './Payment';
import Orders from './Orders';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Checkout from './Checkout';
import { auth } from '../../database/firebase';
import { useStateValue } from './StateProvider';
import { onAuthStateChanged } from 'firebase/auth';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from "@stripe/react-stripe-js";

// The publishable key is safe to ship in the bundle, but it is read from .env so
// the app can be pointed at a different Stripe account without a code change.
const stripePublishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const promise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function App() {
  const [, dispatch] = useStateValue();

  useEffect(() => {
    // This will only run once when the app component loads.
    // onAuthStateChanged returns an unsubscribe function; calling it on unmount
    // stops the listener from firing into a component that no longer exists.
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      dispatch({
        type: 'SET_USER',
        user: authUser ?? null,
      });
    });

    return () => unsubscribe();
  }, [dispatch]);

  return (
    //BEM
    <Router>
      <div className="app">
        <Routes>
          <Route path="/orders" element={<><Header /><Orders /></>} />
          <Route path="/login" element={<Login />} />
          <Route path="/checkout" element={<><Header /><Checkout /></>} />
          <Route path="/" element={<><Header /><Home /></>} />
          <Route
            path="/payment"
            element={
              <>
                <Header />
                {promise ? (
                  <Elements stripe={promise}>
                    <Payment />
                  </Elements>
                ) : (
                  <p style={{ padding: '2rem' }}>
                    Payments are unavailable: REACT_APP_STRIPE_PUBLISHABLE_KEY is not set.
                  </p>
                )}
              </>
            }
          />
          {/* Unknown paths fall back to the homepage instead of a blank screen. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App;

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { onAuthStateChanged } from 'firebase/auth';
import '../css/App.css';
import Header from './Header';
import Home from './Home';
import Login from './Login';
import Payment from './Payment';
import Orders from './Orders';
import Checkout from './Checkout';
import ErrorBoundary from './ErrorBoundary';
import { auth } from '../../database/firebase';
import { useStateValue } from './StateProvider';
import { ACTIONS } from './reducer';
import { config } from '../../config';
import { logger } from '../../lib/logger';

// The publishable key is safe to ship in the bundle - it can only create
// payment attempts, never move money on its own. It comes from config so the
// app can be pointed at a different Stripe account without a code change.
const stripePromise = config.stripe.publishableKey
  ? loadStripe(config.stripe.publishableKey)
  : null;

/**
 * Wraps a page with the header and its own error boundary, so a crash inside
 * one page does not take the navigation down with it.
 */
function Page({ name, children }) {
  return (
    <>
      <Header />
      <ErrorBoundary name={name}>{children}</ErrorBoundary>
    </>
  );
}

function App() {
  const [, dispatch] = useStateValue();

  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function; calling it on unmount
    // stops the listener from firing into a component that no longer exists.
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      logger.debug('auth.state_changed', { signedIn: Boolean(authUser) });
      dispatch({ type: ACTIONS.SET_USER, user: authUser ?? null });
    });

    return () => unsubscribe();
  }, [dispatch]);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Page name="home"><Home /></Page>} />
          <Route path="/login" element={<ErrorBoundary name="login"><Login /></ErrorBoundary>} />
          <Route path="/checkout" element={<Page name="checkout"><Checkout /></Page>} />
          <Route path="/orders" element={<Page name="orders"><Orders /></Page>} />

          <Route
            path="/payment"
            element={
              <Page name="payment">
                {stripePromise ? (
                  <Elements stripe={stripePromise}>
                    <Payment />
                  </Elements>
                ) : (
                  // Config problem, not a crash - say which variable is missing
                  // rather than rendering a card form that can never work.
                  <p style={{ padding: '2rem' }}>
                    Payments are unavailable: REACT_APP_STRIPE_PUBLISHABLE_KEY is not set.
                  </p>
                )}
              </Page>
            }
          />

          {/* Unknown paths fall back to the homepage instead of a blank screen. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

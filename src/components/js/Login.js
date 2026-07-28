import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import '../css/Login.css';
import { auth } from '../../database/firebase';
import { logger, serializeError } from '../../lib/logger';

// Firebase auth error codes are machine names, not sentences. Showing
// "auth/invalid-credential" to a shopper is not an error message, and the
// previous alert() dumped exactly that into a modal they had to dismiss before
// they could correct the typo.
const ERROR_MESSAGES = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists with that email. Try signing in.',
  'auth/weak-password': 'Passwords need to be at least six characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'We could not reach the sign-in service. Check your connection.',
};

function messageFor(error) {
  return ERROR_MESSAGES[error?.code] ?? 'Something went wrong. Please try again.';
}

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const run = async (event, action, eventName) => {
    event.preventDefault();

    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await action(auth, email, password);
      logger.info(eventName);
      navigate('/');
    } catch (caught) {
      // Logged with the raw code so the cause is diagnosable, while the user
      // sees the translated sentence.
      logger.warn(`${eventName}.failed`, { error: serializeError(caught) });
      setError(messageFor(caught));
      setPending(false);
    }
  };

  const signIn = (event) => run(event, signInWithEmailAndPassword, 'auth.signed_in');
  const register = (event) => run(event, createUserWithEmailAndPassword, 'auth.registered');

  return (
    <div className="login">
      <Link to="/">
        <img className="login_logo" src="/images/Amazon_logo.svg.png" alt="Amazon" />
      </Link>

      <div className="login_container">
        <h1>Sign In</h1>

        <form onSubmit={signIn}>
          <h5>Email</h5>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <h5>Password</h5>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && (
            <p className="login_error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login_signInButton" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p>
          By signing in you agree to Amazon FAKE CLONE&apos;s Conditions for use &amp;
          sale... blah blahblah
        </p>

        <button
          type="button"
          onClick={register}
          className="login_registerButton"
          disabled={pending}
        >
          Create your Amazon account
        </button>
      </div>
    </div>
  );
}

export default Login;

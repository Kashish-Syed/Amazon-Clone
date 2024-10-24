import React, { useEffect } from 'react';
import '../css/App.css';
import Header from '../js/Header';
import Home from '../js/Home';
import Login from '../js/Login';
import Product from '../js/Product';
import Payment from './Payment';
import Orders from './Orders';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Checkout from '../js/Checkout';
import { auth } from './firebase';
import { useStateValue } from './StateProvider';
import { onAuthStateChanged } from 'firebase/auth';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from "@stripe/react-stripe-js";

const promise = loadStripe('pk_test_51QCRssB3IslARpkzRff1r9Om663UeCtCoeHP4LnYpNld3WGl6WPEmyfHDFhlDtK92Z9sc6nmLrpLTiSQTBeQgLq900EAKwmO2K');

function App() {
  const [{}, dispatch] = useStateValue();

  useEffect(() => {
    // This will only run once when the app component loads
    onAuthStateChanged(auth, (authUser) => {
      console.log('THE USER IS >>>> ', authUser);
      if (authUser) {
        dispatch({
          type: 'SET_USER',
          user: authUser
        })
      } else {
        dispatch({
          type: 'SET_USER',
          user: null
        })
      }
    })
  }, [])

  return (
    //BEM
    <Router>
      <div className="app">
        <Routes>
          <Route path="/orders" element={[ <Orders /> ]}/>
          <Route path="/login" element={[ <Login /> ]}/>
          <Route path="/checkout" element={[ <Header />, <Checkout />]}/>
          <Route path="/" element={[ <Header />, <Home />]}/>
          <Route path="/payment" element={[
            <Header />, 
            <Elements stripe={promise}>
              <Payment />
            </Elements>
          ]}/>
        </Routes>
      </div>
    </Router>
  )
}

export default App;

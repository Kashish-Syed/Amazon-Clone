import React from 'react';
import '../css/App.css';
import Header from '../js/Header';
import Home from '../js/Home';
import Login from '../js/Login';
import Product from '../js/Product';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Checkout from '../js/Checkout';

function App() {
  return (
    //BEM
    <Router>
      <div className="app">
        <Routes>
          <Route path="/login" element={[ <Login /> ]}/>
          <Route path="/checkout" element={[ <Header />, <Checkout />]}/>
          <Route path="/" element={[ <Header />, <Home />]}/>
        </Routes>
      </div>
    </Router>
  )
}

export default App;

import '../css/App.css';
import Header from '../js/Header';
import Home from '../js/Home';
import Product from '../js/Product';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Checkout from '../js/Checkout';

function App() {
  return (
    //BEM
    <Router>
      <div className="app">
      <Header />
        <Routes>
          <Route path="/checkout" element={[ <Checkout />]}/>
          <Route path="/" element={[ <Home />]}/>
        </Routes>
      </div>
    </Router>
  );
}

export default App;

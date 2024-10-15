import '../css/App.css';
import Header from '../js/Header';
import Home from '../js/Home';
import Product from '../js/Product';

function App() {
  return (
    //BEM
    <div className="App">
      <Header />
      <Home />
      <Product />
    </div>
    /* Home Component */
  );
}

export default App;

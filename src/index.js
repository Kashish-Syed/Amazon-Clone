import React from 'react';
import ReactDOM from 'react-dom/client';
import './components/css/index.css';
import App from './components/js/App';
import reportWebVitals from './reportWebVitals';
import { StateProvider } from './components/js/StateProvider';
import reducer, { initialState } from './components/js/reducer';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <StateProvider initialState={initialState} reducer={reducer}>
      <App />
    </StateProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

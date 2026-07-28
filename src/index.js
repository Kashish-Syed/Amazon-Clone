import React from 'react';
import ReactDOM from 'react-dom/client';
import './components/css/index.css';
import './components/css/ErrorBoundary.css';
import App from './components/js/App';
import ErrorBoundary from './components/js/ErrorBoundary';
import reportWebVitals from './reportWebVitals';
import { StateProvider } from './components/js/StateProvider';
import reducer, { initialState } from './components/js/reducer';
import { config, findConfigProblems } from './config';
import { logger } from './lib/logger';

// Report configuration gaps once, at startup, instead of letting each one
// surface later as its own unrelated-looking failure.
const problems = findConfigProblems();

if (problems.length > 0) {
  logger.warn('config.incomplete', { problems });
}

logger.info('app.started', {
  environment: config.environment,
  features: config.features,
  paymentsApiUrl: config.payments.apiUrl,
});

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    {/* Outermost boundary: a crash below this shows a message instead of a
        blank white page. */}
    <ErrorBoundary name="root">
      <StateProvider initialState={initialState} reducer={reducer}>
        <App />
      </StateProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Pass a function to send these somewhere: reportWebVitals(console.log) or an
// analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals((metric) => {
  logger.debug('web_vital', { name: metric.name, value: metric.value });
});

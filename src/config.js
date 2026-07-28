// Single source of truth for runtime configuration.
//
// Everything the app reads from the environment is resolved here, once, and
// exported as a plain object. Nothing else in src/ should touch process.env.
//
// Why this exists: environment values used to be read inline wherever they were
// needed (firebase.js, App.js, axios.js), which meant a missing variable showed
// up as a different failure in each place - an empty product grid here, a
// disabled Buy button there - with nothing tying them together.
//
// Create React App inlines REACT_APP_* variables at BUILD time, not at run time.
// A production bundle carries whatever was in .env when `npm run build` ran, so
// changing .env on the server does nothing until you rebuild.

const env = process.env;

/** Parse a REACT_APP_* boolean. Accepts "true"/"1"; everything else is false. */
function readFlag(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

/** Parse a REACT_APP_* integer, falling back when unset or malformed. */
function readInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  environment: env.NODE_ENV ?? 'development',

  firebase: {
    apiKey: env.REACT_APP_FIREBASE_API_KEY,
    authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.REACT_APP_FIREBASE_APP_ID,
    measurementId: env.REACT_APP_FIREBASE_MEASUREMENT_ID,
  },

  stripe: {
    publishableKey: env.REACT_APP_STRIPE_PUBLISHABLE_KEY,
  },

  payments: {
    // Defaults to a locally running Supabase Edge Function. See
    // supabase/functions/payments/index.ts.
    apiUrl:
      env.REACT_APP_PAYMENTS_API_URL ||
      'http://127.0.0.1:54321/functions/v1/payments',
    timeoutMs: readInt(env.REACT_APP_PAYMENTS_TIMEOUT_MS, 10000),
  },

  logging: {
    // debug | info | warn | error | silent
    level: env.REACT_APP_LOG_LEVEL || (env.NODE_ENV === 'production' ? 'warn' : 'debug'),
    // How many recent entries to keep in memory for in-browser inspection.
    bufferSize: readInt(env.REACT_APP_LOG_BUFFER_SIZE, 200),
  },

  // Feature flags let a half-finished capability ship dark instead of living on
  // a long-lived branch. Each one defaults to the value we want in production.
  features: {
    promotions: readFlag(env.REACT_APP_FEATURE_PROMOTIONS, true),
    taxEstimates: readFlag(env.REACT_APP_FEATURE_TAX_ESTIMATES, true),
    expressShipping: readFlag(env.REACT_APP_FEATURE_EXPRESS_SHIPPING, true),
  },
};

/** Config keys that the app genuinely cannot start without. */
const REQUIRED_FIREBASE_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

/**
 * Report configuration problems without throwing.
 * @returns {string[]} human-readable problems; empty means the config is usable.
 */
export function findConfigProblems() {
  const problems = [];

  for (const key of REQUIRED_FIREBASE_KEYS) {
    if (!config.firebase[key]) {
      problems.push(`Missing REACT_APP_FIREBASE_${camelToScreamingSnake(key)}`);
    }
  }

  if (!config.stripe.publishableKey) {
    // Not fatal: the storefront still browses fine, only checkout is dead.
    problems.push('Missing REACT_APP_STRIPE_PUBLISHABLE_KEY (checkout will be disabled)');
  }

  return problems;
}

/**
 * Throw if Firebase cannot be initialised. Called from database/firebase.js.
 *
 * Failing loudly here beats the previous behaviour, where an empty config
 * object produced an opaque SDK error much later, at the first query.
 */
export function assertFirebaseConfigured() {
  const missing = REQUIRED_FIREBASE_KEYS.filter((key) => !config.firebase[key]);

  if (missing.length > 0) {
    const names = missing
      .map((key) => `REACT_APP_FIREBASE_${camelToScreamingSnake(key)}`)
      .join(', ');
    throw new Error(
      `Firebase configuration is incomplete - missing: ${names}. ` +
        'Copy .env.example to .env and fill in the values from the Firebase console ' +
        '(Project settings -> Your apps -> SDK setup and configuration), then restart ' +
        'the dev server. Note that a production build bakes these in at build time.'
    );
  }
}

function camelToScreamingSnake(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

export default config;

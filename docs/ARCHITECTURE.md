# Architecture

How this codebase is put together, and why. Read this before adding a feature —
most "where does this go?" questions are answered by the layering below.

## The short version

The app is arranged in four layers. **Dependencies only ever point downwards.**

```
  components/          React. Rendering and user events. No arithmetic, no SDKs.
        │
        ▼
  services/            Firestore and Stripe live behind here. Async, logged.
        │
        ▼
  domain/              Business rules. Pure functions over integers. No I/O.
        │
        ▼
  lib/  +  config.js   Money, logging, HTTP, environment.
```

A component never imports `firebase/firestore`. A domain module never imports
React. If you find yourself wanting to break that, the thing you are adding
probably belongs in a different layer.

## Why it is arranged this way

The original version had no layers at all. `Home.js` built its own Firestore
query, shaped the result and rendered it; `Payment.js` did its own arithmetic
and its own HTTP call. Two consequences:

1. **Every failure looked the same.** An empty product grid could mean the data
   was still loading, the security rules rejected the read, the collection was
   genuinely empty, or the request threw. One symptom, four causes, no way to
   tell them apart without a debugger.
2. **The same number was computed twice.** The cart page added prices one way
   and the Stripe call added them another. Nothing in the app could notice when
   the two disagreed.

The layering fixes both. A failure is caught and named at the layer that
understands it, and every monetary figure comes from exactly one function.

## The layers

### `src/config.js`

Everything read from the environment, resolved once. Nothing else in `src/`
touches `process.env`.

Note that Create React App inlines `REACT_APP_*` variables **at build time**. A
deployed bundle carries whatever was in `.env` when `npm run build` ran —
changing `.env` on the server does nothing until you rebuild. This is exactly
how the site once appeared to work while running a months-old build.

### `src/lib/`

| Module      | Responsibility |
|-------------|----------------|
| `money.js`  | Integer-cent arithmetic, rounding, allocation, formatting |
| `logger.js` | Structured logging with levels, correlation ids and a ring buffer |
| `http.js`   | The axios client for our payments backend, with request/response logging |

**The money rule:** every monetary amount that crosses a module boundary is an
integer number of cents. Never a float, never a string. Dollars exist in two
places only — values read out of Firestore (converted on the way in) and text
shown to a human (converted on the way out).

### `src/domain/`

Pure business logic. No React, no network, no Firebase. Every function takes
data and returns data, which is why this layer carries most of the test suite.

| Module          | Responsibility |
|-----------------|----------------|
| `catalog.js`    | Normalising raw Firestore documents into trustworthy products |
| `cart.js`       | Cart lines, quantities, stock limits |
| `promotions.js` | Promo codes, minimum spend, discount caps |
| `tax.js`        | Regional rates, and whether shipping is taxable |
| `shipping.js`   | Service levels, free-shipping thresholds, per-item surcharges |
| `pricing.js`    | The orchestrator that turns a cart into an order total |

`pricing.js` is the most important file in the repository. Its ordering of
operations is documented at the top of the file and is deliberately explicit,
because swapping any two steps changes what a customer is charged without
producing an error anywhere.

### `src/services/`

The only modules that talk to the outside world.

| Module              | Responsibility |
|---------------------|----------------|
| `productService.js` | Reads the catalogue, normalises it, reports rejected documents |
| `orderService.js`   | Writes orders; reads both schema versions back |
| `paymentService.js` | Creates Stripe PaymentIntents via the Supabase function |

Each one catches its own failures, logs them with a machine-readable event name,
and re-throws a typed error carrying a message safe to show a user.

### `src/components/`

React. Components read state, dispatch actions and render. They call
`selectPricing()` for money figures rather than adding anything up themselves.

## State

`reducer.js` holds only what the user chose: cart lines, the signed-in user, and
the three checkout selections (promo code, region, shipping method).

It stores **no derived values** — no subtotal, no tax, no total. Caching a total
in state means two answers exist for "what does this order cost", and they drift
the moment an action forgets to recompute one. Totals come from
`selectPricing(state)`, which runs the pricing engine over current state on
every call.

## Observability

Logs are structured objects, not strings:

```js
logger.info('products.fetch.succeeded', { documentCount: 11, durationMs: 240 });
```

`event` is a short dotted name so occurrences can be counted and compared.
Free text goes in the fields.

A **correlation id** ties together the log lines belonging to one logical
operation. A checkout attempt mints one and passes it to the PaymentIntent
request (as the `X-Correlation-Id` header) and the order write, so three
separate log streams can be lined up afterwards.

Entries are also kept in an in-memory ring buffer. In a browser console:

```js
__APP_LOGS__()               // recent entries, oldest first
__APP_SET_LOG_LEVEL__('debug')  // turn up detail without a rebuild
```

## Data

### Products

`products/{slug}` — world-readable, client-writes denied. Seeded from
`scripts/products.seed.json` via `npm run seed:products`.

The collection predates any schema discipline, so `domain/catalog.js` defends
against prices stored as strings, missing `stock` fields and empty image paths.
That normalisation happens once, at the boundary; nothing downstream repeats it.

### Orders

`users/{uid}/orders/{paymentIntentId}` — readable and creatable only by the
owning user, never updatable or deletable.

The document id is the Stripe PaymentIntent id, which makes the write idempotent
for free: a retry after a dropped response overwrites the same order rather than
creating a second one for a single charge.

Two schema versions exist in production data:

- **v1** — `{ basket: Product[], amount, created }`. No quantities, no tax, no
  shipping.
- **v2** — explicit lines with quantities, plus the full price breakdown and the
  tax rate and promo code that produced it, so a total can be audited later.

`orderService.normalizeOrder()` reads both and returns one shape. Rendering code
never branches on version.

## Infrastructure

Firebase is on the **Spark (free) plan**, which cannot deploy Cloud Functions.
The Stripe endpoint therefore lives in a Supabase Edge Function
(`supabase/functions/payments`), which holds the secret key. Everything else —
Hosting, Auth, Firestore — stays on Firebase.

`functions/` is kept for reference in case the project ever moves to Blaze. It
is not deployed, and it is not referenced from `firebase.json`.

## Testing

```
npm test              # watch mode
npm run test:ci       # single run, warnings fail
npm run lint
```

The domain layer carries most of the coverage because it is where the money is
and because pure functions are cheap to test exhaustively. `pricing.test.js`
includes invariant tests that hold across every scenario — total equals net plus
shipping plus tax, every figure is a whole number of cents — which catch a
reordered calculation that a single worked example would miss.

`Checkout.test.js` drives the real component tree and asserts on rendered
currency, so a break anywhere between the reducer and the DOM shows up.

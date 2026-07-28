# Amazon Clone

A React storefront with Firebase Authentication, Cloud Firestore, and Stripe card
payments. Live at <https://clone-72e22.web.app/>.

---

## Architecture

| Concern | Service | Plan |
| --- | --- | --- |
| Hosting | Firebase Hosting | Spark (free) |
| Sign-in / sign-up | Firebase Authentication | Spark (free) |
| Products + orders | Cloud Firestore | Spark (free) |
| Stripe PaymentIntents | **Supabase Edge Function** | Free tier |

### Why the payments endpoint is not a Firebase Cloud Function

It used to be (`functions/index.js`), but **deploying Cloud Functions requires the
paid Blaze plan** — the Firebase docs state that "to deploy functions, your project
must be on the Blaze pricing plan." This project runs on the free Spark plan, so the
old `https://us-central1-clone-72e22.cloudfunctions.net/api` endpoint returns 503 and
checkout was silently dead.

The endpoint now lives in `supabase/functions/payments/index.ts` and runs on
Supabase's free tier. `functions/` is kept, fixed and secret-free, so the Cloud
Function can be restored immediately if the project ever moves to Blaze.

---

## Setup

```bash
git clone <this repo>
cd Amazon-Clone
npm install
cp .env.example .env    # then fill in the values
npm start
```

`.npmrc` sets `legacy-peer-deps=true`. This is required: `react-currency-format@1.1.0`
declares a peer range of React ≤17 while this app runs React 18, so a plain
`npm install` fails with `ERESOLVE`.

### Environment variables

Fill `.env` from the Firebase console
(**Project settings → Your apps → SDK setup and configuration**):

| Variable | Notes |
| --- | --- |
| `REACT_APP_FIREBASE_*` | Web config. **Not secrets** — see below. |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | `pk_test_…`. Public by design. |
| `REACT_APP_PAYMENTS_API_URL` | URL of the deployed payments function. |

**On "hiding" the Firebase config:** the Firebase web config is *designed* to be
public and ships inside every client bundle — you can read it out of any deployed
Firebase app with `curl` and `grep`. Emptying it out of source does not add security;
it only breaks the build. Access is enforced by `firestore.rules`. The Stripe
**secret** key (`sk_…`) is the opposite: it must never appear in this repo.

---

## Firestore security rules

`firestore.rules` is the real access boundary:

- `products/{id}` — world-readable, client writes blocked.
- `users/{uid}/orders/{orderId}` — readable and creatable only by that signed-in
  user; immutable once written.
- everything else — denied.

Deploy them with:

```bash
firebase deploy --only firestore:rules
```

> The project originally used Firebase "test mode" rules, which **expire ~30 days
> after creation** and then deny every request. Once they lapsed, the homepage's read
> of `products` returned `PERMISSION_DENIED` and the product grid rendered empty with
> no visible error. The rules in this repo do not expire.

---

## Deploying

### Frontend (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

`firebase.json` intentionally has **no `functions` block**, so a plain
`firebase deploy` will not attempt a Cloud Functions deploy that Spark rejects.

### Payments endpoint (Supabase Edge Function)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase functions deploy payments
```

JWT verification is disabled for this function via `verify_jwt = false` under
`[functions.payments]` in `supabase/config.toml`. It is required because callers
authenticate with **Firebase** Auth, so there is no Supabase JWT to verify. Setting
it in config rather than passing `--no-verify-jwt` keeps local and deployed
behaviour identical.

Then set `REACT_APP_PAYMENTS_API_URL` to
`https://<your-project-ref>.supabase.co/functions/v1/payments` and rebuild.

---

## Seeding the product catalogue

`firestore.rules` blocks client writes to `products`, so add documents from the
Firebase console (or temporarily relax the rule while seeding). Each document needs:

```json
{
  "title": "Product name",
  "description": "Short description",
  "image": "/images/product1.jpg",
  "price": 29.99,
  "rating": 4
}
```

Field names matter — `Product.js` reads `title` and `image`. The old sample object in
`productService.js` used `name` and `imageUrl`, so seeded rows rendered blank.

---

## Test cards

Stripe test mode. Use any future expiry and any CVC.

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

---

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Dev server on <http://localhost:3000> |
| `npm run build` | Production build into `build/` |
| `npm test` | Test runner (watch mode) |

Bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
Note that `react-scripts` is no longer maintained; a future move to Vite is worth
considering.

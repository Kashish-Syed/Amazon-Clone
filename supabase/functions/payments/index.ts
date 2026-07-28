// Stripe PaymentIntent endpoint.
//
// This replaces the original Firebase Cloud Function (functions/index.js), which
// cannot be deployed on the Firebase Spark (free) plan - deploying Cloud Functions
// requires the paid Blaze plan. Supabase Edge Functions cover this on their free
// tier, so the app keeps Firebase for Auth/Firestore/Hosting and only the payment
// endpoint lives here.
//
// Deploy:
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase functions deploy payments
//
// JWT verification is disabled for this function in supabase/config.toml, because
// callers authenticate with Firebase Auth and so carry no Supabase JWT.

import Stripe from 'stripe';

// Stripe's smallest chargeable amount is 50 cents. The ceiling is a guard against
// an unauthenticated caller creating absurd PaymentIntents against the account.
const MIN_AMOUNT_CENTS = 50;
const MAX_AMOUNT_CENTS = 99_999_00;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed. Use POST.' }, 405);
  }

  if (!stripe) {
    // Misconfiguration should be an explicit server error, not a confusing
    // downstream Stripe failure.
    console.error('STRIPE_SECRET_KEY is not set on this function.');
    return json({ error: 'Payments are not configured on the server.' }, 500);
  }

  // The total arrives as a query param (?total=1234) to stay compatible with the
  // original Cloud Function's contract; a JSON body is accepted as well.
  const url = new URL(request.url);
  let rawTotal: string | number | null = url.searchParams.get('total');

  if (rawTotal === null) {
    const body = await request.json().catch(() => ({}));
    rawTotal = body?.total ?? null;
  }

  const total = Number(rawTotal);

  if (!Number.isInteger(total)) {
    return json(
      { error: '`total` must be an integer number of cents (e.g. 1000 for $10.00).' },
      400
    );
  }

  if (total < MIN_AMOUNT_CENTS || total > MAX_AMOUNT_CENTS) {
    return json(
      { error: `\`total\` must be between ${MIN_AMOUNT_CENTS} and ${MAX_AMOUNT_CENTS} cents.` },
      400
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });

    // Never log the client secret - it authorises the charge.
    console.log('PaymentIntent created', { id: paymentIntent.id, amount: total });

    return json({ clientSecret: paymentIntent.client_secret }, 201);
  } catch (error) {
    // Never leak the raw Stripe error to the browser - it can echo account detail.
    console.error('Stripe paymentIntents.create failed:', error);
    return json({ error: 'Could not create the payment. Please try again.' }, 502);
  }
});

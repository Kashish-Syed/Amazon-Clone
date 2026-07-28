/**
 * Stripe PaymentIntent API as a Firebase Cloud Function.
 *
 * IMPORTANT: deploying Cloud Functions requires the paid Blaze plan. This project
 * is on the free Spark plan, so this function is NOT deployed - the live endpoint
 * returns 503. The active implementation lives in supabase/functions/payments,
 * which runs on Supabase's free tier. This file is kept so the function can be
 * restored immediately if the project ever moves to Blaze.
 *
 * To use it: re-add the "functions" block to firebase.json, then
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 *   firebase deploy --only functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const express = require("express");
const cors = require("cors");

// The secret key is resolved from Secret Manager at runtime. It was previously
// hardcoded in this file and committed to git - never do that. The old key
// (sk_test_51QCRss...) is in the repository history and must be rotated.
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

// Stripe's smallest chargeable amount is 50 cents. The ceiling guards against an
// unauthenticated caller creating absurd PaymentIntents against the account.
const MIN_AMOUNT_CENTS = 50;
const MAX_AMOUNT_CENTS = 9999900;

// - App Config

const app = express();

// - Middlewares

app.use(cors({origin: true}));
app.use(express.json());

// - API Routes

app.get("/", (request, response) => {
  response.status(200).send("Hello World");
});

app.post("/payments/create", async (request, response) => {
  // Constructed per-request: defineSecret values are only readable at runtime,
  // not at module load.
  const stripe = require("stripe")(stripeSecretKey.value());

  const total = Number(request.query.total ?? request.body?.total);

  if (!Number.isInteger(total)) {
    return response.status(400).send({
      error: "`total` must be an integer number of cents (e.g. 1000 for $10.00).",
    });
  }

  if (total < MIN_AMOUNT_CENTS || total > MAX_AMOUNT_CENTS) {
    return response.status(400).send({
      error: `\`total\` must be between ${MIN_AMOUNT_CENTS} and ${MAX_AMOUNT_CENTS} cents.`,
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: "usd",
      automatic_payment_methods: {enabled: true},
    });

    logger.info("PaymentIntent created", {id: paymentIntent.id, amount: total});

    // Never log the client secret - it authorises the charge.
    return response.status(201).send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    logger.error("Stripe paymentIntents.create failed", error);
    return response.status(502).send({
      error: "Could not create the payment. Please try again.",
    });
  }
});

// - List command
exports.api = onRequest({secrets: [stripeSecretKey]}, app);

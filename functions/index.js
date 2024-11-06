/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

require("dotenv").config();

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const functions = require('firebase-functions');
const stripe = require("stripe")('ADD_THE_SECRET_KEY');

// API

// - App Config

const app = express();

// - Middlewares

app.use(cors({origin: true}));
app.use(express.json());

logger.info("Server is starting...");

// - API Routes

app.get("/", (request, response) => {
  logger.info("Root route accessed");
  response.status(200).send("Hello World");
});

app.post("/payments/create", async (request, response) => {
  const total = request.query.total;
  logger.info("Payment request received", {total});
  console.log("Payment Recieved!! >>>", total);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: total,
    currency: "usd",
  });

  logger.info("Payment Intent created successfully", {
    clientSecret: paymentIntent.client_secret,
  });

  response.status(201).send({
    clientSecret: paymentIntent.client_secret,
  });
});

// - List command
exports.api = functions.https.onRequest(app)

import axios from "axios";

// Where the Stripe PaymentIntent endpoint lives.
//
// This used to be hardcoded to a Firebase Cloud Function, but Cloud Functions
// require the paid Blaze plan and this project is on Spark (free), so the
// deployed function returns 503. The URL is now configurable via .env and
// defaults to a local Supabase Edge Function for development.
// See supabase/functions/payments/index.ts.
const baseURL =
    process.env.REACT_APP_PAYMENTS_API_URL ||
    'http://127.0.0.1:54321/functions/v1/payments';

const instance = axios.create({ baseURL });

export default instance;

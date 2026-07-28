// HTTP client for our own backend (the Supabase Edge Function that talks to
// Stripe). Firestore has its own SDK and does not go through here.
//
// This replaces src/components/js/axios.js, which was a bare axios.create with
// a hardcoded URL. Beyond moving the URL into config, the interceptors below
// exist so a failed request leaves a trace: every call gets a correlation id,
// a duration, and a log line on the way out - whether it succeeded or not.

import axios from 'axios';
import { config } from '../config';
import { logger, newCorrelationId, serializeError } from './logger';

export const httpClient = axios.create({
  baseURL: config.payments.apiUrl,
  timeout: config.payments.timeoutMs,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((request) => {
  // Reuse a correlation id supplied by the caller so a whole checkout attempt
  // shares one, and mint a fresh one otherwise.
  const correlationId = request.headers['X-Correlation-Id'] || newCorrelationId();

  request.headers['X-Correlation-Id'] = correlationId;
  request.metadata = { correlationId, startedAt: Date.now() };

  logger.debug('http.request', {
    correlationId,
    method: request.method?.toUpperCase(),
    url: request.url || '/',
  });

  return request;
});

httpClient.interceptors.response.use(
  (response) => {
    const { correlationId, startedAt } = response.config.metadata ?? {};

    logger.info('http.response', {
      correlationId,
      status: response.status,
      durationMs: startedAt ? Date.now() - startedAt : undefined,
    });

    return response;
  },
  (error) => {
    const { correlationId, startedAt } = error.config?.metadata ?? {};

    logger.error('http.failed', {
      correlationId,
      status: error.response?.status,
      durationMs: startedAt ? Date.now() - startedAt : undefined,
      // A timeout has no response at all, which is worth distinguishing from a
      // 500 when you are working out whether the backend is down or just slow.
      timedOut: error.code === 'ECONNABORTED',
      error: serializeError(error),
    });

    return Promise.reject(error);
  }
);

export default httpClient;

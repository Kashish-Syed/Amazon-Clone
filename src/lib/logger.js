// Structured logging.
//
// Scattered console.log('error', err) calls are useless once something goes
// wrong in a browser you do not control: no timestamp, no level, no way to tell
// which of five in-flight requests a line belongs to, and nothing to search.
//
// This module emits one object per event with a stable shape:
//
//   { ts, level, event, correlationId, ...fields }
//
// `event` is a short dotted name (products.fetch.failed), not a sentence, so
// occurrences can be counted and compared across sessions. Free text goes in
// the fields.
//
// Entries are also kept in an in-memory ring buffer. In the browser console,
// `__APP_LOGS__()` dumps recent activity - useful when a user reports something
// odd and the console has already been cleared by a navigation.

import { config } from '../config';

export const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const CONSOLE_METHOD = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

function resolveThreshold(name) {
  return LEVELS[name] ?? LEVELS.debug;
}

let threshold = resolveThreshold(config.logging.level);

/** Ring buffer of recent entries. Oldest is dropped once it is full. */
const buffer = [];
const bufferLimit = Math.max(0, config.logging.bufferSize);

/**
 * Generate a short id used to tie together the log lines belonging to one
 * logical operation - a checkout attempt, a product fetch, a page load.
 *
 * We send it to the payments API as an X-Correlation-Id header, so a line here
 * and a line in the Supabase function log can be matched up.
 *
 * @returns {string}
 */
export function newCorrelationId() {
  // crypto.randomUUID is unavailable in older Safari and in some test
  // environments, so fall back to a random suffix rather than crashing.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

/**
 * Serialise an Error into something that survives JSON.stringify.
 * Plain spreading an Error yields {} because name/message/stack are not
 * enumerable, which is how real causes get lost.
 *
 * @param {unknown} error
 * @returns {object|undefined}
 */
export function serializeError(error) {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Firebase and Axios both hang useful codes off the error object.
      code: error.code,
      status: error.response?.status,
    };
  }

  return { message: String(error) };
}

function emit(level, event, fields, bindings) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...bindings,
    ...fields,
  };

  if (bufferLimit > 0) {
    buffer.push(entry);
    if (buffer.length > bufferLimit) buffer.shift();
  }

  if (LEVELS[level] <= threshold) return entry;

  const method = CONSOLE_METHOD[level] ?? 'log';
  const { event: name, ...rest } = entry;

  // eslint-disable-next-line no-console
  console[method](`[${level}] ${name}`, rest);

  return entry;
}

function build(bindings) {
  const log = {
    debug: (event, fields) => emit('debug', event, fields, bindings),
    info: (event, fields) => emit('info', event, fields, bindings),
    warn: (event, fields) => emit('warn', event, fields, bindings),
    error: (event, fields) => emit('error', event, fields, bindings),

    /**
     * Derive a logger that stamps every entry with extra context, so callers
     * do not have to remember to pass correlationId on each line.
     *
     * @param {object} extra
     */
    child: (extra) => build({ ...bindings, ...extra }),
  };

  return log;
}

export const logger = build({});

/**
 * Snapshot of recent entries, oldest first.
 * @returns {object[]}
 */
export function getRecentLogs() {
  return buffer.slice();
}

/** Empty the ring buffer. Used between tests. */
export function clearLogs() {
  buffer.length = 0;
}

/**
 * Change the minimum level at run time. Lets you turn on debug output in a
 * deployed build from the console without a rebuild.
 *
 * @param {keyof LEVELS} level
 */
export function setLogLevel(level) {
  threshold = resolveThreshold(level);
}

// Expose a console handle outside of tests.
if (typeof window !== 'undefined' && config.environment !== 'test') {
  window.__APP_LOGS__ = getRecentLogs;
  window.__APP_SET_LOG_LEVEL__ = setLogLevel;
}

export default logger;

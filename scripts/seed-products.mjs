#!/usr/bin/env node
//
// Seed the Firestore `products` collection from scripts/products.seed.json.
//
// WHY THIS EXISTS
// The catalogue was originally populated by hand through the Firebase console,
// which is how it ended up with prices stored as strings on some documents and
// as numbers on others, and with no stock field at all. Seeding from a checked-in
// file makes the catalogue reproducible: anyone cloning the repo can populate a
// fresh project, and the shape is reviewed in a pull request like any other code.
//
// DOCUMENT IDS
// Each product's `slug` becomes its document id, so re-running the script
// updates the existing rows instead of creating duplicates. The original
// documents used random auto-ids; if you are seeding over the top of those,
// run with --prune to remove the leftovers.
//
// WRITES ARE BLOCKED BY DEFAULT
// firestore.rules denies all client writes to `products`, which is the right
// posture for a public catalogue. To seed you must temporarily allow writes for
// one specific account:
//
//   match /products/{productId} {
//     allow read: if true;
//     allow write: if request.auth != null && request.auth.uid == 'THE_SEED_UID';
//   }
//
// Deploy that (`firebase deploy --only firestore:rules`), run this script, then
// restore `allow write: if false` and deploy again. Leaving the seed rule in
// place means anyone who obtains that account can rewrite your prices.
//
// USAGE
//   FIREBASE_SEED_EMAIL=... FIREBASE_SEED_PASSWORD=... npm run seed:products
//   ... npm run seed:products -- --apply
//   ... npm run seed:products -- --apply --prune
//
// Without --apply the script only reports what it would change.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(here, '..');

/**
 * Read .env into process.env without pulling in a dependency.
 * Existing environment variables win, so a real export can override the file.
 */
function loadDotEnv() {
  const file = path.join(projectRoot, '.env');

  if (!fs.existsSync(file)) return;

  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');

    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');

    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const API_KEY = process.env.REACT_APP_FIREBASE_API_KEY;
const PROJECT_ID = process.env.REACT_APP_FIREBASE_PROJECT_ID;
const EMAIL = process.env.FIREBASE_SEED_EMAIL;
const PASSWORD = process.env.FIREBASE_SEED_PASSWORD;

const apply = process.argv.includes('--apply');
const prune = process.argv.includes('--prune');

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/products`;

/** Convert a seed entry into the Firestore REST `fields` representation. */
function toFirestoreFields(product) {
  return {
    title: { stringValue: product.title },
    description: { stringValue: product.description },
    image: { stringValue: product.image },
    // price and rating are doubles everywhere. A collection that mixes a
    // string "24.99" with a number 24.99 is what made the cart total
    // concatenate instead of add.
    price: { doubleValue: product.price },
    rating: { doubleValue: product.rating },
    // Stock is a whole count. The REST API takes integers as strings.
    stock: { integerValue: String(product.stock) },
  };
}

async function signIn() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
    }
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Sign-in failed: ${body.error?.message ?? response.status}`);
  }

  return { idToken: body.idToken, uid: body.localId };
}

async function listExistingIds(idToken) {
  const ids = [];
  let pageToken;

  do {
    const url = new URL(FIRESTORE_BASE);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Could not list products: ${body.error?.message ?? response.status}`);
    }

    for (const document of body.documents ?? []) {
      ids.push(document.name.split('/').pop());
    }

    pageToken = body.nextPageToken;
  } while (pageToken);

  return ids;
}

async function upsert(idToken, product) {
  const response = await fetch(`${FIRESTORE_BASE}/${product.slug}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(product) }),
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(`${product.slug}: ${body.error?.message ?? response.status}`);
  }
}

async function remove(idToken, id) {
  const response = await fetch(`${FIRESTORE_BASE}/${id}?key=${API_KEY}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(`delete ${id}: ${body.error?.message ?? response.status}`);
  }
}

function requireEnv() {
  const missing = [
    ['REACT_APP_FIREBASE_API_KEY', API_KEY],
    ['REACT_APP_FIREBASE_PROJECT_ID', PROJECT_ID],
    ['FIREBASE_SEED_EMAIL', EMAIL],
    ['FIREBASE_SEED_PASSWORD', PASSWORD],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}.\n` +
        'The Firebase values come from .env; the seed credentials are a Firebase Auth ' +
        'account you have temporarily granted write access in firestore.rules.'
    );
  }
}

async function main() {
  requireEnv();

  const products = JSON.parse(
    fs.readFileSync(path.join(here, 'products.seed.json'), 'utf8')
  );

  const slugs = products.map((product) => product.slug);
  const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);

  if (duplicates.length > 0) {
    throw new Error(`Duplicate slugs in the seed file: ${duplicates.join(', ')}`);
  }

  const { idToken, uid } = await signIn();
  console.log(`Signed in as ${EMAIL} (uid ${uid})`);

  const existing = await listExistingIds(idToken);
  const stale = existing.filter((id) => !slugs.includes(id));

  console.log(`Seed file: ${products.length} products`);
  console.log(`Collection: ${existing.length} documents`);
  console.log(`Not in the seed file: ${stale.length}${stale.length ? ` (${stale.join(', ')})` : ''}`);

  if (!apply) {
    console.log('\nDry run. Nothing was written. Re-run with --apply to make changes.');
    if (stale.length > 0) console.log('Add --prune to also delete the documents listed above.');
    return;
  }

  let written = 0;

  for (const product of products) {
    await upsert(idToken, product);
    written += 1;
    console.log(`  wrote ${product.slug}`);
  }

  let deleted = 0;

  if (prune) {
    for (const id of stale) {
      await remove(idToken, id);
      deleted += 1;
      console.log(`  deleted ${id}`);
    }
  }

  console.log(`\nDone: ${written} written, ${deleted} deleted.`);
  console.log('Remember to restore `allow write: if false` in firestore.rules and redeploy.');
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});

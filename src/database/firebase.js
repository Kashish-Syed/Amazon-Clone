import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { assertFirebaseConfigured, config } from '../config';

// SDK bootstrap only. No queries live here - reads and writes go through
// src/services/*, so this module stays a single, boring initialisation step.
//
// NOTE: none of these values are secrets. The Firebase web config is designed to
// ship inside the client bundle - anyone can read it out of the deployed JS.
// Access is enforced by Firestore security rules (see firestore.rules), not by
// hiding these strings. They live in .env only so they are easy to swap per project.
//
// Cloud Storage is deliberately NOT initialised: this project is on the Spark
// (free) plan, where Storage is not provisioned for new buckets.

// Fail loudly at startup rather than producing a silently dead app. This is the
// exact failure that took the site down: the config was emptied to `{}`, and every
// Firebase call then failed at runtime with no obvious cause.
//
// Only apiKey, authDomain, projectId and appId are required. storageBucket,
// messagingSenderId and measurementId are optional - Auth and Firestore work
// without them, and demanding them made a perfectly usable config look broken.
assertFirebaseConfigured();

const firebaseApp = initializeApp(config.firebase);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp); // firestore is real-time firebase database

export { auth, db, firebaseApp };

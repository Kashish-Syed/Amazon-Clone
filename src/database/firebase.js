import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// NOTE: none of these values are secrets. The Firebase web config is designed to
// ship inside the client bundle - anyone can read it out of the deployed JS.
// Access is enforced by Firestore security rules (see firestore.rules), not by
// hiding these strings. They live in .env only so they are easy to swap per project.
//
// Cloud Storage is deliberately NOT initialised here: this project is on the Spark
// (free) plan, where Storage is not provisioned for new buckets.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

// Fail loudly at startup rather than producing a silently dead app. This is the
// exact failure that took the site down: the config was emptied to `{}`, and every
// Firebase call then failed at runtime with no obvious cause.
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Firebase config is incomplete - missing: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in the values from the Firebase console ' +
      '(Project settings > Your apps > SDK setup and configuration).'
  );
}

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp); // firestore is real-time firebase database

export { auth, db };

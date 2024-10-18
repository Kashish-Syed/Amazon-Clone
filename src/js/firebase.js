import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCgmvujrv-YAGP0mp2hoPL_G7kqs2ZEZag",
    authDomain: "clone-72e22.firebaseapp.com",
    projectId: "clone-72e22",
    storageBucket: "clone-72e22.appspot.com",
    messagingSenderId: "406616709165",
    appId: "1:406616709165:web:550a94be1221f30daec0a4",
    measurementId: "G-ETF4ZS6MCQ"
  };

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp); // firestore is real-time firebase database

export { auth, db };

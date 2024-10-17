import firebase from 'firebase';
import { initializeApp } from 'firebase';

const firebaseConfig = {
    apiKey: "AIzaSyCgmvujrv-YAGP0mp2hoPL_G7kqs2ZEZag",
    authDomain: "clone-72e22.firebaseapp.com",
    projectId: "clone-72e22",
    storageBucket: "clone-72e22.appspot.com",
    messagingSenderId: "406616709165",
    appId: "1:406616709165:web:550a94be1221f30daec0a4",
    measurementId: "G-ETF4ZS6MCQ"
  };

const firebaseApp = firebase.initializeApp(firebaseConfig);

const db = firebaseApp.firestore(); // firestore is real-time firebase database
const auth = firebase.auth();

export { db, auth };

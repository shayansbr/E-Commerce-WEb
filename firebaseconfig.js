// ============================================================
// FIREBASE CONFIGURATION
// ------------------------------------------------------------
// 1. Go to https://console.firebase.google.com
// 2. Create a project → Add a Web App → copy the config object
// 3. Paste your real values below (never commit real keys to a
//    public repo without restricting them in the Firebase console)
// 4. In the Firebase console, enable:
//      Authentication → Sign-in method → Email/Password + Google
//      Firestore Database → Create database (start in test mode
//        for development, then lock down rules before launch)
//      Storage → Get started
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

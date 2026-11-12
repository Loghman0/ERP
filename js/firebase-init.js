/* ============ FIREBASE INIT (Məram) ============ */
/* Konfiqurasiya js/config.js faylındadır. */
const firebaseConfig = window.MERAM_CONFIG.firebase;
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
// Used to call the deployed Cloud Functions (functions/src/): geminiProxy,
// setUserActive, deleteUserAccount. Region left as the default (us-central1)
// to match how the functions are deployed in functions/src/index.js — if
// that ever changes to a specific region, pass it here too:
// firebase.app().functions('europe-west1').
const fns = firebase.functions();

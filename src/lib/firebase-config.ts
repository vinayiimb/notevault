// Firebase web config for "Sign in with Google" (Firebase console → Project
// settings → Your apps → Web app). These values are public by design — they
// ship in the browser bundle; sign-ins are verified server-side in
// src/lib/firebase-token.ts. Leave apiKey empty to hide Google sign-in.
export const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};

export const googleSignInEnabled = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

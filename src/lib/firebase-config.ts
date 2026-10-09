// Firebase web config for "Sign in with Google" (Firebase console → Project
// settings → Your apps → Web app). These values are public by design — they
// ship in the browser bundle; sign-ins are verified server-side in
// src/lib/firebase-token.ts. Leave apiKey empty to hide Google sign-in.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB8Rw1y6T32LcYgLV9gqzQ9wq4AirbI2Ds", // gitleaks:allow — Firebase web key is public by design
  authDomain: "dupyqonline.firebaseapp.com",
  projectId: "dupyqonline",
  appId: "1:285502274473:web:7bc34664bc3972c89b22b8",
};

export const googleSignInEnabled = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

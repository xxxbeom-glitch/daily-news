/**
 * Firebase 초기화
 * Firestore + Anonymous Auth
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function getConfig() {
  const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string)?.trim();
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string)?.trim();
  const appId = (import.meta.env.VITE_FIREBASE_APP_ID as string)?.trim();
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.appspot.com`,
    messagingSenderId: "000000000000",
    appId,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function initFirebase(): { auth: Auth; db: Firestore } | null {
  if (app) return { auth: auth!, db: db! };
  const config = getConfig();
  if (!config) return null;
  if (getApps().length > 0) {
    app = getApps()[0] as FirebaseApp;
  } else {
    app = initializeApp(config);
  }
  auth = getAuth(app);
  db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  return { auth, db };
}

export function getFirebaseAuth(): Auth | null {
  return auth;
}

export function getFirebaseDb(): Firestore | null {
  return db;
}

export function isFirebaseEnabled(): boolean {
  return getConfig() != null;
}

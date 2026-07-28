import { initializeApp, getApps } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { ERRORS } from './errors.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export const firebaseReady = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp = firebaseReady ? getApps()[0] ?? initializeApp(firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;

if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => undefined);
}

export const firebaseMissingMessage = ERRORS.firebaseMissing;

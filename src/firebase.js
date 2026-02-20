import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// Only initialize Firebase if config is present
// This prevents the app from crashing when .env is not yet configured
let app = null;
let auth = null;

if (apiKey) {
    const firebaseConfig = {
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
}

export { auth };
export const isFirebaseConfigured = !!apiKey;
export default app;

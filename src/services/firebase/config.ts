import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyAV6spTj7ssqy9XfyTSTD-Jx2jx7ojeAH4',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'loctag-p84-p85.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'loctag-p84-p85',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'loctag-p84-p85.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '495538846299',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ?? '1:495538846299:web:088fcc2cec2de71d2a5d7e',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

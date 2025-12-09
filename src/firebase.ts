import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInAnonymously } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase configuration - Replace with your actual config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Check if Firebase is properly configured
const isFirebaseConfigured = 
  firebaseConfig.apiKey !== "your-api-key" &&
  firebaseConfig.projectId !== "your-project-id";

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  if (isFirebaseConfigured) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Initialize Firestore with the named database "christmas-metaphor"
    db = getFirestore(app, 'christmas-metaphor');
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export { auth, db, isFirebaseConfigured };

// Anonymous auth helper
export const signInAnonymouslyUser = async () => {
  if (!auth) {
    throw new Error('Firebase is not configured. Please set up your Firebase credentials in .env file');
  }
  const userCredential = await signInAnonymously(auth);
  return userCredential.user;
};


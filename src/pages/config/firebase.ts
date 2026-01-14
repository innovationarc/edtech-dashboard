// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBbAvX__6Yk7h0FR3mFsYw9jx_K6Rcbdr4",
  authDomain: "smart-study-ffa8e.firebaseapp.com",
  projectId: "smart-study-ffa8e",
  storageBucket: "smart-study-ffa8e.firebasestorage.app",
  messagingSenderId: "343513057419",
  appId: "1:343513057419:web:b353dc8dd3fe7334b4ac8e",
  measurementId: "G-HZNR8VH2H9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export the initialized services
export {   auth, db, storage };

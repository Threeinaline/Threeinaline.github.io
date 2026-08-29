import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBDJiyNYOO-ippD9uIUhS0QJdzgEHSrJTQ",
  authDomain: "subtle-asset-rdzmz.firebaseapp.com",
  projectId: "subtle-asset-rdzmz",
  storageBucket: "subtle-asset-rdzmz.firebasestorage.app",
  messagingSenderId: "86409363950",
  appId: "1:86409363950:web:2bf1effe35f913fbf68eff"
};

const databaseId = "ai-studio-f4d8a2dd-fa32-45fb-a033-8ab9125dc0eb";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, databaseId);
const auth = getAuth(app);

export { app, db, auth };

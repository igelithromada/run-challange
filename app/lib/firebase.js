import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDN2XshsRKpD54i2Q98xwCzcHiQUs3gvSU",
  authDomain: "dolni-lhota-run.firebaseapp.com",
  projectId: "dolni-lhota-run",
  storageBucket: "dolni-lhota-run.firebasestorage.app",
  messagingSenderId: "549134031482",
  appId: "1:549134031482:web:41205785ed5b4e275a79c3",
  measurementId: "G-E7N1HJ4BEZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);  // <-- přidáno pro obrázky
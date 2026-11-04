import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDN2XshsRKpD54i2Q98xwCzcHiQUs3gvSU",
  authDomain: "dolni-lhota-run.firebaseapp.com",
  projectId: "dolni-lhota-run",
  storageBucket: "dolni-lhota-run.appspot.com",  // ✅ správně
  messagingSenderId: "549134031482",
  appId: "1:549134031482:web:41205785ed5b4e275a79c3",
  measurementId: "G-E7N1HJ4BEZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Offline cache: po prvním načtení jsou data při dalších návštěvách dostupná okamžitě z IndexedDB.
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((error) => {
    if (error.code !== "failed-precondition" && error.code !== "unimplemented") {
      console.warn("Lokální cache Firestore není dostupná:", error);
    }
  });
}
export const storage = getStorage(app);
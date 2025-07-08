import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config tvůj:
const firebaseConfig = {
  apiKey: "AIzaSyDN2XshsRKpD54i2Q98xwCzcHiQUs3gvSU",
  authDomain: "dolni-lhota-run.firebaseapp.com",
  projectId: "dolni-lhota-run",
  storageBucket: "dolni-lhota-run.firebasestorage.app",
  messagingSenderId: "549134031482",
  appId: "1:549134031482:web:41205785ed5b4e275a79c3",
  measurementId: "G-E7N1HJ4BEZ"
};

// Inicializace Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Elementy
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const authMessage = document.getElementById("auth-message");
const authSection = document.getElementById("auth-section");
const welcomeSection = document.getElementById("welcome-section");
const userEmailSpan = document.getElementById("user-email");

// Přihlášení
loginBtn.addEventListener("click", async () => {
  authMessage.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
  } catch (error) {
    authMessage.textContent = "Chyba přihlášení: " + error.message;
  }
});

// Odhlášení
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Sleduj změny přihlášení
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Přihlášený
    userEmailSpan.textContent = user.email;
    authSection.style.display = "none";
    welcomeSection.style.display = "block";
  } else {
    // Odhlášený
    loginEmail.value = "";
    loginPassword.value = "";
    authSection.style.display = "block";
    welcomeSection.style.display = "none";
  }
});

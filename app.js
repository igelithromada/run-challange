import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config - nahraď svými údaji
const firebaseConfig = {
  apiKey: "TADY_TVŮJ_API_KEY",
  authDomain: "TADY_TVŮJ_AUTH_DOMAIN",
  projectId: "TADY_TVŮJ_PROJECT_ID",
  storageBucket: "TADY_TVŮJ_STORAGE_BUCKET",
  messagingSenderId: "TADY_TVŮJ_SENDER_ID",
  appId: "TADY_TVŮJ_APP_ID"
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

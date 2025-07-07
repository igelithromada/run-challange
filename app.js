import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDN2XshsRKpD54i2Q98xwCzcHiQUs3gvSU",
  authDomain: "dolni-lhota-run.firebaseapp.com",
  projectId: "dolni-lhota-run",
  storageBucket: "dolni-lhota-run.appspot.com",
  messagingSenderId: "549134031482",
  appId: "1:549134031482:web:41205785ed5b4e275a79c3",
  measurementId: "G-E7N1HJ4BEZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const hamburger = document.getElementById('hamburger');
const sidePanel = document.getElementById('sidePanel');
const closePanel = document.getElementById('closePanel');
const userNickEl = document.getElementById('userNick');
const userTeamEl = document.getElementById('userTeam');
const mainContent = document.getElementById('mainContent');

hamburger.addEventListener('click', () => {
  sidePanel.classList.add('open');
  sidePanel.setAttribute('aria-hidden', 'false');
});

closePanel.addEventListener('click', () => {
  sidePanel.classList.remove('open');
  sidePanel.setAttribute('aria-hidden', 'true');
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await signOut(auth);
});

let currentUser = null;

function calculatePace(min, km) {
  if (!km || km === 0) return '-';
  return (min / km).toFixed(2);
}

function formatNumber(num) {
  return Number.parseFloat(num).toFixed(2);
}

async function renderDashboard() {
  mainContent.innerHTML = `
    <h2>Hlavní stránka</h2>
    <p>Souhrn běhů všech uživatelů:</p>
    <table>
      <thead>
        <tr><th>Pořadí</th><th>Uživatel</th><th>Celkem km</th><th>Celkem min</th><th>Průměr min/km</th></tr>
      </thead>
      <tbody id="dashboardBody">
        <tr><td colspan="5">Načítám...</td></tr>
      </tbody>
    </table>
    <div class="input-group">
      <label for="inputKm">Kilometry (km)</label>
      <input type="number" id="inputKm" min="0" step="0.01" />
    </div>
    <div class="input-group">
      <label for="inputMin">Čas (minuty)</label>
      <input type="number" id="inputMin" min="0" />
    </div>
    <button id="addRunBtn">Přidat nový běh</button>
    <div id="addRunMessage"></div>
  `;

  const dashboardBody = document.getElementById('dashboardBody');
  const addRunBtn = document.getElementById('addRunBtn');
  const inputKm = document.getElementById('inputKm');
  const inputMin = document.getElementById('inputMin');
  const addRunMessage = document.getElementById('addRunMessage');

  const runsSnapshot = await getDocs(collection(db, 'runs'));
  const usersStats = {};

  runsSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (!usersStats[data.userId]) {
      usersStats[data.userId] = { km: 0, min: 0 };
    }
    usersStats[data.userId].km += data.km;
    usersStats[data.userId].min +=

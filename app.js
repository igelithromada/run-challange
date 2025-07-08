import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy
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
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (e) {
    alert('Chyba při odhlášení: ' + e.message);
  }
});

let currentUser = null;

function formatNumber(num) {
  return Number.parseFloat(num).toFixed(2);
}

function calculatePace(min, km) {
  if (!km || km === 0) return '-';
  return (min / km).toFixed(2);
}

async function renderDashboard() {
  mainContent.innerHTML = `
    <h2>Hlavní stránka</h2>
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

  document.getElementById('addRunBtn').onclick = async () => {
    const km = parseFloat(document.getElementById('inputKm').value);
    const min = parseInt(document.getElementById('inputMin').value);
    const message = document.getElementById('addRunMessage');
    message.textContent = '';
    message.className = '';

    if (!km || !min) {
      message.textContent = 'Vyplň prosím km i čas správně.';
      message.className = 'alert error';
      return;
    }
    try {
      await addDoc(collection(db, 'runs'), {
        userId: currentUser.uid,
        km,
        min,
        timestamp: Date.now()
      });
      message.textContent = 'Běh přidán!';
      message.className = 'alert success';
      document.getElementById('inputKm').value = '';
      document.getElementById('inputMin').value = '';
    } catch (e) {
      message.textContent = 'Chyba při přidání běhu.';
      message.className = 'alert error';
    }
  };
}

async function renderMyRuns() {
  mainContent.innerHTML = '<h2>Moje běhy</h2><ul id="myRunsList">Načítám...</ul>';
  const myRunsList = document.getElementById('myRunsList');

  const runsQuery = query(collection(db, 'runs'), where('userId', '==', currentUser.uid), orderBy('timestamp', 'desc'));
  const runsSnapshot = await getDocs(runsQuery);

  myRunsList.innerHTML = '';

  let totalKm = 0;
  let totalMin = 0;

  runsSnapshot.forEach(docSnap => {
    const run = docSnap.data();
    totalKm += run.km;
    totalMin += run.min;

    const li = document.createElement('li');
    li.textContent = `${formatNumber(run.km)} km, ${run.min} min, tempo: ${calculatePace(run.min, run.km)} min/km`;
    myRunsList.appendChild(li);
  });

  if (runsSnapshot.empty) {
    myRunsList.textContent = 'Nemáš zatím žádné běhy.';
  } else {
    const summary = document.createElement('p');
    summary.style.fontWeight = 'bold';
    summary.style.marginTop = '15px';
    summary.textContent = `Celkem: ${formatNumber(totalKm)} km, ${Math.round(totalMin)} minut, průměrné tempo: ${calculatePace(totalMin, totalKm)} min/km`;
    mainContent.appendChild(summary);
  }
}

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    currentUser = user;
    userNickEl.textContent = user.email;
    userTeamEl.textContent = 'Tým: žádný'; // přidání týmů později
    renderDashboard();
  }
});

document.getElementById('btnDashboard').addEventListener('click', () => {
  renderDashboard();
  sidePanel.classList.remove('open');
  sidePanel.setAttribute('aria-hidden', 'true');
});

document.getElementById('btnMyRuns').addEventListener('click', () => {
  renderMyRuns();
  sidePanel.classList.remove('open');
  sidePanel.setAttribute('aria-hidden', 'true');
});

document.getElementById('btnSettings').addEventListener('click', () => {
  mainContent.innerHTML = '<h2>Nastavení</h2><p>Zatím žádné nastavení.</p>';
  sidePanel.classList.remove('open');
  sidePanel.setAttribute('aria-hidden', 'true');
});

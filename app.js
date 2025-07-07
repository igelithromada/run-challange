import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  updateProfile
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
  updateDoc
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
const mainContent = document.getElementById('mainContent');

hamburger.addEventListener('click', () => {
  sidePanel.classList.remove('hidden');
  sidePanel.setAttribute('aria-hidden', 'false');
});

closePanel.addEventListener('click', () => {
  sidePanel.classList.add('hidden');
  sidePanel.setAttribute('aria-hidden', 'true');
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await signOut(auth);
});

let currentUser = null;

// Výpočet tempa min/km
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
    <table border="1" style="border-collapse: collapse; width: 100%; max-width: 600px;">
      <thead>
        <tr>
          <th>Uživatel</th>
          <th>Celkem km</th>
          <th>Celkem min</th>
          <th>Průměr min/km</th>
        </tr>
      </thead>
      <tbody id="dashboardBody">
        <tr><td colspan="4">Načítám...</td></tr>
      </tbody>
    </table>
  `;
  const dashboardBody = document.getElementById('dashboardBody');

  // Načteme všechny běhy a sečteme podle uživatele
  const runsSnapshot = await getDocs(collection(db, 'runs'));
  const usersStats = {};

  runsSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (!usersStats[data.userId]) {
      usersStats[data.userId] = { km: 0, min: 0 };
    }
    usersStats[data.userId].km += data.km;
    usersStats[data.userId].min += data.min;
  });

  // Načteme uživatelská data
  const userIds = Object.keys(usersStats);
  if (userIds.length === 0) {
    dashboardBody.innerHTML = '<tr><td colspan="4">Žádné záznamy</td></tr>';
    return;
  }
  const usersQuery = query(collection(db, 'users'), where('__name__', 'in', userIds));
  const usersSnapshot = await getDocs(usersQuery);
  const usersData = {};
  usersSnapshot.forEach(u => usersData[u.id] = u.data());

  // Sestavíme řádky tabulky
  dashboardBody.innerHTML = '';
  userIds.forEach(userId => {
    const user = usersData[userId];
    const stat = usersStats[userId];
    const nickname = user?.nickname || user?.email || 'Neznámý';
    const pace = calculatePace(stat.min, stat.km);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${nickname}</td>
      <td>${formatNumber(stat.km)}</td>
      <td>${Math.round(stat.min)}</td>
      <td>${pace}</td>
    `;
    dashboardBody.appendChild(row);
  });
}

async function renderMyRuns() {
  mainContent.innerHTML = `
    <h2>Moje běhy</h2>
    <ul id="myRunsList">Načítám...</ul>
  `;
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
async function renderSettings() {
  mainContent.innerHTML = `
    <h2>Nastavení</h2>
    <label for="nicknameInput">Změna přezdívky:</label>
    <input type="text" id="nicknameInput" placeholder="Zadej novou přezdívku" />
    <button id="saveNicknameBtn">Uložit přezdívku</button>
    <p id="settingsMessage"></p>
  `;

  const nicknameInput = document.getElementById('nicknameInput');
  const saveBtn = document.getElementById('saveNicknameBtn');
  const settingsMessage = document.getElementById('settingsMessage');

  // Načti aktuální přezdívku
  const userDocRef = doc(db, 'users', currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    const userData = userDocSnap.data();
    nicknameInput.value = userData.nickname || '';
  }

  saveBtn.addEventListener('click', async () => {
    const newNick = nicknameInput.value.trim();
    if (newNick.length < 2) {
      settingsMessage.style.color = 'red';
      settingsMessage.textContent = 'Přezdívka musí mít alespoň 2 znaky.';
      return;
    }
    await updateDoc(userDocRef, { nickname: newNick });
    userNickEl.textContent = newNick;
    settingsMessage.style.color = 'green';
    settingsMessage.textContent = 'Přezdívka byla změněna.';
  });
}

async function addRun(km, min) {
  if (!km || !min) {
    alert('Vyplň prosím km i čas.');
    return;
  }
  await addDoc(collection(db, 'runs'), {
    userId: currentUser.uid,
    km,
    min,
    timestamp: Date.now()
  });
  alert('Běh přidán!');
}

hamburger.addEventListener('click', () => {
  sidePanel.classList.remove('hidden');
  sidePanel.setAttribute('aria-hidden', 'false');
});

closePanel.addEventListener('click', () => {
  sidePanel.classList.add('hidden');
  sidePanel.setAttribute('aria-hidden', 'true');
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await signOut(auth);
});

document.getElementById('btnDashboard').addEventListener('click', () => {
  renderDashboard();
  sidePanel.classList.add('hidden');
});

document.getElementById('btnMyRuns').addEventListener('click', () => {
  renderMyRuns();
  sidePanel.classList.add('hidden');
});

document.getElementById('

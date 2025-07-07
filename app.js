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
    dashboardBody.innerHTML = '<tr><td colspan="5">Žádné záznamy</td></tr>';
  } else {
    const usersQuery = query(collection(db, 'users'), where('__name__', 'in', userIds));
    const usersSnapshot = await getDocs(usersQuery);
    const usersData = {};
    usersSnapshot.forEach(u => usersData[u.id] = u.data());

    dashboardBody.innerHTML = '';
    let index = 1;
    userIds.forEach(userId => {
      const user = usersData[userId];
      const stat = usersStats[userId];
      const nickname = user?.nickname || user?.email || 'Neznámý';
      const pace = calculatePace(stat.min, stat.km);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index++}</td>
        <td>${nickname}</td>
        <td>${formatNumber(stat.km)}</td>
        <td>${Math.round(stat.min)}</td>
        <td>${pace}</td>
      `;
      dashboardBody.appendChild(row);
    });
  }

  addRunBtn.addEventListener('click', async () => {
    const km = parseFloat(inputKm.value);
    const min = parseInt(inputMin.value);

    if (!km || !min) {
      addRunMessage.textContent = 'Vyplň prosím km i čas správně.';
      addRunMessage.className = 'alert error';
      return;
    }

    try {
      await addDoc(collection(db, 'runs'), {
        userId: currentUser.uid,
        km,
        min,
        timestamp: Date.now()
      });
      addRunMessage.textContent = 'Běh přidán!';
      addRunMessage.className = 'alert success';
      inputKm.value = '';
      inputMin.value = '';
      renderDashboard(); // refresh tabulky
    } catch (e) {
      addRunMessage.textContent = 'Chyba při přidání běhu.';
      addRunMessage.className = 'alert error';
    }
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

async function renderTeams() {
  mainContent.innerHTML = `
    <h2>Týmy</h2>
    <button id="createTeamBtn">Vytvořit tým</button>
    <button id="joinTeamBtn">Přidat se do týmu</button>
    <div id="teamsList"></div>
  `;

  const teamsList = document.getElementById('teamsList');

  const teamsSnapshot = await getDocs(collection(db, 'teams'));
  teamsList.innerHTML = '';

  if (teamsSnapshot.empty) {
    teamsList.textContent = 'Žádné týmy nejsou vytvořené.';
    return;
  }

  teamsSnapshot.forEach(docSnap => {
    const team = docSnap.data();
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    div.textContent = `${team.name} (vytvořil: ${team.creatorNickname || 'neznámý'})`;
    if (team.members && team.members.includes(currentUser.uid)) {
      const leaveBtn = document.createElement('button');
      leaveBtn.textContent = 'Opustit tým';
      leaveBtn.style.marginLeft = '10px';
      leaveBtn.addEventListener('click', () => leaveTeam(docSnap.id));
      div.appendChild(leaveBtn);
    }
    teamsList.appendChild(div);
  });

  document.getElementById('createTeamBtn').addEventListener('click', createTeam);
  document.getElementById('joinTeamBtn').addEventListener('click', joinTeam);
}

async function
async function createTeam() {
  const teamName = prompt('Zadej název nového týmu:');
  if (!teamName || teamName.trim().length < 3) {
    alert('Název týmu musí mít alespoň 3 znaky.');
    return;
  }

  const teamRef = await addDoc(collection(db, 'teams'), {
    name: teamName.trim(),
    creatorId: currentUser.uid,
    creatorNickname: userNickEl.textContent,
    members: [currentUser.uid],
    createdAt: Date.now()
  });

  await updateUserTeam(teamRef.id, teamName.trim());

  alert(`Tým "${teamName}" vytvořen a přidán.`);
  renderTeams();
  updateUserTeamDisplay(teamName.trim());
}

async function joinTeam() {
  const teamsSnapshot = await getDocs(collection(db, 'teams'));
  if (teamsSnapshot.empty) {
    alert('Žádné týmy nejsou vytvořené.');
    return;
  }

  let teamNames = [];
  let teamIds = [];
  teamsSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    teamNames.push(data.name);
    teamIds.push(docSnap.id);
  });

  const teamChoice = prompt(`Vyber si tým podle čísla:\n${teamNames.map((n,i) => `${i+1}: ${n}`).join('\n')}`);
  const idx = parseInt(teamChoice) - 1;
  if (idx < 0 || idx >= teamIds.length) {
    alert('Neplatná volba.');
    return;
  }

  const chosenTeamId = teamIds[idx];
  const teamDocRef = doc(db, 'teams', chosenTeamId);
  const teamDocSnap = await getDoc(teamDocRef);
  if (!teamDocSnap.exists()) {
    alert('Tým nenalezen.');
    return;
  }

  const teamData = teamDocSnap.data();
  if (teamData.members && teamData.members.includes(currentUser.uid)) {
    alert('Již jsi v tomto týmu.');
    return;
  }

  const newMembers = teamData.members ? [...teamData.members, currentUser.uid] : [currentUser.uid];
  await updateDoc(teamDocRef, { members: newMembers });
  await updateUserTeam(chosenTeamId, teamData.name);

  alert(`Přidán jsi do týmu "${teamData.name}".`);
  renderTeams();
  updateUserTeamDisplay(teamData.name);
}

async function leaveTeam(teamId) {
  const teamDocRef = doc(db, 'teams', teamId);
  const teamDocSnap = await getDoc(teamDocRef);
  if (!teamDocSnap.exists()) {
    alert('Tým nenalezen.');
    return;
  }

  const teamData = teamDocSnap.data();

  if (teamData.creatorId === currentUser.uid) {
    const confirmDelete = confirm('Jste tvůrcem týmu. Opravdu chcete tým smazat?');
    if (!confirmDelete) return;

    // Smažeme tým i běhy členů (pokud chceš, můžeš přidat mazání běhů)
    await deleteDoc(teamDocRef);
    await updateUserTeam(null, 'žádný');
    alert('Tým byl smazán.');
    renderTeams();
    updateUserTeamDisplay('žádný');
    return;
  }

  const newMembers = teamData.members.filter(uid => uid !== currentUser.uid);
  await updateDoc(teamDocRef, { members: newMembers });
  await updateUserTeam(null, 'žádný');

  alert('Opustil jsi tým.');
  renderTeams();
  updateUserTeamDisplay('žádný');
}

async function updateUserTeam(teamId, teamName) {
  const userDocRef = doc(db, 'users', currentUser.uid);
  await updateDoc(userDocRef, { teamId: teamId || null, teamName: teamName || 'žádný' });
  userTeamEl.textContent = `Tým: ${teamName || 'žádný'}`;
}

function updateUserTeamDisplay(teamName) {
  userTeamEl.textContent = `Tým: ${teamName}`;
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
  renderDashboard();
  renderMyRuns();
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    // Přesměruj na přihlášení, pokud chceš, nebo řeš logout tady
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;

  // Načteme uživatelská data
  const userDocRef = doc(db, 'users', currentUser.uid);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
    // Pokud uživatel ještě nemá profil, vytvoříme ho
    await setDoc(userDocRef, {
      email: user.email,
      nickname: user.email.split('@')[0],
      teamId: null,
      teamName: 'žádný'
    });
  }

  const userData = (await getDoc(userDocRef)).data();
  userNickEl.textContent = userData.nickname || currentUser.email;
  userTeamEl.textContent = `Tým: ${userData.teamName || 'žádný'}`;

  renderDashboard();
});

document.getElementById('btnDashboard').addEventListener('click', () => {
  renderDashboard();
  sidePanel.classList.add('hidden');
});

document.getElementById('btnMyRuns').addEventListener('click', () => {
  renderMyRuns();
  sidePanel.classList.add('hidden');
});

document.getElementById('btnSettings').addEventListener('click', () => {
  renderSettings();
  sidePanel.classList.add('hidden');
});

document.getElementById('btnTeams').addEventListener('click', () => {
  renderTeams();
  sidePanel.classList.add('hidden');
});

document.getElementById('addRunBtn').addEventListener('click', () => {
  const km = parseFloat(document.getElementById('inputKm')?.value);
  const min = parseInt(document.getElementById('inputMin')?.value);
  addRun(km, min);
});

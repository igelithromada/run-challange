const hamburger = document.getElementById('hamburger');
const sidePanel = document.getElementById('sidePanel');
const closePanel = document.getElementById('closePanel');
const userNick = document.getElementById('userNick');

hamburger.addEventListener('click', () => {
  sidePanel.classList.add('open');
  sidePanel.setAttribute('aria-hidden', 'false');
});

closePanel.addEventListener('click', () => {
  sidePanel.classList.remove('open');
  sidePanel.setAttribute('aria-hidden', 'true');
});

// Nastav skutečný nick podle Firebase přihlášení později
userNick.textContent = "igelithromada";

document.getElementById('btnLogout').addEventListener('click', () => {
  alert('Odhlášení uživatele (doplnit Firebase signOut)');
  sidePanel.classList.remove('open');
});

document.getElementById('btnMyRuns').addEventListener('click', () => {
  alert('Zobrazit Moje běhy');
  sidePanel.classList.remove('open');
});

document.getElementById('btnTeam').addEventListener('click', () => {
  alert('Zobrazit Tým');
  sidePanel.classList.remove('open');
});

document.getElementById('btnSettings').addEventListener('click', () => {
  alert('Zobrazit Nastavení');
  sidePanel.classList.remove('open');
});

document.getElementById('addRunBtn').addEventListener('click', () => {
  const km = parseFloat(document.getElementById('inputKm').value);
  const min = parseInt(document.getElementById('inputMin').value);

  if (!km || !min) {
    alert('Vyplň prosím km a čas správně.');
    return;
  }

  alert(`Přidán běh: ${km} km za ${min} minut.`);
});

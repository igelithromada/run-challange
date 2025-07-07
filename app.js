// Ovládání sidebaru
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

hamburgerBtn.addEventListener('click', () => {
  sidebar.classList.remove('hidden');
});

closeSidebarBtn.addEventListener('click', () => {
  sidebar.classList.add('hidden');
});

// Ukázková funkce pro přepínání obsahu (v budoucnu sem budeme načítat různé stránky)
const content = document.getElementById('content');

document.getElementById('dashboardBtn').addEventListener('click', () => {
  content.innerHTML = '<h2>Hlavní stránka</h2><p>Vítejte v Dolní Lhota Run!</p>';
  sidebar.classList.add('hidden');
});

document.getElementById('addRunBtn').addEventListener('click', () => {
  content.innerHTML = '<h2>Přidat nový běh</h2><p>Formulář na přidání běhu bude zde.</p>';
  sidebar.classList.add('hidden');
});

document.getElementById('teamsBtn').addEventListener('click', () => {
  content.innerHTML = '<h2>Týmy</h2><p>Zde se budou zobrazovat týmy.</p>';
  sidebar.classList.add('hidden');
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  content.innerHTML = '<h2>Nastavení</h2><p>Nastavení uživatele a aplikace.</p>';
  sidebar.classList.add('hidden');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  // Tady přidáme funkci odhlášení z Firebase, zatím jen placeholder
  alert('Odhlášení uživatele (přidej Firebase logiku)');
  sidebar.classList.add('hidden');
});

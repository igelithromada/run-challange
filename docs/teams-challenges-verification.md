# Ověření týmů a výzev – 16. 11. 2026

Větev: `fix-from-working-23e5eed`. Vzhled ani styly aplikace se nemění.

## Opravy

- Načítání týmů a výzev čeká na přihlášení. Listener týmů se obnoví při změně uživatele.
- Odchod z týmu respektuje hodnotu `null`; navigace týmů zahrnuje výzvy i trasy.
- Členství se ověřuje podle skutečných členů týmu. Založení neblokuje osiřelý odkaz v profilu; přestup odstraní duplicitní členství stejného typu.
- Mazání týmu nejdřív transakčně uzamkne členství a potom čistí pouze odkazy na tento tým. Souběžné připojení nezanechá osiřelé členství.
- Chybějící veřejný profil neskryje člena týmu ani nezablokuje detail.
- Stav výzev se aktualizuje při otevření seznamu i detailu. Datum začátku chrání úpravy a mazání i při zastaralém uloženém stavu.
- Členství u viditelných výzev se čte z konkrétních dokumentů bez požadavku na index collection-group.
- Názvy výzev s lomítkem mají bezpečný klíč. Limit založených výzev je chráněný proti souběžným požadavkům a nepočítá skončené výzvy.
- Bodování nepoužívá složený index aktivit, vynechává neplatná a budoucí data a probíhá v transakci s kontrolou členství. Společný součet se vytváří z aktuálních aktivních členů v další transakci.
- Uzavření výzvy označí stav jako dokončený až po zápisu všech dávek výsledků.
- Opravené Firestore rules obsahují skutečné nové řádky a chrání členství i při prvním vytvoření profilu.
- Soubor závislostí odpovídá `package.json`; CI používá čistou instalaci a testuje také tuto větev.

## Kontroly

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run test:emulator
npm run build
```

`npm test` obsahuje 10 regresních scénářů nad skutečnými API handlery a výpočty s přísnou náhradou Firestore. Test oprávnění se bez emulátoru přeskočí a spouští se samostatně příkazem `test:emulator`.

Emulátor ověřuje pravidla čtení a zákazy klientských zápisů, skutečné Firestore transakce při šesti souběžných založeních týmu a výzev, přestup, připojení během mazání týmu a souběžný výpočet společného cíle včetně odchodu člena. Regresní scénáře zahrnují všechny čtyři cíle a uzavření 901 účastníků.

Sestavení, TypeScript, regresní testy a oba testy emulátoru prošly. ESLint končí bez chyb, se 71 varováními ve stávajícím projektu.

## Rozsah ověření

Testy používají izolovaná data a testovací autentizaci. Neproběhl ruční průchod pod skutečným produkčním účtem ani vizuální porovnání přihlášených obrazovek. Produkční aplikace, její data ani nasazená Firestore pravidla se neměnila. Před produkčním vydáním je potřeba ověřit přihlášené obrazovky na preview a publikovat pravidla koordinovaně s aplikací.

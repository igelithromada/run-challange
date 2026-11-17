# Izolovaná testovací verze

Tato větev se nasazuje pouze do projektu `dolni-lhota-test`. Nikdy ji neslučovat do produkční větve: úmyslně odstraňuje produkční API a nahrazuje Firebase lokálními adaptéry.

- Vstup jako tester neověřuje identitu a nezakládá účet. Slouží pouze k přístupu k ukázkovým datům v prohlížeči.
- Firebase Auth/Firestore runtime jsou přesměrovány přes Turbopack aliasy; `app/lib/firebase.ts` neobsahuje produkční konfiguraci. Produkční API nejsou součástí tohoto sestavení. Neznámé API požadavky vracejí 403 na serveru, 501 v lokálním adaptéru.
- Nejsou přeneseny žádné tajné proměnné z ostrého projektu ani naplánované úlohy.
- Data a zmenšené fotografie se ukládají do localStorage tohoto originu, nikoli do Firebase/Cloudinary. Omezení úložiště prohlížeče je hlášeno jako chyba; tlačítko obnovení vrátí výchozí syntetická data.
- CSP a fetch adaptér povolují pouze vlastní origin a čtení veřejných mapových dlaždic OpenStreetMap. Serverové počasí čte veřejný Open-Meteo.
- Ukázkové aktivity, týmy, výzvy, komentáře a tréninkové plány používají simulovaný backend. Nelze tím potvrdit produkční transakce, pravidla Firestore, souběh více uživatelů, nahrávání Cloudinary, registraci ani doručování push upozornění.
- Administrace a destruktivní serverové funkce nejsou podporovány. GPS a oprávnění zařízení vyžadují skutečný telefon.

Kontrola: `npm run test:sandbox`, `npm run build`, `npm run typecheck`.

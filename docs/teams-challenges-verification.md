# Vydání oprav týmů a výzev

Základ vydání je skutečná veřejná verze `c9d62b162ecbbc2170b1cb4dc5e83e7f1db65c75`, zjištěná podle Vercel produkční domény `run-challange.vercel.app`. Původně ověřená větev měla odlišný model členství i další části aplikace; samotné nasazení jejího staršího základu by změnilo design a odstranilo současné funkce.

Vydání zachovává veřejné styly, rozložení, ostatní moduly, členství ve více týmech, předávání správy i týmové statistiky. Opravy jsou přeneseny na tento základ ve větvi `fix-from-working-23e5eed`.

## Opravy

- Čtení týmů, členství a výzev používá autentizované serverové API. Nevyžaduje nasazení nových klientských pravidel ani collection-group indexů.
- Načítání týmů čeká na přihlášení, seznam se obnoví po změně členství a chybějící veřejný profil neskryje člena.
- Odchod a předání správy čtou historii před prvním transakčním zápisem; nevyžadují složený index.
- Souběžné založení respektuje limit pěti týmů. Mazání blokuje nové členství a atomicky uvolní rezervaci názvu.
- Aktivity zachovávají přispívání do všech aktuálních týmů. Dávky týmových příspěvků respektují dva zápisy na tým a limit 500 zápisů.
- Výzvy se aktualizují při otevření, bezpečně zpracují názvy s lomítkem a blokují úpravy podle skutečného data začátku.
- Bodování všech čtyř cílů respektuje členství, typ aktivity, platné datum a transakční konzistenci. Souběžný výpočet společného cíle neztrácí příspěvky.
- Uzavření výzvy označí stav jako dokončený až po všech dávkách, ověřeno na 901 účastnících.
- Selhání následného přepočtu výzev nehlásí uloženou aktivitu jako neuloženou.

## Kontroly

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run test:emulator
npm run build
```

Regresní testy používají skutečné API handlery a striktní náhradu Firestore. Integrační testy používají skutečný Firestore emulátor a ověřují souběžné operace, členství ve více týmech, limit týmů a výzev, souběh připojení s mazáním a společný výsledek výzvy. Testy oprávnění ověřují čtení přihlášeného uživatele a zakázané přímé klientské zápisy.

Produkční Firebase pravidla se tímto vydáním nemění. Ruční průchod přihlášenými obrazovkami zůstává oddělený od automatických kontrol a nesmí být vydáván za hotový bez skutečného ověření.

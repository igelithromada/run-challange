# Zkušební rozložení 17. 11. 2026

Výchozí stav: produkční commit `29a6ab06c6bce02222624afa45b3ec4b85446579`.
Změny jsou pouze ve větvi `preview/minimal-layout-20261117`. Produkční doména se nepřesměrovává.
Náhled používá existující přihlášení a databázi; uložené změny nejsou zkušební data.

## Zásady

- Samostatná karta pro záznam, tým, výzvu, trasu a formulář.
- Čísla uvnitř karty bez dalších dlaždic, zarovnaná do sloupců s jemným oddělovačem.
- Nastavení, seznam členů, účastníků a administrace jako řádky.
- Vodorovný posuv pro fotografie, hodinové počasí, souhrny, odznaky a varianty vzhledu.
- Hlavní seznamy záznamů, týmů a výzev zůstávají svislé; nic podstatného se neschovává za posuv.
- Méně používané úpravy cílů, hesla a správy týmu jsou pod rozbalovacím řádkem.
- Zachovány existující ikony, barevné počasí, velké fotografie bez ořezu, sociální ikony s počtem vedle, datum bez rámečku a vypnuté animace.
- Jediný nový soubor stylů `app/layout-study.css`, oddělený od produkčních stylů a omezený na `.layout-study`.

## Přehled obrazovek

| Obrazovka | Výsledné rozložení |
| --- | --- |
| Hlavní | Doporučení počasí jako informační řádek, krátké nadpisy, zachovaný formulář a svislý přehled aktivit. |
| Moje aktivity | Posuvný souhrn čísel, stávající filtry a karty záznamů s metrikami bez vnořených dlaždic. |
| Profil účastníka | Stejné záznamové karty jako hlavní obrazovka; avatar a souhrn zůstávají. |
| Můj pokrok | Nejprve plnění cílů, úpravy až po rozbalení; odznaky a rekordy posuvem, kalendář beze změny. |
| Trenér | Zachovaný kalendář a barevné stavy, měsíční souhrny v nízkém posuvném pásu. |
| Týmy | Svislé karty, oddělené statistiky běhu a chůze, skutečný odkaz na detail pro klávesnici i nové okno. |
| Detail týmu | Statistiky a členové před formulářem správy; správa je rozbalovací. |
| Výzvy | Stejný základ karty jako záznam, čitelné období přes šířku na mobilu, prázdné skupiny se nevypisují. |
| Detail výzvy | Akční tlačítka bez nadbytečné obalové dlaždice, výsledky v řádcích. |
| Účastníci | Posuvný souhrn; žebříček bez dlaždice kolem každého řádku, popis správně odpovídá řazení. |
| Výsledky | Kompaktní dvojice přepínačů; datum pod rozbalením, tři souhrny společně a ostatní účastníci jako řádky. |
| Počasí | Hlavní stav bez vnitřního rámečku, tři statistiky společně, zachovaných 12 hodin v posuvném řádku. |
| Trasy | Zachované velké mapy a výškový profil; jedna karta na trasu, upravené rozestupy. |
| Nastavení | Oddělené tematické sekce, jednoduché řádky voleb, vzhled v posuvném výběru. |
| Můj účet | Fotografie i osobní údaje v jednom celku, změna hesla pod rozbalením, odhlášení a smazání zachovány. |
| Administrace | Zachované oprávnění a akce, seznam uživatelů jako oddělené řádky. |
| Administrace záznamů a galerie | Zachované ovládání; společné typografické a fokusové úpravy. |
| Přihlášení a registrace | Zachovaný osvědčený formulář a jeho jednotlivé kroky. |

## Ruční přejímka

- Mobilní šířky 320, 360 a 412 px; počítač 800 px a více.
- Světlé, tmavé a vlastní pozadí.
- Dlouhá přezdívka, název týmu, období přes dva roky a čtyřciferné součty.
- Fotografie na výšku i na šířku, jedna i více fotografií.
- Posuv souhrnů, odznaků a témat prstem i klávesnicí; svislé rolování stránky zůstává dostupné.
- Zobrazit/skrýt správu týmu, úpravy cílů, datum a heslo.
- Přidání, úprava a smazání záznamu, vstup do týmu a výzvy testovat pouze s vědomím společných produkčních dat.
- Ostrou verzi otevřít odkazem v patičce a porovnat.

Bez interaktivního prohlížeče není vizuální a přihlášená ruční přejímka provedena. Automatické sestavení a testy se ověřují na Vercelu; nejde o potvrzení ruční přejímky.

## Automatické ověření prvního kandidáta

Na Vercelu proběhlo `npm test && npm run typecheck && npm run build`.
34 testů prošlo, 1 test Firestore byl přeskočen kvůli nedostupnému emulátoru.
TypeScript i produkční sestavení prošly. Náhled se nasadil ve stavu READY.
Přihlášení na URL náhledu odpovídá HTTP 200. Přihlášené scénáře a vizuální přejímka zatím nejsou ověřeny.

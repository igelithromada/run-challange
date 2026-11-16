# Ověření upozornění – 16. 11. 2026

Větev: `fix-from-working-23e5eed`. Produkční nasazení není součástí tohoto kroku.

## Chování

- Zvonek zůstává dostupný i s prázdnou schránkou. Panel má vlastní posun, stav načítání, chybu s opakováním a odkaz do nastavení.
- Potvrzení přečtení musí uspět, než zpráva zmizí. Starší souběžné načtení nesmí obnovit odstraněnou zprávu. Hromadné přečtení odstraní i historické přečtené položky, vždy pouze přihlášenému uživateli.
- Odkazy týmů/výzev vedou na interní detail. Aktivita z upozornění se načte i mimo prvních 30 záznamů a přepne správný typ aktivity. Odstraněná aktivita zobrazí srozumitelnou zprávu.
- Samostatné přepínače: lajky, komentáře, týmy, výzvy. Server přijímá pouze booleovské změny známých přepínačů a slučuje je v transakci; starší klient nepřepíše nové volby.
- Správce týmu dostane příchod/odchod člena, nový správce převzetí správy. Pořadatel výzvy dostane příchod/odchod účastníka. Vlastní akce se neoznamují jejich původci.
- Aktivní účastníci dostanou začátek a konečné vyhodnocení výzvy. Změna členství a příslušná zpráva jsou atomické. Potvrzení doručení životního cyklu zůstává u účastníka i po přečtení; příznak nedokončeného doručení umožňuje opakovat přerušený cron. Starým aktivním výzvám se neposílá zpětné oznámení začátku.
- Připomínky trenéra používají přehledný výběr celých hodin. Vypnutí se nejprve uloží na server, až pak se odhlásí zařízení. Překrývající se časovače chrání krátká doručovací rezervace. Push po pádu procesu mezi externím odesláním a uložením potvrzení nemůže zaručit právě jedno doručení.
- Karty týmů/výzev mají nejvýše dvouřádkový popis v seznamu (celý zůstává v detailu), výsledky se skládají vedle sebe podle šířky.

## Automatické kontroly

- TypeScript a produkční sestavení: prošly.
- ESLint: 0 chyb, 69 dosavadních varování; počet se nezvýšil.
- `npm test`: 26 úspěšných, 1 podmíněný test pravidel vynechán mimo emulátor.
- Firestore emulátor: 16 úspěšných, včetně skutečných souběžných transakcí, nastavení, ochrany cizí schránky, příjmů členů a životního cyklu. Připomínky trenéra mají test souběžných volání a nezávislých potvrzení dneška/zítřka.
- Test navigace odmítá cizí URL, kóduje ID a ověřuje jednotlivé typy detailu. Test načtení cílové aktivity pokrývá chůzi, odstraněný záznam a neplatné ID.

## Nasazení a dosud neověřené části

`vercel.json` používá standardní `crons` místo neplatné sekce `schedules`. Trasy mají kontrolu `CRON_SECRET`, pražský čas se vyhodnocuje uvnitř obsluhy. Metadata projektu obsahují názvy potřebných proměnných VAPID a CRON_SECRET pro preview i produkci; hodnoty tajemství nebyly načítány. Vercel při ověření odmítl hodinové časovače s chybou `cron_jobs_limits_reached`: projekt je na tarifu Hobby. Kompatibilní konfigurace proto provádí denní kontrolu výzev ve 23:05 UTC (00:05 v zimě, 01:05 v létě). Vyhodnocení může běžet i při zpracování aktivit.

Hodinové push připomínky trenéra vyžadují samostatně ověřený plánovač. Nastavení přes autentizované GET API ověřuje příznak `TRAINER_PUSH_SCHEDULER_READY=true` a přítomnost potřebných klíčů. Bez něj zobrazuje nedostupnost, neumožní novou aktivaci ani změnu času, ale zachová uložené volby a dovolí vypnutí. Příznak zatím není nakonfigurovaný; doručování trenéra na produkci proto nelze označit za funkční. Tarif ani přístupová tajemství se neměnila.

Týmy, výzvy a sociální události jsou upozornění **uvnitř aplikace**. Systémový push na zamčený telefon nadále slouží připomínkám trenéra. Doručení na skutečný telefon a vizuální kontrola přihlášených stránek nejsou tímto emulátorovým ověřením nahrazeny. Produkci ponechat na stávající verzi do dokončení těchto kontrol.

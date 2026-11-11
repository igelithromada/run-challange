# Architektura aplikace

## Cíl

„Dolní Lhota v pohybu“ se postupně mění z jednorázové komunitní aplikace na udržitelný produkt, který může později obsloužit více obcí nebo organizací.

## Základní vrstvy

- **UI:** stránky a komponenty v `app/`
- **Doménové typy:** `app/types.ts`
- **Firestore služby:** `app/lib/services/`
- **Validace:** `app/lib/validation.ts`
- **Serverová autentizace API:** `app/lib/apiAuth.ts`
- **Serverové Firebase služby:** `app/lib/firebaseAdmin.ts`
- **Centrální styly a design tokeny:** `app/styles.css`
- **Firebase pravidla:** `firestore.rules`

## Zásady

1. UI nemá obsahovat opakované Firestore dotazy, pokud lze dotaz centralizovat ve službě.
2. Nové doménové objekty mají mít vlastní TypeScript typ.
3. Serverová API musí ověřit Firebase ID token.
4. Admin API musí ověřit administrátorská oprávnění na serveru.
5. U veřejně zobrazovaných údajů se postupně používá kolekce `publicProfiles`, aby se nemusely klientům zpřístupňovat soukromá data uživatelů.
6. Obrázky se nahrávají přes autorizované serverové API, nikoli přímo z klienta pomocí veřejného unsigned upload presetu.
7. Nové týmové členství se ukládá také na tým do `memberIds`; starší týmy mohou být migrovány později.
8. Tenant / organizace je připravena typy `OrganizationData` a `organizationId`, ale její bezpečnostní izolace se zavede až jako samostatná fáze, aby se nemíchala s běžným refaktorem.

## Aktuální technický směr

### 1. Stabilizace
- TypeScript bez zbytečných `any`
- centrální typy
- lint a typecheck

### 2. Architektura
- služby pro Firestore
- společná autentizace API
- validace vstupů
- oddělení veřejných a soukromých profilů

### 3. Bezpečnost
- Firestore rules
- serverové oprávnění
- autorizovaný upload médií
- bezpečnější push notifikace
- omezení citlivých dat

### 4. Výkon
- sdílené Firestore listenery
- dávkové načítání
- stránkování
- postupné omezení zbytečných realtime dotazů

### 5. Design
- centrální design tokeny
- historické CSS vrstvy jsou sloučené do `app/styles.css`; nové úpravy se dělají pouze v tomto souboru

### 6. Testy
Po stabilizaci architektury přidat automatické testy kritických toků: registrace, přihlášení, aktivita, úprava/smazání, týmy, trenér a administrace.

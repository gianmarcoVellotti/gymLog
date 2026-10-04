# gymLog — Analisi (Fase 1)

Data: 2026-10-04 · Stato: **in attesa di approvazione G1**

## 1. Requisiti confermati (Gate G0)

**Struttura.** N schede → N giorni per scheda → N esercizi per giorno, tutto illimitato (3 giorni come 7). Nome dei giorni libero. Una sola scheda attiva; le vecchie restano consultabili con tutto lo storico. La scheda attiva è sempre modificabile senza alterare le sessioni passate. Inserimento a mano tramite editor in app (nessun import di testo, nessun parser).

**Esercizio.** Appartiene a un distretto muscolare; esercizi diversi possono condividere il distretto. Ogni esercizio ha un'impostazione scelta in creazione: **peso per lato** (bilanciere, manubri) oppure **peso totale** (macchinari); con "per lato" l'app mostra anche il totale. Superset = gruppo unico con un solo recupero. Addome e cardio sono esercizi come gli altri, nessun trattamento speciale. Eliminare un esercizio con storico = archiviarlo.

**Serie.** Ogni serie ha reps e peso propri (es. 8-8-6-6, peso variabile). Tipi: normale, riscaldamento, AMRAP, drop set (ognuno con descrizione in app); etichette ISO e SLOW sull'esercizio; RIR e note. Nessuna durata per esercizio.

**Sessione.** Scelta libera del giorno da eseguire (nessuna rotazione imposta). Inizio/fine manuali, durata totale mostrata. **Auto-chiusura**: dopo 1 h senza attività (nessuna serie né modifica) la sessione si chiude con orario di fine = ultima attività; controllo eseguito alla riapertura dell'app. Valori pre-compilati dall'ultima volta, modificabili.

**Timer.** Recupero per esercizio, modificabile (±15 s o valore digitato). Va in negativo (−0:30) e tiene conto del tempo trascorso a schermo bloccato. Nessun suono, nessun Wake Lock.

**Piattaforma.** iPhone 17 Pro Max / iOS 27, responsive su mobile moderni. Solo dati locali, offline, italiano. Backup/ripristino con condivisione file. Hosting GitHub Pages (repo pubblico `gymLog`, solo codice). Design nero/viola, glassmorphism.

**Release 2 (fuori da v1, ma il modello dati la prevede):** confronto esercizio tra schede, più sessioni nello stesso giorno + inserimento retroattivo, grafici di progressione.

## 2. Versioni verificate (`npm view`, 2026-10-04)

| Pacchetto | Versione | Note |
|---|---|---|
| Node / npm | 24.21.0 LTS / 11.19.0 | installati via nvm (default) |
| vite | 8.3.2 | richiede Node ^20.19 \|\| ≥22.12 → ok |
| react / react-dom | 19.3.0 | |
| @vitejs/plugin-react | 6.1.1 | peer `vite ^8` → ok |
| dexie / dexie-react-hooks | 4.4.6 / 4.4.0 | hooks: peer `dexie >=4.2.0-alpha.1 <5`, `react >=16` |
| vite-plugin-pwa | 2.0.0 | peer vite fino a ^8 (Vite 8 aggiunto in 1.3.0); la 2.0.0 cambia solo il peer di `@vite-pwa/assets-generator` |
| workbox-window | 7.4.1 | peer di vite-plugin-pwa |
| vitest | 5.0.3 | Node ^22.12 \|\| ^24 \|\| ≥26 → ok |
| fake-indexeddb | 6.2.5 | |
| typescript | 7.0.2 | **da validare allo scaffold** (compilatore nativo, major nuova); fallback a 6.x se qualche tool non lo supporta |

## 3. Limiti iOS / piattaforma verificati

- **Quota storage**: le Home Screen Web App hanno le stesse quote del browser (origin fino al 60% del disco). Fonte: [WebKit — Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
- **Eviction**: LRU a livello di intero origin sotto pressione di spazio; gli origin in modalità persistente o con pagina attiva sono esclusi. `navigator.storage.persist()` è concesso con euristiche "come l'essere una Home Screen Web App". Stessa fonte.
- **Cap 7 giorni**: si applica a Safari, **non** alle Home Screen Web App, che hanno un contatore di uso proprio. Fonte: [WebKit — Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/).
- **Cancellare l'icona dalla Home cancella i dati** e lo storage della PWA è separato da quello di Safari (dati inseriti in Safari prima dell'installazione non compaiono nell'app). → backup obbligatorio, README esplicito.
- **Web Share API** supportata su Safari iOS dal 12.2 fino alle versioni attuali ([caniuse](https://caniuse.com/web-share)).
- **Safari 27.0**: le release note non annunciano novità su IndexedDB, Wake Lock, Vibration o Web Share con file ([WebKit Features for Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)). Wake Lock e Vibration non servono (scelte utente).
- **GitHub Pages**: gratuito solo per repository pubblici; per i privati serve un piano a pagamento. Il sito Pages è comunque pubblico. Il repo conterrà solo codice, mai dati o schede. Fonte: [discussione GitHub](https://github.com/orgs/community/discussions/167331).
- **Service worker e installazione** richiedono HTTPS; `file://` e HTTP su IP locale non vanno bene (da qui l'hosting).
- **vite-plugin-pwa**: `registerType: 'prompt'` e hook `useRegisterSW` da `virtual:pwa-register/react` (`needRefresh`, `offlineReady`, `updateServiceWorker`); tipi via `vite-plugin-pwa/react`. Fonte: [documentazione ufficiale](https://vite-pwa-org.netlify.app/frameworks/react.html).
- **Dexie**: `useLiveQuery(querier, deps, defaultResult)`; osserva solo scritture fatte via Dexie; la query deve usare solo API Dexie. Fonte: [dexie.org](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()).
- **gh CLI** installata (2.96.0) e autenticata come `gianmarcoVellotti`.

## 4. Non verificato

1. **Web Share con file (`canShare({files})`) in una PWA installata su iOS 27**: nessuna fonte conferma il livello 2 per iOS 27. Mitigazione: fallback `<a download>`; test reale sul tuo iPhone in Fase 4.
2. **Comportamento effettivo di `persist()` e dell'eviction su iPhone reale.** Solo test sul dispositivo.
3. **Compatibilità di TypeScript 7.0.2 con l'intera toolchain.** Si verifica allo scaffold.
4. **Docs vite-plugin-pwa/Dexie** non menzionano esplicitamente Vite 8 / React 19 oltre ai peer dependency: si verifica con build e test.
5. Dettagli di deploy GitHub Pages (workflow Actions, `base` = `/gymLog/`): da consultare in Fase 3 prima di configurarli.

## 5. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Perdita dati (icona cancellata, eviction, pulizia iOS) | Backup JSON versionato, promemoria dopo 14 giorni, `persist()` best-effort |
| Timer in background (iOS sospende l'app) | Verità = timestamp di fine; ricalcolo su `visibilitychange`; stato persistito |
| Auto-chiusura sessione impossibile in background | Controllo alla riapertura; fine = ultima attività |
| Aggiornamento SW durante una sessione | `registerType: 'prompt'`; mai ricaricare con sessione attiva |
| Storage separato Safari/PWA | Istruzione nel README: installa subito, apri sempre dall'icona |
| Major recenti (Vite 8, TS 7, Vitest 5, plugin-pwa 2) | Build + test a ogni modulo; fallback documentato per TS |
| Repo pubblico | Solo codice; nessun seed con schede personali |

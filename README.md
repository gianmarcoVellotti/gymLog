# gymLog

Registro allenamenti personale, **offline-first**, pensato per iPhone (PWA installabile da Safari).
Schede con un numero illimitato di giorni, storico delle schede, serie con ripetizioni e pesi diversi,
calendario, timer di recupero che va in negativo, backup su file.

- Nessun account, nessun server, nessun costo: i dati vivono **solo sul telefono** (IndexedDB).
- Nessuna chiamata di rete a runtime: dopo il primo caricamento funziona anche in modalità aereo.
- Lingua: italiano. Tema: solo scuro (nero e viola, vetro smerigliato).

## Installazione su iPhone (da fare UNA volta)

1. Apri l'indirizzo dell'app in **Safari** (es. `https://<utente>.github.io/gymLog/`).
2. Tocca **Condividi → Aggiungi alla schermata Home**.
3. **Apri sempre l'app dall'icona sulla Home**, non da Safari.

> ⚠️ **Lo storage dell'app installata è separato da quello di Safari.** I dati inseriti in Safari *prima* di
> installare l'app non compaiono nell'app installata. Installa subito e usa solo l'icona.
>
> ⚠️ **Se cancelli l'icona dalla Home, i dati vengono cancellati.** Fai backup (vedi sotto).

## Uso

- **Oggi**: scegli il giorno della scheda attiva → anteprima → *Inizia allenamento*.
- **Sessione**: compili peso e ripetizioni per ogni serie e tocchi ✓. Il recupero parte da solo. Tocca il numero
  della serie per tipo di serie (normale, riscaldamento, AMRAP, drop set), RIR e nota. L'ⓘ spiega ogni termine.
- **Recupero**: ±15 s oppure tocca il tempo per scriverlo a mano. Se superi il recupero vedi `−0:30` (tempo già
  trascorso). Il valore si ricalcola da un orario di fine, quindi è corretto anche dopo aver bloccato lo schermo.
- **Termina**: mostra la durata totale. Se dimentichi di terminare, dopo **1 ora senza attività** l'allenamento si
  chiude da solo (l'orario di fine è quello dell'ultima attività; puoi correggerlo). Il controllo avviene quando
  riapri l'app: iOS non esegue codice in background.
- **Schede**: crea schede in bozza, *Duplica* una scheda, *Attiva* quando è pronta (la precedente viene archiviata
  con tutto lo storico). Una scheda con allenamenti registrati non si elimina, solo si archivia.
- **Peso**: per ogni esercizio scegli *per lato* (bilanciere, manubri: il totale è 2 × lato + tara) o *totale*
  (macchinari).

## Backup e ripristino

**Altro → Backup e ripristino → Esporta backup**: salva un file `gymLog-AAAA-MM-GG.json` nei **File** (iCloud Drive)
tramite il foglio di condivisione. L'app ti ricorda il backup dopo 14 giorni. **Importa backup** *sostituisce tutti i
dati* del dispositivo (con conferma) e rifiuta file non validi o creati da una versione più recente senza toccare nulla.

## Limiti noti (iOS / web)

- Nessun suono, vibrazione o notifica: il web su iOS non garantisce avvisi a schermo bloccato.
- Lo schermo non resta acceso da solo (scelta di progetto).
- iOS può liberare lo storage di un sito se non lo usi per molto tempo o se lo spazio è poco; per le app installate
  il rischio è basso ma non nullo. L'app richiede lo storage persistente (non garantito): **il backup è l'unica difesa**.
- La condivisione di file dalla PWA (`navigator.share` con file) dipende dalla versione di iOS; in caso contrario
  l'app scarica il file (da cercare in File → Download).
- Gli aggiornamenti dell'app non si applicano mai durante un allenamento: arrivano con un avviso e li accetti tu.

## Controlli manuali da fare sull'iPhone

- [ ] Installata dalla Home, funziona in modalità aereo.
- [ ] Registro una sessione, chiudo e riapro l'app: i dati ci sono.
- [ ] Blocco lo schermo durante il recupero, lo sblocco: il timer mostra il tempo corretto (anche negativo).
- [ ] Archivio la scheda, ne creo una nuova: lo storico della vecchia è intatto.
- [ ] Esporto il backup nei File, cancello l'app, la reinstallo, importo: tutto recuperato.
- [ ] Lascio un allenamento aperto 1 ora e riapro l'app: si è chiuso con l'orario dell'ultima attività.

## Sviluppo

Requisiti: Node ≥ 22.12 (consigliato quello di `.nvmrc`, 24.21.0).

```bash
npm install
npm run dev        # sviluppo su http://localhost:5173
npm run typecheck  # tsc --noEmit (strict)
npm test           # Vitest + fake-indexeddb (fuso Europe/Rome)
npm run build      # typecheck + build + service worker
npm run preview    # prova la build su http://localhost:4173
npm run icons      # rigenera le icone PNG in public/
```

Stack: Vite · React · TypeScript strict · Dexie · vite-plugin-pwa · Vitest.
Architettura a strati: `ui → services → repositories → db`; la UI non importa mai Dexie
(solo `useLiveQuery`, incapsulato in `src/ui/hooks/useLive.ts`). Documentazione in `docs/`:
`ANALISI.md`, `DESIGN.md`, `mockups/`.

## Deploy su GitHub Pages

1. Crea il repository **pubblico** `gymLog` (contiene solo codice, mai dati o schede) e fai push su `main`.
2. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Ogni push su `main` esegue `.github/workflows/deploy.yml` (typecheck, test, build con `VITE_BASE=/gymLog/`, deploy).

Il base path è configurabile con `VITE_BASE` (default `/`); `start_url` e `scope` del manifest lo seguono.

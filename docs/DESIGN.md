# gymLog — Design (Fase 2)

Data: 2026-10-04 · Stato: **APPROVATO (G2) il 2026-10-04 — revisione 2, D1–D12 risolte, stile approvato**. Ogni modifica successiva richiede nuova approvazione. · Prerequisiti: [ANALISI.md](ANALISI.md) · Stile: [mockups/index.html](mockups/index.html)

Convenzioni: ID = `crypto.randomUUID()`; `ISODate` = `YYYY-MM-DD` **locale**; timestamp = epoch ms; pesi in kg.

---

## 1. Decisioni da approvare (D1–D12)

Ognuna è una proposta con raccomandazione. Approvale in blocco ("ok D1–D12") o indica quali cambiare.

| # | Tema | Opzioni | Raccomandazione |
|---|---|---|---|
| D1 ✅ | Cosa si registra per esercizio (`metric`) | `weightReps` (peso+rep) · `reps` (solo rep, corpo libero) | **Due sole metriche**, scelte nell'esercizio. **Nessuna durata** (scelta tua: non essenziale). Con `reps` le ripetizioni possono restare vuote e la serie si segna solo come "fatta": così addome e cardio ("20 min, pendenza 6, vel 5.5") si registrano con la **nota per serie**, senza campi in più. |
| D2 ✅ | Totale per "peso per lato" | solo ×2 · ×2 + **tara** opzionale per esercizio (peso del bilanciere) | **×2 + tara** (default 0). La progressione si confronta sempre sul valore inserito (per lato); il totale è solo informativo. |
| D3 ✅ | Intensità per serie | RIR 0–5 · RPE 6–10 · nessuna | **RIR (0–5), opzionale**, nascosto di default (si attiva per serie). **Serie libere**: ogni serie ha le sue ripetizioni, quindi 4 × (8 8 6 6) come 3 × 10 sono entrambe normali (§3, `PlannedSet[]`). |
| D4 ✅ | ISO / SLOW | tipo di serie · etichetta sull'esercizio · solo note | **Etichette (`tags`) sull'esercizio** (chip SLOW, ISO), mostrate in sessione. Sono modalità di esecuzione, non tipi di serie. Anche per queste l'app mostra una descrizione (vedi sotto). |
| D5 ✅ | Tipo di serie (`kind`) | `normal` · `warmup` · `amrap` · `drop` | Questi quattro, **ognuno con una descrizione in italiano nell'app** (tocco sull'icona ⓘ accanto al tipo, nell'editor e in sessione): vedi "Descrizioni in app". |
| D6 | Timer | avvio automatico al ✓ · avvio manuale | **Automatico** dopo ogni ✓ (tranne dopo una `drop` seguita da altra `drop`). Modifica (±15 s / valore digitato) **solo per quel recupero**; il valore predefinito si cambia nell'editor dell'esercizio. |
| D7 | Scheda | nuova vuota · anche **Duplica scheda** | **Aggiungo "Duplica"** (non era nel brief): le schede da 6 settimane condividono quasi tutti gli esercizi, ricopiarli a mano costa molto. Nuova scheda in stato `draft` finché non la attivi. |
| D8 | Sessione vuota | scartare · conservare | Se si chiude (auto o manuale) con **0 serie registrate**, viene scartata (il manuale chiede conferma). |
| D9 | Storico esercizio in v1 | niente · lista · grafico | **Lista** delle ultime sessioni per esercizio (sola lettura, query indicizzata). I grafici restano in Release 2. |
| D10 | Riordino esercizi/giorni | drag & drop · frecce ↑↓ | **Frecce ↑↓**: il drag è fragile su iOS PWA. |
| D11 | Tema | chiaro/scuro/auto · solo scuro | **Solo scuro** (nero/viola, come richiesto). |
| D12 | Calendario in v1 | consultazione · anche inserimento retroattivo | **Sola consultazione** delle sessioni svolte; inserimento retroattivo = Release 2 (come deciso). |

**Descrizioni in app (testi proposti, da approvare)**

| Voce | Descrizione mostrata |
|---|---|
| Normale | Serie di lavoro standard: fai le ripetizioni previste con il carico scelto. |
| Riscaldamento | Serie leggera di preparazione prima dei carichi di lavoro. Non conta nel volume e non viene usata per proporti il peso la volta dopo. |
| AMRAP | "As Many Reps As Possible": fai **più ripetizioni che riesci**, fino a quasi cedere. Il numero in scheda è solo un minimo/riferimento. |
| Drop set | Appena finisci la serie, **riduci il peso (di solito 20–30%)** e continua subito, senza recupero, fino a cedere. Ogni riduzione si registra come una riga "drop". |
| SLOW | Esecuzione lenta e controllata, soprattutto nella fase di discesa (di solito 3–4 secondi). |
| ISO | Pausa isometrica: fermi il movimento nel punto di massima tensione per 1–3 secondi (o per il tempo indicato nelle note). |
| RIR | "Repetitions In Reserve": quante ripetizioni **avresti ancora potuto fare** a fine serie. 0 = sei arrivato a cedere; 2 = ne avevi ancora 2. |

**Pre-compilazione (confermata, dettaglio mio):** all'inizio sessione, per ogni esercizio, il **peso** di ogni serie viene dall'ultima volta che hai eseguito *lo stesso `exerciseId`* (anche in altra scheda), serie per serie (se prima c'erano meno serie, si usa l'ultima disponibile); le **ripetizioni** sono quelle target della scheda. I valori sono solo suggerimenti (grigio chiaro) finché non premi ✓.

---

## 2. Stack

Vite 8 · React 19 · TypeScript strict · Dexie 4 + `dexie-react-hooks` · `vite-plugin-pwa` 2 (+ `workbox-window`) · Vitest 5 + `fake-indexeddb`. Versioni in ANALISI §2. Niente router esterno (router hash minimale scritto a mano, ~40 righe), niente UI kit, niente libreria di validazione (validatori a mano), CSS puro con variabili (nessun Tailwind). Dipendenze runtime: `react`, `react-dom`, `dexie`, `dexie-react-hooks`.

Alternative valutate (la scelta React è tua): *vanilla TS* — bundle minimo ma UI reattiva da costruire a mano, più codice e più bug; *Preact/Svelte* — più leggeri, ma non li conosci e il vantaggio (pochi KB) è irrilevante per un'app installata e offline.

---

## 3. Modello dati

```
MuscleGroup 1──* Exercise 1──* ProgramExercise *──1 ProgramDay *──1 Program
                    │                                   │
                    └──────────* SessionExercise *──1 Session ──(snapshot, no FK vivo)── Program/Day
                                       1
                                       │
                                       * SetLog
```

```ts
type ID = string; type ISODate = string;
type Metric = 'weightReps' | 'reps';             // nessuna durata (D1)
type WeightMode = 'perSide' | 'total';            // rilevante solo se metric = 'weightReps'
type SetKind = 'normal' | 'warmup' | 'amrap' | 'drop';
type Tag = 'slow' | 'iso';

interface MuscleGroup { id: ID; name: string; nameKey: string; order: number; archived: boolean }
// preset al primo avvio: Petto, Schiena, Spalle, Bicipiti, Tricipiti, Avambracci,
// Quadricipiti, Femorali, Glutei, Polpacci, Addome, Cardio — tutti rinominabili/archiviabili/aggiungibili

interface Exercise {                              // catalogo: identità stabile
  id: ID; name: string; nameKey: string;          // nameKey = nome normalizzato (minuscolo, senza accenti/spazi doppi), univoco tra non archiviati
  muscleGroupId: ID; metric: Metric; weightMode: WeightMode; tareKg: number; // tara per "perSide" (default 0)
  archived: boolean; createdAt: number;
}

interface Program { id: ID; name: string; status: 'draft' | 'active' | 'archived';
  startDate?: ISODate; endDate?: ISODate; notes?: string; createdAt: number }
interface ProgramDay { id: ID; programId: ID; order: number; label: string; title?: string } // label "A", title "Petto e spalle"
interface PlannedSet { kind: SetKind; repsMin?: number; repsMax?: number }  // senza reps = nessun target (es. cardio)
interface ProgramExercise {
  id: ID; dayId: ID; exerciseId: ID; order: number;
  sets: PlannedSet[];                             // una voce per serie: [8,8,6,6] = 4 elementi (D5)
  restSeconds: number; tags: Tag[]; notes?: string;
  groupId?: ID;                                   // stesso groupId consecutivo = superset (gruppo unico)
}

// ---- Eseguito: snapshot, indipendente da modifiche future ----
interface Session {
  id: ID; date: ISODate;                          // data locale di startedAt
  programId: ID; dayId: ID;                       // solo riferimento, non usati per ricostruire lo storico
  programName: string; dayLabel: string; dayTitle?: string;
  status: 'active' | 'completed';
  startedAt: number; endedAt?: number; endedBy?: 'manual' | 'auto';
  lastActivityAt: number;                         // per l'auto-chiusura
  restEndsAt?: number; restTotalMs?: number; restSessionExerciseId?: ID; // timer in corso (§7)
  notes?: string;
}
interface SessionExercise {
  id: ID; sessionId: ID; exerciseId: ID; order: number; groupId?: ID;
  exerciseName: string; muscleGroupName: string; metric: Metric; weightMode: WeightMode; tareKg: number;
  plannedSets: PlannedSet[]; restSeconds: number; tags: Tag[]; notes?: string;
  suggestions: { weightKg?: number; reps?: number }[];  // pre-compilazione, congelata all'avvio
}
interface SetLog {
  id: ID; sessionExerciseId: ID; sessionId: ID; exerciseId: ID;  // denormalizzati per query/indici
  setNumber: number; kind: SetKind;
  reps?: number; weightKg?: number;                              // weightKg = valore INSERITO (per lato o totale, secondo weightMode); reps assente = "fatta" (metric 'reps')
  rir?: number; note?: string; completedAt: number;
}
interface Settings { id: 'main'; weightStepKg: number /*default 2.5*/; lastBackupAt?: number }
```

**Regole di integrità (verificate nei service, mai nella UI)**
1. Al massimo **una** `Program.status = 'active'` e al massimo **una** `Session.status = 'active'`; entrambe imposte in transazione.
2. `Session`/`SessionExercise`/`SetLog` non hanno **mai** chiavi che le facciano dipendere dal contenuto vivo della scheda: tutto ciò che serve per mostrarle è copiato (nomi, tipo, distretto, serie target, recupero).
3. `weightKg`: 0–1000, 2 decimali. `reps`: intero 0–999. `rir`: intero 0–5. `restSeconds`: intero 0–3600.
4. Il confronto di progressione usa sempre `exerciseId`, mai il nome.
5. `groupId` condiviso solo tra `ProgramExercise` **consecutivi** dello stesso giorno; il recupero del gruppo è quello del membro con `order` più alto.
6. Date: unica funzione `toLocalISODate()`; vietato `toISOString().slice(0,10)`.

**Indici Dexie (v1)**

```
muscleGroups:     id, nameKey, order
exercises:        id, nameKey, muscleGroupId
programs:         id, status
programDays:      id, programId
programExercises: id, dayId, exerciseId
sessions:         id, date, status, programId
sessionExercises: id, sessionId, exerciseId
setLogs:          id, sessionExerciseId, sessionId, [exerciseId+completedAt]
settings:         id
```

**Query → indice**: calendario del mese = `sessions.where('date').between(inizio, fine)`; sessione attiva = `sessions.where('status').equals('active')`; "ultima volta" di un esercizio = `setLogs.where('[exerciseId+completedAt]').between([id, minKey],[id, maxKey]).last()` poi i `SetLog` di quel `sessionExerciseId`; storico esercizio = stesso indice, paginato a ritroso; dettaglio sessione = `sessionExercises`/`setLogs` per `sessionId`. Nessuna `toArray()` sull'intero storico dentro un render; le liste sono sempre limitate da un indice.

---

## 4. Operazioni distruttive e protezioni

| Operazione | Protezione |
|---|---|
| Eliminare scheda **con** sessioni | Vietato (`PROGRAM_HAS_SESSIONS`); solo archiviazione |
| Eliminare scheda `draft` o senza sessioni | Dialog di conferma con testo esplicito (quanti giorni/esercizi vanno persi) |
| Eliminare giorno / esercizio dalla scheda | Conferma; **non** tocca le sessioni passate (snapshot) |
| Eliminare esercizio dal catalogo con storico | Solo `archived` (resta nello storico, non proponibile per nuove schede); senza storico → eliminabile con conferma |
| Archiviare distretto in uso | Solo archiviazione (i nomi nelle sessioni passate sono snapshot) |
| Scartare sessione vuota | Conferma (manuale) |
| Eliminare una serie registrata | Conferma |
| Import backup "sostituisci tutto" | Conferma esplicita con riepilogo di ciò che verrà sovrascritto; validazione completa **prima** di toccare il DB; unica transazione |

Nessun `alert/confirm` nativo: dialog custom con descrizione di cosa si perde.

---

## 5. Architettura e struttura cartelle

```
ui (views, components, hooks) → services (casi d'uso, regole, transazioni)
  → repositories (accesso Dexie, nessuna regola) → db (schema, versioni, migrazioni)
```

La UI **non importa mai Dexie** salvo l'hook `useLiveQuery` incapsulato in `ui/hooks/` che riceve funzioni dai `repositories`/`services`.

```
src/
├── db/            schema Dexie, versioni, seed distretti (on populate), upgrade
├── domain/        tipi, costanti, errori (DomainError + ERR), date (toLocalISODate), validazione, calcoli puri (totale peso, volume, durata)
├── repositories/  muscleGroups, exercises, programs, sessions, setLogs, settings
├── services/      programs, exercises, sessions, timer-state, progression (storico), backup, autoclose
├── timer/         logica pura (endsAt, remaining con negativo, adjust, format)
├── ui/            router hash, views, components, hooks, styles (glass tokens)
└── main.tsx
docs/              ANALISI.md, DESIGN.md, TRACCIABILITA.md, mockups/
```

---

## 6. Flussi principali

**Allenarsi (percorso frequente: 2 tap fino a "Inizia")**
1. *Oggi* → tap sul giorno → **Anteprima** (esercizi, serie target, suggerimenti) → **Inizia** → `startSession(dayId)`: una transazione crea `Session` (`startedAt = now`, `lastActivityAt = now`), i `SessionExercise` con snapshot e `suggestions`. Se esiste una sessione attiva → `SESSION_ALREADY_ACTIVE` (la UI propone "Riprendi").
2. Per ogni serie: modifica peso/rep (stepper ± con `weightStepKg`, oppure digitazione; tastiera `inputmode="decimal"`/`"numeric"`) → ✓ → `logSet()`: scrive `SetLog`, aggiorna `lastActivityAt`, avvia il timer (§7). Una serie completata si può riaprire e correggere. "+ serie" aggiunge serie oltre il piano.
3. **Termina** → `endSession()`: `endedAt = now`, `endedBy = 'manual'`, azzera il timer → schermata riepilogo (durata, serie, esercizi, volume, note) con "Modifica orario di fine".
4. **Auto-chiusura** (`autoclose`): all'avvio dell'app e su `visibilitychange`, se esiste una sessione attiva con `now − lastActivityAt > 1 h` → chiusa con `endedAt = lastActivityAt`, `endedBy = 'auto'` (scartata se 0 serie, D8). `lastActivityAt` si aggiorna a ogni scrittura della sessione (serie, modifiche, note, avvio).

**Gestire le schede**: *Schede* → "+" (vuota) o "Duplica" → `draft` → editor giorni (label/titolo, frecce ↑↓) → editor esercizio (scegli dal catalogo con ricerca o "nuovo": nome, distretto, metrica, per lato/totale; serie con "N × rep" rapido poi modifica per serie; tipo serie; recupero; tag; superset "collega al successivo"; note) → **Attiva** → `activateProgram(id)`: in **un'unica transazione** archivia la corrente (con `endDate = oggi`) e attiva la nuova. Una scheda archiviata può essere riattivata. La scheda attiva è sempre modificabile.

**Navigazione** (tab bar vetro): Oggi · Schede · Calendario · Altro (Esercizi e distretti, Backup, Impostazioni, versione app). Con sessione attiva, un banner persistente (durata + timer) riporta alla sessione da qualsiasi schermata. Rotte hash: `#/`, `#/session`, `#/programs`, `#/programs/:id`, `#/programs/:id/day/:dayId`, `#/calendar`, `#/sessions/:id`, `#/exercises/:id`, `#/more`.

**Schermate v1**: Oggi, Anteprima giorno, Sessione, Riepilogo sessione, Elenco schede, Dettaglio scheda, Editor giorno, Editor esercizio, Catalogo esercizi (+ storico per esercizio), Distretti, Calendario, Dettaglio sessione svolta (correggibile), Altro/Backup.

**Stile** (vedi mockup): sfondo `#050408` con aloni viola sfocati, superfici *glass* (`backdrop-filter: blur(22px) saturate(160%)`, bordo bianco al 13%, riflesso interno), accento `#8b5cf6 → #6d28d9`, ritardo/negativo in rosa `#ff6b8a`. Font di sistema. Target tap ≥ 44 px, input ≥ 16 px, `touch-action: manipulation`, `env(safe-area-inset-*)`. Layout fluido da 320 px a tablet (colonna centrata max ~520 px su schermi larghi). Fallback senza `backdrop-filter`: superficie opaca scura.

---

## 7. Timer e tempo

- **Verità = timestamp**: `restEndsAt` (+ `restTotalMs`, `restSessionExerciseId`) sono campi dell'unica `Session` attiva, quindi persistiti in IndexedDB insieme ai dati (nessuno stato di dominio in `localStorage`). Il tempo residuo è `restEndsAt − Date.now()` e **può essere negativo**: dopo lo zero il timer non si ferma, continua a contare in negativo ("−0:30"), rosa, finché premi ✓ sulla serie successiva (che lo sostituisce), "Salta" o chiudi la sessione.
- `setInterval(~250 ms)` serve **solo** a ridisegnare; il valore è ricalcolato da `Date.now()` anche su `visibilitychange`/`pageshow`. Blocco schermo, app sospesa o killed da iOS non alterano il valore: alla riapertura mostra il tempo corretto (anche −3:12).
- Regolazione: ±15 s (`adjustRest` sposta `restEndsAt`, `restTotalMs`), oppure tocco sul numero → inserimento diretto (`m:ss` o secondi). Vale per quel recupero; il default si cambia nell'editor (D6).
- **Durata totale** = `endedAt − startedAt` (in corso: `now − startedAt`, ridisegnata come sopra). Segni tu inizio e fine (D8 + auto-chiusura §6).
- Nessun suono, vibrazione, notifica o Wake Lock (scelta tua). Dichiarato in README: a schermo bloccato non c'è alcun avviso.

---

## 8. Backup e ripristino (F7)

- **Export**: `navigator.share({ files: [gymLog-AAAA-MM-GG.json] })` se `canShare({files})` è vero (salvataggio in File/iCloud Drive), altrimenti download via `<a download>`. Envelope: `{ app: 'gymLog', schemaVersion, exportedAt, data: { <una chiave per tabella>: [...] } }`, **tutte** le tabelle (compresi `Session.rest*`, `settings`). `lastBackupAt` aggiornato solo dopo conferma di share/download riuscito.
- **Import** (solo "sostituisci tutto"): lettura → validazione di forma (campi, tipi, limiti) → rifiuto di `schemaVersion` futura (`BACKUP_FUTURE_VERSION`) → controllo integrità referenziale (ogni `programDay.programId`, `programExercise.exerciseId`, `sessionExercise.sessionId`, `setLog.sessionExerciseId`, … esiste) → conferma utente → svuota e riscrive in **una transazione**. Qualsiasi errore ⇒ `DomainError(BACKUP_INVALID)` e DB **invariato**. Versioni passate: migrate da una funzione `migrateBackup(from → to)`.
- **Promemoria**: banner non invasivo in *Oggi* se `lastBackupAt` è assente o più vecchio di 14 giorni.
- **Round-trip** export → svuota → import = dati identici (test obbligatorio).

---

## 9. PWA, aggiornamenti, migrazioni

- `registerType: 'prompt'` (niente `autoUpdate`): il service worker nuovo resta in attesa; la UI mostra "Nuova versione disponibile" **solo se non c'è sessione attiva** (in *Oggi*/*Altro*), l'utente tocca "Aggiorna" (`updateServiceWorker`). Mai ricarico durante una sessione.
- Precache di tutti gli asset; nessuna chiamata di rete a runtime; nessun font o asset remoto.
- Manifest: `name: gymLog`, `short_name: gymLog`, `display: standalone`, `start_url`/`scope` = base path, colori nero/viola, icone 192/512 + maskable, **`apple-touch-icon` PNG 180×180** generato da script Node (nessuna dipendenza aggiunta senza accordo: valuterò `@vite-pwa/assets-generator` o uno script `sharp`-free e te lo chiedo prima).
- `viewport-fit=cover`, meta `apple-mobile-web-app-capable` e `mobile-web-app-capable`.
- `base` Vite da `VITE_BASE` (default `/`); in produzione `/gymLog/` per GitHub Pages; deploy con GitHub Actions (da documentare in Fase 3).
- `navigator.storage.persist()` all'avvio (best effort; l'esito è mostrato in *Altro*).
- **Migrazioni**: ogni cambio schema = nuova `db.version(n)` con `upgrade()`; mai modificare versioni già rilasciate; test di migrazione da v(n−1). v1 crea le tabelle e (`on('populate')`) i distretti preset e `settings`.

---

## 10. Checklist 2b — risposte

| Domanda | Risposta |
|---|---|
| Sessione passata identica dopo modifica/archiviazione scheda? | Sì: snapshot completo in `Session`/`SessionExercise` (§3 regola 2). |
| Confronto carichi tra schede? | `exerciseId` stabile + indice `[exerciseId+completedAt]`; UI di confronto in Release 2, dati già pronti. |
| Rinomino/elimino un esercizio? | Rinomina: solo catalogo, sessioni conservano il nome snapshot. Eliminazione: archivio se ha storico (§4). |
| Operazioni distruttive protette? | Tabella §4. |
| Una sola scheda `active`? | `activateProgram` in transazione; stessa regola per la sessione attiva. |
| Date locali? | `toLocalISODate()` unica; `Session.date` da `startedAt` locale. |
| Scritture multi-tabella in transazione? | `startSession`, `activateProgram`, `duplicateProgram`, `importBackup`, `deleteProgram`, `endSession`/autoclose (con scarto): sì. |
| Query/indici per calendario, progressione, "ultima volta"? | §3. |
| `toArray()` sull'intero storico in un render? | Mai: query sempre limitate da indice. |
| Timer su timestamp? | Sì (§7). |
| iOS sospende/uccide l'app durante il recupero? | `restEndsAt` persistito; ricalcolo alla riapertura. |
| SW aggiornato durante la sessione? | `prompt` + aggiornamento bloccato con sessione attiva (§9). |
| Export completo, versionato, import validato? | §8. |
| Round-trip identico? | Test obbligatorio (§8). |
| Tracciabilità? | Tabella §11; la versione finale sarà `TRACCIABILITA.md` (Fase 4). |

---

## 11. Tracciabilità requisiti → design

| Requisito | Dove |
|---|---|
| F1 schede, N giorni/esercizi illimitati, editor manuale | §3 `Program/ProgramDay/ProgramExercise`, §6 *Gestire le schede*, D7, D10 |
| F2 storicizzazione, schede archiviate consultabili | §3 stati `Program`, snapshot, §4, §6 `activateProgram` |
| F3 registrazione serie/reps/peso, serie con rep diverse, peso variabile | §3 `PlannedSet[]`, `SetLog`, D1, D5, §6 |
| F4 calendario | §3 indici `sessions.date`, §6 schermate, D12 |
| F5 storico per esercizio | D9, indice `[exerciseId+completedAt]`; grafici = Release 2 |
| F6 timer (per esercizio, ±15 s/digitato, negativo, tempo trascorso) | §7, D6 |
| F7 backup/ripristino via condivisione file | §8 |
| Peso per lato / totale scelto in creazione | §3 `Exercise.weightMode`, D2 |
| Superset gruppo unico | §3 `groupId`, regola 5 |
| Addome/cardio come esercizi normali | D1 (`metric: reps`, reps opzionali, nota per serie) |
| Distretti muscolari preset ed estendibili | §3 `MuscleGroup` |
| Pre-compilazione, scheda sempre modificabile | §1 (pre-compilazione), §3 snapshot |
| Durata totale, auto-chiusura dopo 1 h | §6 punto 4, §7 |
| Nessuna rete, offline, iOS 27 | §9, ANALISI §3 |
| Design nero/viola, glassmorphism | §6 *Stile*, mockup |
| Hosting GitHub Pages | §9 |
| Release 2 (confronto schede, sessioni multiple/retroattive, grafici) | Modello già predisposto (`exerciseId`, date locali, nessun vincolo "una sessione per giorno") |

## 12. Rischi residui

1. **Perdita dati su iOS** (icona cancellata, eviction): mitigata solo da backup manuale + promemoria; non eliminabile.
2. **Condivisione file dalla PWA** non verificata su iOS 27: fallback download; test reale in Fase 4.
3. **Auto-chiusura retroattiva**: l'orario di fine è l'ultima attività (se premi ✓ e poi ti alleni 20 min senza registrare nulla, la durata è sottostimata); correggibile da "Modifica orario di fine".
4. **Toolchain recente** (TS 7, Vite 8, Vitest 5): verifiche a ogni modulo, fallback documentati.
5. **Nessun suono/avviso a schermo bloccato**: scelta tua, dichiarata.
6. **Dati inseriti in Safari prima di installare la PWA non compaiono nell'app**: installare subito e aprire sempre dall'icona (README).
7. **Peso "per lato" e tara**: se non imposti la tara, il totale mostrato è solo 2×lato (D2).

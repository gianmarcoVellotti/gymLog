# gymLog — Tracciabilità requisiti → design → codice → test (Fase 4)

Data: 2026-10-04 · Allineata al codice finale della Fase 3 + correzioni di QA.

**A cosa serve:** per ogni requisito dice dove è deciso (DESIGN), dove è implementato (codice) e come è verificato.
Ogni riga che non è coperta da un test automatico o da una verifica reale è marcata e raccolta in fondo.

**Legenda stato**
- **Coperto** = test automatico (Vitest) e/o verifica eseguita sulla build nel browser integrato.
- **Parziale** = una parte verificata, una parte no (indicata nella colonna Note).
- **Non verificato** = richiede l'iPhone reale o non è stato eseguito.

Test automatici: `src/domain/domain.test.ts` (D), `src/timer/rest.test.ts` (T), `src/services/programs.test.ts` (P),
`src/services/sessions.test.ts` (S), `src/services/backup.test.ts` (B). Totale 74 test.
"Browser" = verifica manuale sulla build di produzione (`vite preview`) nel browser integrato, in emulazione mobile
(non su iPhone). Percorsi `src/...` relativi alla radice del progetto.

## 1. Requisiti del brief (F1–F7)

| Req. | Decisione di design | Codice | Test automatico | Browser | Stato |
|---|---|---|---|---|---|
| **F1** Schede con N giorni, N esercizi, editor a mano | §3 `Program/ProgramDay/ProgramExercise`, §6 *Gestire le schede*, D7, D10 | `services/programs.ts` (`createProgram`, `addDay`, `addProgramExercise`, `updateProgramExercise`, `delete*`, `moveProgramExercise`); viste `ProgramsView`, `ProgramDetailView`, `DayEditorView`, `ExerciseEditorView` | P: "una scheda ha N giorni… (3 o 7 giorni)"; P: sostituzione esercizio a metà periodo; P: ordine | creazione scheda/giorno/esercizio, editor serie 8-8-6-6 | Coperto |
| **F2** Storicizzazione: nuova scheda senza perdere la vecchia | §3 stati `draft/active/archived`, §4, snapshot (§3 regola 2) | `activateProgram`, `archiveProgram`, `deleteProgram`, `duplicateProgram`; `services/sessions.ts` `buildSessionPlan`/`startSession` (snapshot) | P: attivare archivia la vecchia, una sola attiva, storico intatto; P: `PROGRAM_HAS_SESSIONS`; P: eliminare un giorno non tocca le sessioni; S: "modificare la scheda… non cambia le sessioni passate" | schede/archivio visibili | Coperto |
| **F3** Registrare serie, ripetizioni, peso per serie | §3 `PlannedSet[]`, `SetLog`, D1, D5, §6 | `services/sessions.ts` (`logSet`, `updateSetLog`, `deleteSetLog`, `addSetToSessionExercise`); `ui/components/SetRow.tsx`, `ExerciseCard.tsx`, `SessionView.tsx` | S: serie con rep e pesi diversi; S: rifiuta valori fuori limite; S: correggere/eliminare anche a sessione conclusa; S: "+ serie"; D: validazione ai limiti | registrazione serie, tipi R/A, pesi per lato con totale e tara | Coperto |
| **F4** Calendario | §3 indice `sessions.date`, §6 schermate, D12 | `getMonthSessions`; `ui/views/CalendarView.tsx` | S: sessioni del mese per intervallo (bordi); D: limiti del mese | mese, giorno selezionato, badge del giorno | Coperto (UI solo manuale) |
| **F5** Storico per esercizio (grafici = Release 2) | §3 indice `[exerciseId+completedAt]`, D9 | `services/progression.ts` `getExerciseHistory`; `ExerciseDetailView` | S: stesso `exerciseId` in due schede → storico unico e ordinato; S: per id e non per nome + paginazione | non aperta la vista storico | Parziale (UI storico non vista) |
| **F6** Timer di recupero | §7, D6 | `timer/rest.ts`; `services/sessions.ts` (`restAfter`, `adjustRest`, `setRestSeconds`, `skipRest`, `setSessionExerciseRest`); `ui/components/SessionDock.tsx` | T: salto temporale, negativo, ±15, digitato, formattazione; S: avvio, correzione senza riavvio, ±15/digitato/salta, superset, drop set, recupero per esercizio | partenza al ✓ (1:51), valore negativo rosa (−0:02/−0:12), mini-barra | Parziale (±15 e digitazione nella UI non toccati; blocco schermo su iPhone non verificato) |
| **F7** Backup/ripristino | §8 | `services/backup.ts`, `domain/backupSchema.ts`, `repositories/backup.ts`; `ui/views/MoreView.tsx`, `ui/lib/shareFile.ts` | B: round-trip identico; B: import sostituisce tutto; B: sessione attiva+timer sopravvivono; B: JSON rotto / altra app / versione futura / tabella mancante / tipi / valori / riferimenti / id duplicati / più attive → DB invariato | import valido, file futuro, file rotto (messaggi in italiano) | Parziale (export/condivisione file non provati: serve iOS) |

## 2. Risposte della Fase 0 e decisioni D1–D12

| Requisito / decisione | Dove nel design | Codice | Test | Browser | Stato |
|---|---|---|---|---|---|
| Giorni illimitati (3–7), giorno scelto sempre dall'utente | §1, §6 | nessuna rotazione imposta; `TodayView` | P: 7 e 3 giorni | elenco giorni in Oggi | Coperto |
| Ripetizioni diverse per serie (4×8 8 6 6), range 8-12 | §3 `PlannedSet`, D3 | `ui/lib/format.ts` `parseRepsInput`; `ExerciseEditorView` | D: validazione serie; S: 4 serie 8-8-6-6 | editor con 8,8,6,6 | Coperto |
| Peso **per lato / totale** scelto alla creazione | D2, §3 `Exercise.weightMode` | `ExerciseForm`, `domain/calc.ts` `totalWeightKg` | D: peso totale; S: statistiche col peso totale | "Totale: 40 kg (incl. tara 20 kg)" | Coperto |
| Tara opzionale (bilanciere) | D2 | `Exercise.tareKg`, `totalWeightKg` | D: 2×lato + tara | visto in sessione | Coperto |
| Superset = gruppo unico, un solo recupero | §3 `groupId`, regola 5 | `domain/groups.ts`, `setLinkedWithNext`, `restAfter` | D: `normalizeGroups`; P: collega/scollega/sposta/elimina; S: recupero solo dopo l'ultimo membro | 1° membro: nessun timer, 2°: 1:30 | Coperto |
| Addome/cardio come esercizi normali | D1 | `metric: 'reps'`, reps opzionali, nota per serie | S: serie "solo ripetizioni" con nota | cardio registrato senza reps | Coperto |
| Distretti preimpostati ed estendibili | §3 `MuscleGroup` | `db/db.ts` `populate`; `services/catalog.ts`; `MuscleGroupsView` | P: preset presenti, aggiunta, duplicato | non aperta la vista | Parziale (rinomina/archivia distretto senza test) |
| Tipi di serie con descrizione (normale, riscaldamento, AMRAP, drop) | D5, "Descrizioni in app" | `ui/lib/glossary.ts`, `SetRow`, `ExerciseEditorView` | S: riscaldamento separato nella pre-compilazione; S: drop senza recupero in mezzo | dialog ⓘ con le 4 descrizioni | Coperto |
| ISO / SLOW come etichette con descrizione | D4 | `Tag`, `TAG_INFO` | P/S: tag salvati e snapshot | chip SLOW/ISO in anteprima | Parziale (dialog ⓘ dei tag non aperto) |
| RIR 0–5 opzionale per serie | D3 | `validRir`, `SetRow` (pannello dettaglio) | D: limiti RIR; S: RIR/nota in correzione | pannello dettaglio aperto | Coperto |
| Pre-compilazione dall'ultima volta (anche tra schede) | §1 | `services/sessions.ts` `suggest` | S: tra schede; S: riscaldamento/lavoro separati | "Ultima volta: 14 · 14 kg/lato" | Coperto |
| Scheda sempre modificabile, esercizio sostituibile | §3 snapshot | `updateProgramExercise` | P: sostituzione; S: storico immutabile | — | Coperto |
| Inizio/fine manuali, **durata totale** | §6, §7 | `startSession`, `endSession`; `SessionDetailView` | S: durata 1:12:40 | riepilogo con durata, serie, volume | Coperto |
| **Auto-chiusura dopo 1 h**, fine = ultima attività | §6 punto 4 | `autoCloseStaleSession`; `useAutoClose` in `ui/App.tsx` | S: esattamente 1 h = aperta, +1 ms = chiusa con `endedAt = ultima attività`; S: ogni scrittura sposta l'attività; S: sessione vuota scartata | — | Parziale (l'hook di UI non è stato osservato: servirebbe attendere 1 h) |
| Sessione vuota scartata (D8) | D8 | `endSession` → `SESSION_EMPTY`, `discardSession` | S: vuota → `SESSION_EMPTY`, scarto, `SESSION_NOT_EMPTY` | dialog "Nessuna serie registrata" → scarta → torna a Oggi | Coperto |
| Correggere l'orario di fine | §6 | `setSessionEnd` | S: solo concluse, dopo l'inizio | pulsante presente (non usato) | Parziale (dialog dell'orario non provato) |
| Timer: ±15 s, digitato, negativo, tiene conto del tempo passato | §7 | `timer/rest.ts`, `SessionDock` | T e S (vedi F6) | negativo visto | Parziale (vedi F6) |
| Duplica scheda (D7) | D7 | `duplicateProgram` | P: copia giorni, esercizi, superset con nuovi id | — | Coperto (UI non provata) |
| Riordino con frecce (D10) | D10 | `moveDay`, `moveProgramExercise` | P: `moveDay` (bordi), ordine esercizi | frecce presenti | Coperto |
| Eliminazione protetta; esercizio con storico solo archiviato | §4 | `deleteExercise`, `setExerciseArchived`, `deleteProgram` | P: `EXERCISE_HAS_HISTORY`, `EXERCISE_IN_USE`, archivia libera il nome | — | Coperto |
| Date locali (Europe/Rome) | §3 regola 6 | `domain/date.ts` `toLocalISODate` (unica) | D: mezzanotte, ora legale; S: sessione 23:50 e 00:30 | — | Coperto |
| Una sola scheda attiva / una sola sessione attiva | §3 regola 1 | `activateProgram`, `startSession` | P/S + B (backup con più attive rifiutato) | — | Coperto |
| Promemoria backup dopo 14 giorni | §8 | `TodayView` | — | banner "Non hai ancora fatto un backup" | Parziale (soglia dei 14 giorni non testata) |
| Aggiornamenti mai durante una sessione | §9 | `UpdateBanner`, `MoreView` | — | con sessione attiva: SW in attesa, nessun banner, "termina l'allenamento per installarlo"; a sessione chiusa: banner → aggiorna → dati intatti | Coperto (in browser) |
| Nessuna chiamata di rete a runtime | DoD | nessun `fetch`/XHR nel codice (grep) | — | pannello rete: solo richieste same-origin; nessun URL esterno nel bundle (solo costanti/namespace) | Coperto |
| Funziona offline | DoD | service worker + precache (10 file) | — | server spento + ricarica: l'app si apre con i dati | Coperto in browser; **non verificato su iPhone** |
| Responsive (iPhone 17 Pro Max e dispositivi stretti) | §6 Stile | `styles.css` (+ regole ≤360 px) | — | 320, 400 e 430 px: nessun overflow orizzontale (corretto un problema a 320 px) | Parziale (tablet e dimensioni intermedie non provati) |
| Tema solo scuro, nero/viola, glassmorphism | D11 | `styles.css` | — | confronto con i mockup | Coperto |
| Hosting su GitHub Pages | §9 | `.github/workflows/deploy.yml`; `VITE_BASE=/gymLog/` | — | build con base `/gymLog/`: `index.html`, manifest (`start_url`/`scope`) e precache coerenti | Parziale (workflow mai eseguito) |
| Manifest + icone + `apple-touch-icon` PNG 180 | §9 | `vite.config.ts`, `public/`, `scripts/generate-icons.mjs`, `index.html` | — | manifest e icone presenti nella build | Coperto (aspetto sull'iPhone non verificato) |

## 3. Righe senza copertura piena (da leggere)

**Non verificabile senza iPhone reale**
1. Installazione "Aggiungi alla Home" e funzionamento in modalità aereo sul dispositivo.
2. Timer con schermo bloccato (la logica da timestamp è testata; il comportamento di iOS no).
3. Foglio di condivisione per l'export (`navigator.share` con file) e fallback di download su iOS 27.
4. `navigator.storage.persist()` ed eventuale eviction da parte di iOS.
5. Rendering definitivo di `backdrop-filter` (vetro) e delle safe area su iPhone 17 Pro Max.

**Eseguibile ma non eseguito**
6. `useAutoClose` nell'interfaccia (servirebbe attendere 1 h): la regola nel service è testata.
7. Pulsanti ±15 / digitazione del recupero nel dock, "Recupero" nella scheda esercizio, dialog "Orario di fine".
8. Viste Storico per esercizio, Distretti, Duplica scheda e Superset dall'interfaccia (i service sono testati).
9. Layout su tablet e larghezze intermedie.
10. Workflow di deploy su GitHub Actions: mai eseguito (richiede il push sul repo).

**Funzioni dei service senza test dedicato:** `updateProgram`, `updateDay`, `setSessionNotes`,
`renameMuscleGroup`, `setMuscleGroupArchived`, `setWeightStep` (usata solo indirettamente in B).

**Limite strutturale:** non esistono test automatici sui componenti React; la UI è verificata solo a mano.

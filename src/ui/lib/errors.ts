import { DomainError, type ErrorCode } from '../../domain/errors';

const MESSAGES: Record<ErrorCode, string> = {
  PROGRAM_NOT_FOUND: 'Scheda non trovata.',
  PROGRAM_HAS_SESSIONS: 'Questa scheda ha allenamenti registrati e non può essere eliminata: puoi archiviarla.',
  DAY_NOT_FOUND: 'Giorno non trovato.',
  PROGRAM_EXERCISE_NOT_FOUND: 'Esercizio della scheda non trovato.',
  EXERCISE_NOT_FOUND: 'Esercizio non trovato.',
  EXERCISE_NAME_EXISTS: 'Esiste già un esercizio con questo nome.',
  EXERCISE_HAS_HISTORY: "Questo esercizio ha uno storico: non si elimina, puoi archiviarlo (resta nello storico).",
  EXERCISE_IN_USE: "Questo esercizio è usato in almeno una scheda: toglilo dalle schede prima di eliminarlo, oppure archivialo.",
  MUSCLE_GROUP_NOT_FOUND: 'Distretto non trovato.',
  MUSCLE_GROUP_NAME_EXISTS: 'Esiste già un distretto con questo nome.',
  SESSION_NOT_FOUND: 'Allenamento non trovato.',
  SESSION_ALREADY_ACTIVE: "C'è già un allenamento in corso: riprendilo o terminalo prima di iniziarne un altro.",
  SESSION_NOT_ACTIVE: "L'allenamento non è in corso.",
  SESSION_EMPTY: 'Nessuna serie registrata.',
  SESSION_NOT_EMPTY: 'Questo allenamento ha serie registrate.',
  SESSION_EXERCISE_NOT_FOUND: "Esercizio dell'allenamento non trovato.",
  SET_LOG_NOT_FOUND: 'Serie non trovata.',
  INVALID_NAME: 'Il nome non può essere vuoto (max 80 caratteri).',
  INVALID_WEIGHT: 'Peso non valido: da 0 a 1000 kg.',
  INVALID_REPS: 'Ripetizioni non valide: numero intero da 0 a 999.',
  INVALID_RIR: 'RIR non valido: numero intero da 0 a 5.',
  INVALID_REST: 'Recupero non valido: da 0 a 3600 secondi.',
  INVALID_SETS: 'Serie non valide: da 1 a 50 serie, con ripetizioni corrette.',
  INVALID_STEP: "Incremento non valido: da 0,25 a 50 kg.",
  INVALID_TIME: "L'orario di fine deve essere successivo all'inizio.",
  BACKUP_INVALID: 'Il file non è un backup valido di gymLog.',
  BACKUP_FUTURE_VERSION: "Il backup è stato creato da una versione più recente dell'app: aggiorna gymLog e riprova.",
};

export function describeError(e: unknown): string {
  if (e instanceof DomainError) {
    const base = MESSAGES[e.code];
    return e.message && e.message !== e.code ? `${base} (${e.message})` : base;
  }
  return 'Qualcosa è andato storto. I dati non sono stati modificati.';
}

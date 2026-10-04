// Logica pura del timer di recupero. La verità è un timestamp di fine, mai un contatore.
// Il tempo residuo può essere NEGATIVO: oltre lo zero il timer continua a contare (−0:30).

export interface RestTimer {
  endsAt: number;
  totalMs: number;
}

export const startRest = (sec: number, now = Date.now()): RestTimer => ({
  endsAt: now + sec * 1000,
  totalMs: sec * 1000,
});

/** Millisecondi rimanenti; negativo se il recupero è scaduto. */
export const remainingMs = (t: RestTimer, now = Date.now()): number => t.endsAt - now;

export const isOvertime = (t: RestTimer, now = Date.now()): boolean => remainingMs(t, now) < 0;

/** Sposta la fine di ±deltaSec (pulsanti ±15 s). */
export const adjustRest = (t: RestTimer, deltaSec: number): RestTimer => ({
  endsAt: t.endsAt + deltaSec * 1000,
  totalMs: Math.max(0, t.totalMs + deltaSec * 1000),
});

/** Imposta il tempo rimanente a un valore digitato (secondi da adesso). */
export const setRestRemaining = (sec: number, now = Date.now()): RestTimer => startRest(sec, now);

/** Frazione 0–1 di recupero trascorso (per l'anello); 1 se scaduto. */
export const restProgress = (t: RestTimer, now = Date.now()): number =>
  t.totalMs <= 0 ? 1 : Math.min(1, Math.max(0, 1 - remainingMs(t, now) / t.totalMs));

/** "m:ss" con segno meno tipografico se negativo (es. "−0:30"). */
export function formatClock(ms: number): string {
  const secs = Math.ceil(Math.abs(ms) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${ms < 0 ? '−' : ''}${m}:${String(s).padStart(2, '0')}`;
}

/** Interpreta "m:ss", "mm:ss" o secondi interi ("90"); null se non valido. */
export function parseClockInput(text: string): number | null {
  const t = text.trim();
  if (/^\d{1,4}$/.test(t)) return Number(t);
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

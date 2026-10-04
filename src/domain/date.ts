import type { ISODate } from './types';

/**
 * L'UNICA funzione ammessa per ottenere una data locale (YYYY-MM-DD).
 * Vietato `toISOString().slice(0, 10)`: usa UTC e sbaglia giorno attorno a mezzanotte.
 */
export function toLocalISODate(d: Date = new Date()): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Primo giorno del mese e primo giorno del mese successivo (esclusivo). month0: 0 = gennaio. */
export function monthBounds(year: number, month0: number): { start: ISODate; endExclusive: ISODate } {
  const start = toLocalISODate(new Date(year, month0, 1));
  const endExclusive = toLocalISODate(new Date(year, month0 + 1, 1));
  return { start, endExclusive };
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Da 'YYYY-MM-DD' a Date locale a mezzanotte. */
export function parseLocalISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export const isISODate = (v: unknown): v is ISODate => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

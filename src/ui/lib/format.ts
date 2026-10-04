import { parseLocalISODate, toLocalISODate } from '../../domain/date';
import type { ISODate, PlannedSet, SetKind } from '../../domain/types';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const longDay = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const kgFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

export const formatDayLong = (d: Date) => cap(longDay.format(d));
export const formatDateShort = (iso: ISODate) => shortDate.format(parseLocalISODate(iso));
export const formatTime = (ms: number) => timeFmt.format(new Date(ms));
export const formatMonthTitle = (year: number, month0: number) => cap(monthFmt.format(new Date(year, month0, 1)));
export const formatKg = (n: number) => kgFmt.format(n);

/** "oggi", "ieri", "3 giorni fa"... (giorni di calendario locali). */
export function daysAgoLabel(iso: ISODate, today: ISODate = toLocalISODate()): string {
  const diff = Math.round((parseLocalISODate(today).getTime() - parseLocalISODate(iso).getTime()) / 86_400_000);
  if (diff <= 0) return 'oggi';
  if (diff === 1) return 'ieri';
  return `${diff} giorni fa`;
}

/** Accetta virgola o punto decimale; undefined se vuoto o non numerico. */
export function parseDecimal(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function parseIntStrict(text: string): number | undefined {
  const n = parseDecimal(text);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
}

export const KIND_LABEL: Record<SetKind, string> = {
  normal: 'Normale',
  warmup: 'Riscaldamento',
  amrap: 'AMRAP',
  drop: 'Drop set',
};

export const KIND_SHORT: Record<SetKind, string> = { normal: '', warmup: 'R', amrap: 'A', drop: 'D' };

/** "8", "8-12" oppure "" per una serie pianificata. */
export function repsLabel(s: PlannedSet): string {
  if (s.repsMin === undefined && s.repsMax === undefined) return '';
  if (s.repsMin !== undefined && s.repsMax !== undefined && s.repsMin !== s.repsMax) return `${s.repsMin}-${s.repsMax}`;
  return String(s.repsMin ?? s.repsMax);
}

/** "4 serie · 8 8 6 6" */
export function setsSummary(sets: PlannedSet[]): string {
  const reps = sets.map(repsLabel).filter(Boolean);
  const n = `${sets.length} serie`;
  return reps.length ? `${n} · ${reps.join(' ')}` : n;
}

/** Interpreta "8" o "8-12" come repsMin/repsMax; null se non valido, {} se vuoto. */
export function parseRepsInput(text: string): Pick<PlannedSet, 'repsMin' | 'repsMax'> | null {
  const t = text.trim();
  if (t === '') return {};
  const m = /^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/.exec(t);
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  if (min > max) return null;
  return { repsMin: min, repsMax: max };
}

export const clockLabel = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

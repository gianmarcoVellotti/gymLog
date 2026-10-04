import { DomainError, ERR } from './errors';
import type { PlannedSet, SetKind, Tag } from './types';

export const SET_KINDS: readonly SetKind[] = ['normal', 'warmup', 'amrap', 'drop'];
export const TAGS: readonly Tag[] = ['slow', 'iso'];
export const MAX_SETS = 50;
export const MAX_REST_SECONDS = 3600;

const round2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Peso: 0–1000, arrotondato a 2 decimali. */
export function validWeight(v: unknown): number {
  if (!isNum(v) || v < 0 || v > 1000) throw new DomainError(ERR.INVALID_WEIGHT);
  return round2(v);
}

/** Ripetizioni: intero 0–999. */
export function validReps(v: unknown): number {
  if (!isNum(v) || !Number.isInteger(v) || v < 0 || v > 999) throw new DomainError(ERR.INVALID_REPS);
  return v;
}

/** RIR: intero 0–5. */
export function validRir(v: unknown): number {
  if (!isNum(v) || !Number.isInteger(v) || v < 0 || v > 5) throw new DomainError(ERR.INVALID_RIR);
  return v;
}

/** Recupero in secondi: intero 0–3600. */
export function validRestSeconds(v: unknown): number {
  if (!isNum(v) || !Number.isInteger(v) || v < 0 || v > MAX_REST_SECONDS) throw new DomainError(ERR.INVALID_REST);
  return v;
}

/** Incremento peso dei pulsanti ± (0,25–50 kg). */
export function validStep(v: unknown): number {
  if (!isNum(v) || v < 0.25 || v > 50) throw new DomainError(ERR.INVALID_STEP);
  return round2(v);
}

export function validName(v: unknown, max = 80): string {
  if (typeof v !== 'string') throw new DomainError(ERR.INVALID_NAME);
  const s = v.trim().replace(/\s+/g, ' ');
  if (s.length === 0 || s.length > max) throw new DomainError(ERR.INVALID_NAME);
  return s;
}

export function validTags(v: unknown): Tag[] {
  if (!Array.isArray(v)) throw new DomainError(ERR.INVALID_SETS);
  const out: Tag[] = [];
  for (const t of v) {
    if (!TAGS.includes(t as Tag)) throw new DomainError(ERR.INVALID_SETS);
    if (!out.includes(t as Tag)) out.push(t as Tag);
  }
  return out;
}

/** Serie pianificate: 1–50 voci, tipo valido, reps intere, min <= max. */
export function validPlannedSets(v: unknown): PlannedSet[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_SETS) throw new DomainError(ERR.INVALID_SETS);
  return v.map((raw): PlannedSet => {
    const s = raw as Partial<PlannedSet> | null;
    if (!s || typeof s !== 'object' || !SET_KINDS.includes(s.kind as SetKind)) throw new DomainError(ERR.INVALID_SETS);
    const out: PlannedSet = { kind: s.kind as SetKind };
    if (s.repsMin !== undefined) out.repsMin = validReps(s.repsMin);
    if (s.repsMax !== undefined) out.repsMax = validReps(s.repsMax);
    if (out.repsMin !== undefined && out.repsMax !== undefined && out.repsMin > out.repsMax)
      throw new DomainError(ERR.INVALID_SETS);
    return out;
  });
}

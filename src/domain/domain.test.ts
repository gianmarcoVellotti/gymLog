import { describe, expect, it } from 'vitest';
import { formatDurationShort, formatElapsed, normalizeName, sessionStats, totalWeightKg } from './calc';
import { daysInMonth, monthBounds, toLocalISODate } from './date';
import { DomainError, ERR } from './errors';
import { normalizeGroups } from './groups';
import type { SessionExercise, SetLog } from './types';
import {
  validName,
  validPlannedSets,
  validReps,
  validRestSeconds,
  validRir,
  validStep,
  validWeight,
} from './validation';

describe('toLocalISODate (fuso Europe/Rome)', () => {
  it('usa il giorno locale, non quello UTC, attorno a mezzanotte', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Rome');
    // 00:30 del 4 ottobre a Roma (CEST, UTC+2) = 22:30 UTC del 3 ottobre
    const d = new Date(Date.UTC(2026, 9, 3, 22, 30));
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-03'); // il bug che vogliamo evitare
    expect(toLocalISODate(d)).toBe('2026-10-04');
  });

  it('23:59 locale resta nello stesso giorno, 00:00 passa al successivo', () => {
    expect(toLocalISODate(new Date(2026, 9, 3, 23, 59, 59))).toBe('2026-10-03');
    expect(toLocalISODate(new Date(2026, 9, 4, 0, 0, 0))).toBe('2026-10-04');
  });

  it('gestisce il cambio ora legale (ultima domenica di ottobre)', () => {
    expect(toLocalISODate(new Date(2026, 9, 25, 2, 30))).toBe('2026-10-25');
  });

  it('calcola i limiti del mese', () => {
    expect(monthBounds(2026, 9)).toEqual({ start: '2026-10-01', endExclusive: '2026-11-01' });
    expect(monthBounds(2026, 11)).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
    expect(daysInMonth(2028, 1)).toBe(29);
  });
});

describe('validazione ai limiti', () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof DomainError ? e.code : 'ALTRO';
    }
    return null;
  };

  it('peso 0–1000, due decimali', () => {
    expect(validWeight(0)).toBe(0);
    expect(validWeight(1000)).toBe(1000);
    expect(validWeight(12.345)).toBe(12.35);
    expect(code(() => validWeight(-0.01))).toBe(ERR.INVALID_WEIGHT);
    expect(code(() => validWeight(1000.01))).toBe(ERR.INVALID_WEIGHT);
    expect(code(() => validWeight(Number.NaN))).toBe(ERR.INVALID_WEIGHT);
    expect(code(() => validWeight('10'))).toBe(ERR.INVALID_WEIGHT);
  });

  it('ripetizioni intere 0–999', () => {
    expect(validReps(0)).toBe(0);
    expect(validReps(999)).toBe(999);
    expect(code(() => validReps(1000))).toBe(ERR.INVALID_REPS);
    expect(code(() => validReps(8.5))).toBe(ERR.INVALID_REPS);
    expect(code(() => validReps(-1))).toBe(ERR.INVALID_REPS);
  });

  it('RIR 0–5, recupero 0–3600, incremento 0,25–50', () => {
    expect(validRir(5)).toBe(5);
    expect(code(() => validRir(6))).toBe(ERR.INVALID_RIR);
    expect(validRestSeconds(3600)).toBe(3600);
    expect(code(() => validRestSeconds(3601))).toBe(ERR.INVALID_REST);
    expect(validStep(0.25)).toBe(0.25);
    expect(code(() => validStep(0.1))).toBe(ERR.INVALID_STEP);
  });

  it('nome non vuoto, spazi compattati', () => {
    expect(validName('  Panca   piana ')).toBe('Panca piana');
    expect(code(() => validName('   '))).toBe(ERR.INVALID_NAME);
  });

  it('serie: 1–50, rep diverse per serie, min <= max', () => {
    expect(validPlannedSets([8, 8, 6, 6].map((r) => ({ kind: 'normal', repsMin: r, repsMax: r })))).toHaveLength(4);
    expect(code(() => validPlannedSets([]))).toBe(ERR.INVALID_SETS);
    expect(code(() => validPlannedSets(Array.from({ length: 51 }, () => ({ kind: 'normal' }))))).toBe(ERR.INVALID_SETS);
    expect(code(() => validPlannedSets([{ kind: 'boh' }]))).toBe(ERR.INVALID_SETS);
    expect(code(() => validPlannedSets([{ kind: 'normal', repsMin: 12, repsMax: 8 }]))).toBe(ERR.INVALID_SETS);
  });
});

describe('calcoli puri', () => {
  it('normalizeName ignora maiuscole, accenti e spazi doppi', () => {
    expect(normalizeName('  Distensioni  PANCA piàna ')).toBe('distensioni panca piana');
  });

  it('peso totale: per lato = 2 × lato + tara; totale = valore', () => {
    expect(totalWeightKg(20, 'perSide')).toBe(40);
    expect(totalWeightKg(20, 'perSide', 20)).toBe(60);
    expect(totalWeightKg(45, 'total', 20)).toBe(45);
  });

  it('statistiche: il riscaldamento non conta; volume con peso totale', () => {
    const ex = [
      { id: 'a', metric: 'weightReps', weightMode: 'perSide', tareKg: 0 },
      { id: 'b', metric: 'reps', weightMode: 'total', tareKg: 0 },
    ] as SessionExercise[];
    const logs = [
      { sessionExerciseId: 'a', kind: 'warmup', reps: 10, weightKg: 5 },
      { sessionExerciseId: 'a', kind: 'normal', reps: 8, weightKg: 10 },
      { sessionExerciseId: 'a', kind: 'normal', reps: 6, weightKg: 15 },
      { sessionExerciseId: 'b', kind: 'normal', reps: 20 },
    ] as SetLog[];
    expect(sessionStats(ex, logs)).toEqual({ sets: 3, exercises: 2, volumeKg: 8 * 20 + 6 * 30 });
  });

  it('formattazione durata', () => {
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatDurationShort(64 * 60_000)).toBe('1h 04m');
    expect(formatDurationShort(42 * 60_000)).toBe('42m');
  });
});

describe('normalizeGroups (superset consecutivi)', () => {
  const it_ = (id: string, order: number, groupId?: string) => ({ id, order, groupId });
  it('mantiene i gruppi consecutivi', () => {
    expect(normalizeGroups([it_('a', 0, 'g'), it_('b', 1, 'g'), it_('c', 2)])).toEqual([]);
  });
  it('scioglie un gruppo non più consecutivo', () => {
    const fix = normalizeGroups([it_('a', 0, 'g'), it_('x', 1), it_('b', 2, 'g')]);
    expect(fix.map((f) => f.id).sort()).toEqual(['a', 'b']);
    expect(fix.every((f) => f.groupId === undefined)).toBe(true);
  });
  it('scioglie un gruppo con un solo membro', () => {
    expect(normalizeGroups([it_('a', 0, 'g'), it_('b', 1)]).map((f) => f.id)).toEqual(['a']);
  });
});

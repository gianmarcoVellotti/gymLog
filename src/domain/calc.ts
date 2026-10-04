import type { Metric, SessionExercise, SetLog, WeightMode } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Nome normalizzato per il confronto: minuscolo, senza accenti, spazi singoli. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Peso totale: per lato = 2 × lato + tara; totale = valore inserito. */
export function totalWeightKg(weightKg: number, mode: WeightMode, tareKg = 0): number {
  return mode === 'perSide' ? round2(weightKg * 2 + tareKg) : round2(weightKg);
}

export interface SessionStats {
  /** Serie di lavoro registrate (riscaldamento escluso). */
  sets: number;
  /** Esercizi con almeno una serie registrata. */
  exercises: number;
  /** Σ ripetizioni × peso totale delle serie di lavoro con peso (riscaldamento escluso). */
  volumeKg: number;
}

export function sessionStats(exercises: SessionExercise[], logs: SetLog[]): SessionStats {
  const byEx = new Map(exercises.map((e) => [e.id, e]));
  const done = new Set<string>();
  let sets = 0;
  let volume = 0;
  for (const l of logs) {
    const ex = byEx.get(l.sessionExerciseId);
    if (!ex) continue;
    done.add(ex.id);
    if (l.kind === 'warmup') continue;
    sets += 1;
    if (ex.metric === 'weightReps' && l.reps !== undefined && l.weightKg !== undefined)
      volume += l.reps * totalWeightKg(l.weightKg, ex.weightMode, ex.tareKg);
  }
  return { sets, exercises: done.size, volumeKg: Math.round(volume) };
}

export function metricUsesWeight(m: Metric): boolean {
  return m === 'weightReps';
}

/** "H:MM:SS" — durata trascorsa. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "1h 04m" / "42m" — durata compatta. */
export function formatDurationShort(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

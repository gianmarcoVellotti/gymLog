import type { ID, ISODate, SessionExercise, SetLog } from '../domain/types';
import { sessionExercisesRepo, sessionsRepo, setLogsRepo } from '../repositories/sessions';

export interface HistoryEntry {
  sessionId: ID;
  date: ISODate;
  programName: string;
  dayLabel: string;
  sessionExercise: SessionExercise;
  sets: SetLog[];
}

export interface ExerciseHistory {
  entries: HistoryEntry[];
  /** Passalo come `before` per caricare le sessioni precedenti; undefined = fine dello storico. */
  nextBefore?: number;
}

/**
 * Storico di un esercizio per `exerciseId` (mai per nome), dalla sessione più recente.
 * Query limitata dall'indice [exerciseId+completedAt]: non legge mai l'intero storico.
 */
export async function getExerciseHistory(exerciseId: ID, maxSessions = 10, before?: number): Promise<ExerciseHistory> {
  const logs = await setLogsRepo.recentForExercise(exerciseId, maxSessions, before);
  const groups = new Map<ID, SetLog[]>();
  for (const l of logs) {
    const g = groups.get(l.sessionExerciseId) ?? [];
    g.push(l);
    groups.set(l.sessionExerciseId, g);
  }
  const ids = [...groups.keys()];
  const hasMore = ids.length > maxSessions;
  const kept = ids.slice(0, maxSessions);

  const entries: HistoryEntry[] = [];
  for (const seId of kept) {
    const se = await sessionExercisesRepo.get(seId);
    const sets = groups.get(seId) ?? [];
    const session = se ? await sessionsRepo.get(se.sessionId) : undefined;
    if (!se || !session) continue;
    entries.push({
      sessionId: session.id,
      date: session.date,
      programName: session.programName,
      dayLabel: session.dayLabel,
      sessionExercise: se,
      sets: [...sets].sort((a, b) => a.setNumber - b.setNumber),
    });
  }
  const lastKept = kept[kept.length - 1];
  const nextBefore =
    hasMore && lastKept ? Math.min(...(groups.get(lastKept) ?? []).map((l) => l.completedAt)) : undefined;
  return { entries, nextBefore };
}

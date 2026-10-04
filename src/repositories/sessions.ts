import Dexie from 'dexie';
import { db } from '../db/db';
import type { ID, ISODate, Session, SessionExercise, SetLog } from '../domain/types';

export const sessionsRepo = {
  get: (id: ID) => db.sessions.get(id),
  async put(s: Session): Promise<void> {
    await db.sessions.put(s);
  },
  async add(s: Session): Promise<void> {
    await db.sessions.add(s);
  },
  async remove(id: ID): Promise<void> {
    await db.sessions.delete(id);
  },
  getActive: () => db.sessions.where('status').equals('active').first(),
  /** Sessioni con date in [start, endExclusive). Usa l'indice `date`. */
  listByDateRange(start: ISODate, endExclusive: ISODate): Promise<Session[]> {
    return db.sessions.where('date').between(start, endExclusive, true, false).toArray();
  },
  bulkGet: (ids: ID[]) => db.sessions.bulkGet(ids),
  listByProgram: (programId: ID) => db.sessions.where('programId').equals(programId).toArray(),
};

export const sessionExercisesRepo = {
  get: (id: ID) => db.sessionExercises.get(id),
  async listBySession(sessionId: ID): Promise<SessionExercise[]> {
    return (await db.sessionExercises.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order);
  },
  async bulkAdd(es: SessionExercise[]): Promise<void> {
    await db.sessionExercises.bulkAdd(es);
  },
  async put(e: SessionExercise): Promise<void> {
    await db.sessionExercises.put(e);
  },
  async removeBySession(sessionId: ID): Promise<void> {
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
  },
};

export const setLogsRepo = {
  get: (id: ID) => db.setLogs.get(id),
  async listBySession(sessionId: ID): Promise<SetLog[]> {
    return (await db.setLogs.where('sessionId').equals(sessionId).toArray()).sort(
      (a, b) => a.completedAt - b.completedAt || a.setNumber - b.setNumber,
    );
  },
  async listBySessionExercise(sessionExerciseId: ID): Promise<SetLog[]> {
    return (await db.setLogs.where('sessionExerciseId').equals(sessionExerciseId).toArray()).sort(
      (a, b) => a.setNumber - b.setNumber,
    );
  },
  countBySession: (sessionId: ID) => db.setLogs.where('sessionId').equals(sessionId).count(),
  async add(l: SetLog): Promise<void> {
    await db.setLogs.add(l);
  },
  async put(l: SetLog): Promise<void> {
    await db.setLogs.put(l);
  },
  async remove(id: ID): Promise<void> {
    await db.setLogs.delete(id);
  },
  async removeBySession(sessionId: ID): Promise<void> {
    await db.setLogs.where('sessionId').equals(sessionId).delete();
  },
  /** Ultima serie registrata di un esercizio (indice composto). */
  lastForExercise(exerciseId: ID): Promise<SetLog | undefined> {
    return db.setLogs
      .where('[exerciseId+completedAt]')
      .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
      .last();
  },
  /**
   * Serie di un esercizio dalla più recente, fermandosi appena si superano `maxGroups` sessioni-esercizio
   * distinte (mai un'intera tabella). `beforeCompletedAt` per la paginazione.
   */
  async recentForExercise(exerciseId: ID, maxGroups: number, beforeCompletedAt?: number): Promise<SetLog[]> {
    const upper = beforeCompletedAt ?? Dexie.maxKey;
    const out: SetLog[] = [];
    const seen = new Set<ID>();
    await db.setLogs
      .where('[exerciseId+completedAt]')
      .between([exerciseId, Dexie.minKey], [exerciseId, upper], true, false)
      .reverse()
      .until((l) => {
        seen.add(l.sessionExerciseId);
        return seen.size > maxGroups;
      }, true) // include la serie che fa scattare lo stop: serve a sapere che esistono altre sessioni
      .each((l) => {
        out.push(l);
      });
    return out;
  },
};

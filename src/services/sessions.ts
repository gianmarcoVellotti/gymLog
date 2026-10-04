import { db } from '../db/db';
import { sessionStats, type SessionStats } from '../domain/calc';
import { monthBounds, toLocalISODate } from '../domain/date';
import { DomainError, ERR } from '../domain/errors';
import type {
  ID,
  PlannedSet,
  Program,
  ProgramDay,
  Session,
  SessionExercise,
  SetKind,
  SetLog,
  SuggestedSet,
} from '../domain/types';
import { SET_KINDS, validReps, validRestSeconds, validRir, validWeight } from '../domain/validation';
import { exercisesRepo, muscleGroupsRepo } from '../repositories/catalog';
import { daysRepo, programExercisesRepo, programsRepo } from '../repositories/programs';
import { sessionExercisesRepo, sessionsRepo, setLogsRepo } from '../repositories/sessions';
import { adjustRest as adjustTimer, setRestRemaining, startRest, type RestTimer } from '../timer/rest';

/** Inattività oltre la quale una sessione aperta viene chiusa da sola. */
export const AUTO_CLOSE_MS = 60 * 60 * 1000;
const MAX_SET_NUMBER = 200;

const SESSION_TABLES = [db.sessions, db.sessionExercises, db.setLogs];

// ------------------------------------------------------------------ Piano di sessione (snapshot)

export type PlanItem = Omit<SessionExercise, 'id' | 'sessionId'>;

export interface SessionPlan {
  program: Program;
  day: ProgramDay;
  items: PlanItem[];
}

/**
 * Pre-compilazione: il PESO di ogni serie viene dall'ultima volta che hai eseguito lo stesso exerciseId
 * (anche in un'altra scheda), serie per serie; le REPS sono il target della scheda (repsMin).
 * Riscaldamento e serie di lavoro vengono confrontati separatamente.
 */
async function suggest(exerciseId: ID, planned: PlannedSet[]): Promise<SuggestedSet[]> {
  const last = await setLogsRepo.lastForExercise(exerciseId);
  const logs = last ? await setLogsRepo.listBySessionExercise(last.sessionExerciseId) : [];
  const work = logs.filter((l) => l.kind !== 'warmup');
  const warm = logs.filter((l) => l.kind === 'warmup');
  let wi = 0;
  let ui = 0;
  return planned.map((p): SuggestedSet => {
    const source = p.kind === 'warmup' ? warm : work;
    const idx = p.kind === 'warmup' ? wi++ : ui++;
    const ref = source[Math.min(idx, source.length - 1)];
    const s: SuggestedSet = {};
    if (ref?.weightKg !== undefined) s.weightKg = ref.weightKg;
    const reps = p.repsMin ?? p.repsMax;
    if (reps !== undefined) s.reps = reps;
    return s;
  });
}

/** Costruisce lo snapshot di un giorno (senza scrivere nulla): usato dall'anteprima e da startSession. */
export async function buildSessionPlan(dayId: ID): Promise<SessionPlan> {
  const day = await daysRepo.get(dayId);
  if (!day) throw new DomainError(ERR.DAY_NOT_FOUND);
  const program = await programsRepo.get(day.programId);
  if (!program) throw new DomainError(ERR.PROGRAM_NOT_FOUND);
  const entries = await programExercisesRepo.listByDay(dayId);
  const items: PlanItem[] = [];
  for (const pe of entries) {
    const ex = await exercisesRepo.get(pe.exerciseId);
    if (!ex) throw new DomainError(ERR.EXERCISE_NOT_FOUND);
    const group = await muscleGroupsRepo.get(ex.muscleGroupId);
    items.push({
      exerciseId: ex.id,
      order: pe.order,
      groupId: pe.groupId,
      exerciseName: ex.name,
      muscleGroupName: group?.name ?? '',
      metric: ex.metric,
      weightMode: ex.weightMode,
      tareKg: ex.tareKg,
      plannedSets: pe.sets.map((s) => ({ ...s })),
      restSeconds: pe.restSeconds,
      tags: [...pe.tags],
      notes: pe.notes,
      suggestions: await suggest(ex.id, pe.sets),
    });
  }
  return { program, day, items };
}

const PLAN_TABLES = [
  db.programs,
  db.programDays,
  db.programExercises,
  db.exercises,
  db.muscleGroups,
  db.setLogs,
] as const;

export const getDayPlan = (dayId: ID) => db.transaction('r', [...PLAN_TABLES], () => buildSessionPlan(dayId));

// ------------------------------------------------------------------ Ciclo di vita

/** Avvia una sessione: una transazione crea Session + SessionExercise con snapshot e pre-compilazione. */
export async function startSession(dayId: ID, now = Date.now()): Promise<ID> {
  return db.transaction('rw', [...PLAN_TABLES, ...SESSION_TABLES], async () => {
    if (await sessionsRepo.getActive()) throw new DomainError(ERR.SESSION_ALREADY_ACTIVE);
    const plan = await buildSessionPlan(dayId);
    const session: Session = {
      id: crypto.randomUUID(),
      date: toLocalISODate(new Date(now)),
      programId: plan.program.id,
      dayId: plan.day.id,
      programName: plan.program.name,
      dayLabel: plan.day.label,
      dayTitle: plan.day.title,
      status: 'active',
      startedAt: now,
      lastActivityAt: now,
    };
    await sessionsRepo.add(session);
    await sessionExercisesRepo.bulkAdd(plan.items.map((it) => ({ ...it, id: crypto.randomUUID(), sessionId: session.id })));
    return session.id;
  });
}

async function requireActive(sessionId: ID): Promise<Session> {
  const s = await sessionsRepo.get(sessionId);
  if (!s) throw new DomainError(ERR.SESSION_NOT_FOUND);
  if (s.status !== 'active') throw new DomainError(ERR.SESSION_NOT_ACTIVE);
  return s;
}

const clearRest = (s: Session): Session => ({
  ...s,
  restEndsAt: undefined,
  restTotalMs: undefined,
  restSessionExerciseId: undefined,
});

/** Termina la sessione. Con 0 serie registrate lancia SESSION_EMPTY: la UI chiede se scartarla. */
export async function endSession(sessionId: ID, now = Date.now()): Promise<void> {
  await db.transaction('rw', SESSION_TABLES, async () => {
    const s = await requireActive(sessionId);
    if ((await setLogsRepo.countBySession(sessionId)) === 0) throw new DomainError(ERR.SESSION_EMPTY);
    await sessionsRepo.put({ ...clearRest(s), status: 'completed', endedAt: Math.max(now, s.startedAt), endedBy: 'manual' });
  });
}

/** Scarta una sessione vuota (nessuna serie registrata). */
export async function discardSession(sessionId: ID): Promise<void> {
  await db.transaction('rw', SESSION_TABLES, async () => {
    const s = await sessionsRepo.get(sessionId);
    if (!s) throw new DomainError(ERR.SESSION_NOT_FOUND);
    if ((await setLogsRepo.countBySession(sessionId)) > 0) throw new DomainError(ERR.SESSION_NOT_EMPTY);
    await sessionExercisesRepo.removeBySession(sessionId);
    await sessionsRepo.remove(sessionId);
  });
}

export type AutoCloseResult = 'none' | 'closed' | 'discarded';

/**
 * Chiude la sessione attiva se è ferma da più di 1 h: fine = ultima attività (non l'ora della chiusura).
 * Una sessione senza serie viene scartata. Va chiamata all'avvio e su visibilitychange.
 */
export async function autoCloseStaleSession(now = Date.now()): Promise<AutoCloseResult> {
  return db.transaction('rw', SESSION_TABLES, async () => {
    const s = await sessionsRepo.getActive();
    if (!s || now - s.lastActivityAt <= AUTO_CLOSE_MS) return 'none';
    if ((await setLogsRepo.countBySession(s.id)) === 0) {
      await sessionExercisesRepo.removeBySession(s.id);
      await sessionsRepo.remove(s.id);
      return 'discarded';
    }
    await sessionsRepo.put({
      ...clearRest(s),
      status: 'completed',
      endedAt: Math.max(s.lastActivityAt, s.startedAt),
      endedBy: 'auto',
    });
    return 'closed';
  });
}

/** Corregge l'orario di fine di una sessione conclusa. */
export async function setSessionEnd(sessionId: ID, endedAt: number): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await sessionsRepo.get(sessionId);
    if (!s) throw new DomainError(ERR.SESSION_NOT_FOUND);
    if (s.status !== 'completed') throw new DomainError(ERR.SESSION_NOT_ACTIVE);
    if (!Number.isFinite(endedAt) || endedAt <= s.startedAt) throw new DomainError(ERR.INVALID_TIME);
    await sessionsRepo.put({ ...s, endedAt, endedBy: 'manual' });
  });
}

export async function setSessionNotes(sessionId: ID, notes: string): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await sessionsRepo.get(sessionId);
    if (!s) throw new DomainError(ERR.SESSION_NOT_FOUND);
    await sessionsRepo.put({
      ...s,
      notes: notes.trim() || undefined,
      lastActivityAt: s.status === 'active' ? Date.now() : s.lastActivityAt,
    });
  });
}

// ------------------------------------------------------------------ Serie

export interface LogSetInput {
  sessionExerciseId: ID;
  setNumber: number;
  kind: SetKind;
  reps?: number;
  weightKg?: number;
  rir?: number;
  note?: string;
}

function checkKind(kind: unknown): SetKind {
  if (!SET_KINDS.includes(kind as SetKind)) throw new DomainError(ERR.INVALID_SETS);
  return kind as SetKind;
}

function cleanNote(note: string | undefined): string | undefined {
  const n = note?.trim();
  return n ? n.slice(0, 500) : undefined;
}

/** Secondi di recupero da avviare dopo una serie appena registrata (0 = nessun timer). */
function restAfter(se: SessionExercise, siblings: SessionExercise[], kind: SetKind, setNumber: number): number {
  // Drop set seguita da un'altra drop: nessun recupero in mezzo.
  if (kind === 'drop' && se.plannedSets[setNumber]?.kind === 'drop') return 0;
  if (se.groupId) {
    const members = siblings.filter((s) => s.groupId === se.groupId).sort((a, b) => a.order - b.order);
    const last = members[members.length - 1];
    // Superset: il recupero parte solo dopo l'ultimo esercizio del giro, con il suo valore.
    return last && last.id === se.id ? last.restSeconds : 0;
  }
  return se.restSeconds;
}

/** Registra (o corregge) una serie. Una nuova serie avvia il timer; correggerne una esistente no. */
export async function logSet(input: LogSetInput, now = Date.now()): Promise<SetLog> {
  return db.transaction('rw', SESSION_TABLES, async () => {
    const se = await sessionExercisesRepo.get(input.sessionExerciseId);
    if (!se) throw new DomainError(ERR.SESSION_EXERCISE_NOT_FOUND);
    const session = await requireActive(se.sessionId);

    if (!Number.isInteger(input.setNumber) || input.setNumber < 1 || input.setNumber > MAX_SET_NUMBER)
      throw new DomainError(ERR.INVALID_SETS);
    const kind = checkKind(input.kind);
    const fields: Pick<SetLog, 'reps' | 'weightKg' | 'rir' | 'note'> = { note: cleanNote(input.note) };
    if (se.metric === 'weightReps') {
      fields.reps = validReps(input.reps);
      if (input.weightKg !== undefined) fields.weightKg = validWeight(input.weightKg);
    } else if (input.reps !== undefined) {
      fields.reps = validReps(input.reps);
    }
    if (input.rir !== undefined) fields.rir = validRir(input.rir);

    const existing = (await setLogsRepo.listBySessionExercise(se.id)).find((l) => l.setNumber === input.setNumber);
    const log: SetLog = {
      id: existing?.id ?? crypto.randomUUID(),
      sessionExerciseId: se.id,
      sessionId: se.sessionId,
      exerciseId: se.exerciseId,
      setNumber: input.setNumber,
      kind,
      ...fields,
      completedAt: existing?.completedAt ?? now,
    };
    await setLogsRepo.put(log);

    let next: Session = { ...session, lastActivityAt: now };
    if (!existing) {
      const rest = restAfter(se, await sessionExercisesRepo.listBySession(se.sessionId), kind, input.setNumber);
      next = rest > 0
        ? { ...next, restEndsAt: startRest(rest, now).endsAt, restTotalMs: rest * 1000, restSessionExerciseId: se.id }
        : clearRest(next);
    }
    await sessionsRepo.put(next);
    return log;
  });
}

export interface SetLogPatch {
  reps?: number | null;
  weightKg?: number | null;
  rir?: number | null;
  note?: string | null;
  kind?: SetKind;
}

/** Corregge una serie registrata (anche in sessioni concluse). `null` cancella il campo. */
export async function updateSetLog(logId: ID, patch: SetLogPatch, now = Date.now()): Promise<void> {
  await db.transaction('rw', SESSION_TABLES, async () => {
    const log = await setLogsRepo.get(logId);
    if (!log) throw new DomainError(ERR.SET_LOG_NOT_FOUND);
    const se = await sessionExercisesRepo.get(log.sessionExerciseId);
    if (!se) throw new DomainError(ERR.SESSION_EXERCISE_NOT_FOUND);
    const next: SetLog = { ...log };
    if (patch.kind !== undefined) next.kind = checkKind(patch.kind);
    if (patch.reps !== undefined) next.reps = patch.reps === null ? undefined : validReps(patch.reps);
    if (patch.weightKg !== undefined) next.weightKg = patch.weightKg === null ? undefined : validWeight(patch.weightKg);
    if (patch.rir !== undefined) next.rir = patch.rir === null ? undefined : validRir(patch.rir);
    if (patch.note !== undefined) next.note = patch.note === null ? undefined : cleanNote(patch.note);
    if (se.metric === 'weightReps' && next.reps === undefined) throw new DomainError(ERR.INVALID_REPS);
    await setLogsRepo.put(next);
    const s = await sessionsRepo.get(log.sessionId);
    if (s?.status === 'active') await sessionsRepo.put({ ...s, lastActivityAt: now });
  });
}

export async function deleteSetLog(logId: ID, now = Date.now()): Promise<void> {
  await db.transaction('rw', SESSION_TABLES, async () => {
    const log = await setLogsRepo.get(logId);
    if (!log) throw new DomainError(ERR.SET_LOG_NOT_FOUND);
    await setLogsRepo.remove(logId);
    const s = await sessionsRepo.get(log.sessionId);
    if (s?.status === 'active') await sessionsRepo.put({ ...s, lastActivityAt: now });
  });
}

/** "+ serie": aggiunge una serie oltre il piano (solo per questa sessione), copiando l'ultima. */
export async function addSetToSessionExercise(sessionExerciseId: ID, now = Date.now()): Promise<void> {
  await db.transaction('rw', SESSION_TABLES, async () => {
    const se = await sessionExercisesRepo.get(sessionExerciseId);
    if (!se) throw new DomainError(ERR.SESSION_EXERCISE_NOT_FOUND);
    const session = await requireActive(se.sessionId);
    const lastPlanned = se.plannedSets[se.plannedSets.length - 1];
    const lastSugg = se.suggestions[se.suggestions.length - 1];
    await sessionExercisesRepo.put({
      ...se,
      plannedSets: [...se.plannedSets, lastPlanned ? { ...lastPlanned } : { kind: 'normal' }],
      suggestions: [...se.suggestions, lastSugg ? { ...lastSugg } : {}],
    });
    await sessionsRepo.put({ ...session, lastActivityAt: now });
  });
}

/** Recupero di questo esercizio, solo per la sessione in corso. */
export async function setSessionExerciseRest(sessionExerciseId: ID, restSeconds: number): Promise<void> {
  await db.transaction('rw', SESSION_TABLES, async () => {
    const se = await sessionExercisesRepo.get(sessionExerciseId);
    if (!se) throw new DomainError(ERR.SESSION_EXERCISE_NOT_FOUND);
    await requireActive(se.sessionId);
    await sessionExercisesRepo.put({ ...se, restSeconds: validRestSeconds(restSeconds) });
  });
}

// ------------------------------------------------------------------ Timer di recupero

export const timerOf = (s: Session): RestTimer | undefined =>
  s.restEndsAt !== undefined ? { endsAt: s.restEndsAt, totalMs: s.restTotalMs ?? 0 } : undefined;

async function writeTimer(sessionId: ID, fn: (s: Session, t: RestTimer | undefined) => Session, now: number) {
  await db.transaction('rw', db.sessions, async () => {
    const s = await requireActive(sessionId);
    await sessionsRepo.put({ ...fn(s, timerOf(s)), lastActivityAt: now });
  });
}

/** ±15 s (o altro delta) sul recupero in corso: vale solo per questo recupero. */
export const adjustRest = (sessionId: ID, deltaSec: number, now = Date.now()) =>
  writeTimer(
    sessionId,
    (s, t) => {
      if (!t) return s;
      const n = adjustTimer(t, deltaSec);
      return { ...s, restEndsAt: n.endsAt, restTotalMs: n.totalMs };
    },
    now,
  );

/** Imposta il recupero rimanente a un valore digitato (secondi da adesso). */
export const setRestSeconds = (sessionId: ID, seconds: number, now = Date.now()) =>
  writeTimer(
    sessionId,
    (s) => {
      const n = setRestRemaining(validRestSeconds(seconds), now);
      return { ...s, restEndsAt: n.endsAt, restTotalMs: n.totalMs };
    },
    now,
  );

export const skipRest = (sessionId: ID, now = Date.now()) => writeTimer(sessionId, (s) => clearRest(s), now);

// ------------------------------------------------------------------ Letture per la UI

export const getActiveSession = () => sessionsRepo.getActive();

export interface SessionView {
  session: Session;
  exercises: SessionExercise[];
  logs: SetLog[];
  stats: SessionStats;
}

export async function getSessionView(sessionId: ID): Promise<SessionView | undefined> {
  const session = await sessionsRepo.get(sessionId);
  if (!session) return undefined;
  const [exercises, logs] = await Promise.all([
    sessionExercisesRepo.listBySession(sessionId),
    setLogsRepo.listBySession(sessionId),
  ]);
  return { session, exercises, logs, stats: sessionStats(exercises, logs) };
}

export async function getMonthSessions(year: number, month0: number): Promise<Session[]> {
  const { start, endExclusive } = monthBounds(year, month0);
  return (await sessionsRepo.listByDateRange(start, endExclusive)).sort((a, b) => a.startedAt - b.startedAt);
}

export interface TodayDay {
  day: ProgramDay;
  exercises: number;
  lastDate?: string;
}

export interface TodayOverview {
  program: Program;
  days: TodayDay[];
}

/** Giorni della scheda attiva con numero di esercizi e data dell'ultima volta (sessioni concluse). */
export async function getTodayOverview(): Promise<TodayOverview | undefined> {
  const program = await programsRepo.getActive();
  if (!program) return undefined;
  const days = await daysRepo.listByProgram(program.id);
  const entries = days.length ? await programExercisesRepo.listByDays(days.map((d) => d.id)) : [];
  const sessions = (await sessionsRepo.listByProgram(program.id)).filter(
    (s) => s.status === 'completed',
  );
  return {
    program,
    days: days.map((day) => ({
      day,
      exercises: entries.filter((e) => e.dayId === day.id).length,
      lastDate: sessions
        .filter((s) => s.dayId === day.id)
        .map((s) => s.date)
        .sort()
        .pop(),
    })),
  };
}

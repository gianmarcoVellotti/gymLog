import { db } from '../db/db';
import { toLocalISODate } from '../domain/date';
import { DomainError, ERR } from '../domain/errors';
import { normalizeGroups } from '../domain/groups';
import type { Exercise, ID, PlannedSet, Program, ProgramDay, ProgramExercise, Tag } from '../domain/types';
import { validName, validPlannedSets, validRestSeconds, validTags } from '../domain/validation';
import { exercisesRepo } from '../repositories/catalog';
import { daysRepo, programExercisesRepo, programsRepo } from '../repositories/programs';

const PROGRAM_TABLES = [db.programs, db.programDays, db.programExercises];

// ---------------------------------------------------------------- Schede

export async function createProgram(name: string, now = Date.now()): Promise<Program> {
  const p: Program = { id: crypto.randomUUID(), name: validName(name), status: 'draft', createdAt: now };
  await programsRepo.add(p);
  return p;
}

export async function updateProgram(id: ID, patch: { name?: string; notes?: string }): Promise<void> {
  await db.transaction('rw', db.programs, async () => {
    const p = await programsRepo.get(id);
    if (!p) throw new DomainError(ERR.PROGRAM_NOT_FOUND);
    const next: Program = { ...p };
    if (patch.name !== undefined) next.name = validName(patch.name);
    if (patch.notes !== undefined) next.notes = patch.notes.trim() || undefined;
    await programsRepo.put(next);
  });
}

/** Copia una scheda (giorni ed esercizi) in una nuova scheda in bozza. */
export async function duplicateProgram(id: ID, name?: string, now = Date.now()): Promise<Program> {
  return db.transaction('rw', PROGRAM_TABLES, async () => {
    const src = await programsRepo.get(id);
    if (!src) throw new DomainError(ERR.PROGRAM_NOT_FOUND);
    const copy: Program = {
      id: crypto.randomUUID(),
      name: validName(name ?? `${src.name} (copia)`),
      status: 'draft',
      notes: src.notes,
      createdAt: now,
    };
    await programsRepo.add(copy);
    const days = await daysRepo.listByProgram(id);
    const groupMap = new Map<ID, ID>();
    for (const d of days) {
      const newDay: ProgramDay = { ...d, id: crypto.randomUUID(), programId: copy.id };
      await daysRepo.add(newDay);
      const items = await programExercisesRepo.listByDay(d.id);
      await programExercisesRepo.bulkAdd(
        items.map((it) => {
          let groupId = it.groupId;
          if (groupId) {
            if (!groupMap.has(groupId)) groupMap.set(groupId, crypto.randomUUID());
            groupId = groupMap.get(groupId);
          }
          return { ...it, id: crypto.randomUUID(), dayId: newDay.id, groupId, sets: it.sets.map((s) => ({ ...s })) };
        }),
      );
    }
    return copy;
  });
}

/**
 * Attiva una scheda (bozza o archiviata) archiviando quella corrente: UNA transazione,
 * quindi non esistono mai due schede attive.
 */
export async function activateProgram(id: ID, today = toLocalISODate()): Promise<void> {
  await db.transaction('rw', db.programs, async () => {
    const target = await programsRepo.get(id);
    if (!target) throw new DomainError(ERR.PROGRAM_NOT_FOUND);
    if (target.status === 'active') return;
    for (const other of await programsRepo.listByStatus('active')) {
      await programsRepo.put({ ...other, status: 'archived', endDate: today });
    }
    await programsRepo.put({ ...target, status: 'active', startDate: target.startDate ?? today, endDate: undefined });
  });
}

export async function archiveProgram(id: ID, today = toLocalISODate()): Promise<void> {
  await db.transaction('rw', db.programs, async () => {
    const p = await programsRepo.get(id);
    if (!p) throw new DomainError(ERR.PROGRAM_NOT_FOUND);
    if (p.status === 'archived') return;
    await programsRepo.put({ ...p, status: 'archived', endDate: today });
  });
}

/** Una scheda con almeno una sessione non si elimina mai: solo archiviazione. */
export async function deleteProgram(id: ID): Promise<void> {
  await db.transaction('rw', [...PROGRAM_TABLES, db.sessions], async () => {
    if (!(await programsRepo.get(id))) throw new DomainError(ERR.PROGRAM_NOT_FOUND);
    if ((await programsRepo.countSessions(id)) > 0) throw new DomainError(ERR.PROGRAM_HAS_SESSIONS);
    for (const d of await daysRepo.listByProgram(id)) await programExercisesRepo.removeByDay(d.id);
    await daysRepo.removeByProgram(id);
    await programsRepo.remove(id);
  });
}

// ---------------------------------------------------------------- Giorni

export async function addDay(programId: ID, input: { label: string; title?: string }): Promise<ProgramDay> {
  return db.transaction('rw', [db.programs, db.programDays], async () => {
    if (!(await programsRepo.get(programId))) throw new DomainError(ERR.PROGRAM_NOT_FOUND);
    const days = await daysRepo.listByProgram(programId);
    const day: ProgramDay = {
      id: crypto.randomUUID(),
      programId,
      order: days.length ? Math.max(...days.map((d) => d.order)) + 1 : 0,
      label: validName(input.label, 12),
      title: input.title?.trim() ? validName(input.title, 60) : undefined,
    };
    await daysRepo.add(day);
    return day;
  });
}

export async function updateDay(id: ID, patch: { label?: string; title?: string }): Promise<void> {
  await db.transaction('rw', db.programDays, async () => {
    const d = await daysRepo.get(id);
    if (!d) throw new DomainError(ERR.DAY_NOT_FOUND);
    const next = { ...d };
    if (patch.label !== undefined) next.label = validName(patch.label, 12);
    if (patch.title !== undefined) next.title = patch.title.trim() ? validName(patch.title, 60) : undefined;
    await daysRepo.put(next);
  });
}

/** Elimina il giorno e i suoi esercizi dalla scheda. Le sessioni passate non cambiano (snapshot). */
export async function deleteDay(id: ID): Promise<void> {
  await db.transaction('rw', [db.programDays, db.programExercises], async () => {
    if (!(await daysRepo.get(id))) throw new DomainError(ERR.DAY_NOT_FOUND);
    await programExercisesRepo.removeByDay(id);
    await daysRepo.remove(id);
  });
}

export async function moveDay(id: ID, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.programDays, async () => {
    const d = await daysRepo.get(id);
    if (!d) throw new DomainError(ERR.DAY_NOT_FOUND);
    const days = await daysRepo.listByProgram(d.programId);
    const i = days.findIndex((x) => x.id === id);
    const j = i + direction;
    const other = days[j];
    if (i < 0 || !other) return;
    await daysRepo.bulkPut([
      { ...d, order: other.order },
      { ...other, order: d.order },
    ]);
  });
}

// ---------------------------------------------------------------- Esercizi della scheda

export interface ProgramExerciseInput {
  exerciseId: ID;
  sets: PlannedSet[];
  restSeconds: number;
  tags?: Tag[];
  notes?: string;
}

export async function addProgramExercise(dayId: ID, input: ProgramExerciseInput): Promise<ProgramExercise> {
  return db.transaction('rw', [db.programDays, db.programExercises, db.exercises], async () => {
    if (!(await daysRepo.get(dayId))) throw new DomainError(ERR.DAY_NOT_FOUND);
    if (!(await exercisesRepo.get(input.exerciseId))) throw new DomainError(ERR.EXERCISE_NOT_FOUND);
    const items = await programExercisesRepo.listByDay(dayId);
    const pe: ProgramExercise = {
      id: crypto.randomUUID(),
      dayId,
      exerciseId: input.exerciseId,
      order: items.length ? Math.max(...items.map((i) => i.order)) + 1 : 0,
      sets: validPlannedSets(input.sets),
      restSeconds: validRestSeconds(input.restSeconds),
      tags: validTags(input.tags ?? []),
      notes: input.notes?.trim() || undefined,
    };
    await programExercisesRepo.add(pe);
    return pe;
  });
}

/** Modifica un esercizio della scheda (anche la sostituzione dell'esercizio): le sessioni passate non cambiano. */
export async function updateProgramExercise(id: ID, input: ProgramExerciseInput): Promise<void> {
  await db.transaction('rw', [db.programExercises, db.exercises], async () => {
    const pe = await programExercisesRepo.get(id);
    if (!pe) throw new DomainError(ERR.PROGRAM_EXERCISE_NOT_FOUND);
    if (!(await exercisesRepo.get(input.exerciseId))) throw new DomainError(ERR.EXERCISE_NOT_FOUND);
    await programExercisesRepo.put({
      ...pe,
      exerciseId: input.exerciseId,
      sets: validPlannedSets(input.sets),
      restSeconds: validRestSeconds(input.restSeconds),
      tags: validTags(input.tags ?? []),
      notes: input.notes?.trim() || undefined,
    });
  });
}

async function normalizeDay(dayId: ID): Promise<void> {
  const fix = normalizeGroups(await programExercisesRepo.listByDay(dayId));
  if (fix.length) await programExercisesRepo.bulkPut(fix);
}

export async function deleteProgramExercise(id: ID): Promise<void> {
  await db.transaction('rw', db.programExercises, async () => {
    const pe = await programExercisesRepo.get(id);
    if (!pe) throw new DomainError(ERR.PROGRAM_EXERCISE_NOT_FOUND);
    await programExercisesRepo.remove(id);
    await normalizeDay(pe.dayId);
  });
}

export async function moveProgramExercise(id: ID, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.programExercises, async () => {
    const pe = await programExercisesRepo.get(id);
    if (!pe) throw new DomainError(ERR.PROGRAM_EXERCISE_NOT_FOUND);
    const items = await programExercisesRepo.listByDay(pe.dayId);
    const i = items.findIndex((x) => x.id === id);
    const other = items[i + direction];
    if (i < 0 || !other) return;
    await programExercisesRepo.bulkPut([
      { ...pe, order: other.order },
      { ...other, order: pe.order },
    ]);
    await normalizeDay(pe.dayId); // un superset non più consecutivo viene sciolto
  });
}

/** Collega/scollega un esercizio al successivo (superset = gruppo unico). */
export async function setLinkedWithNext(id: ID, linked: boolean): Promise<void> {
  await db.transaction('rw', db.programExercises, async () => {
    const pe = await programExercisesRepo.get(id);
    if (!pe) throw new DomainError(ERR.PROGRAM_EXERCISE_NOT_FOUND);
    const items = await programExercisesRepo.listByDay(pe.dayId);
    const i = items.findIndex((x) => x.id === id);
    const next = items[i + 1];
    if (i < 0 || !next) return;
    if (linked) {
      const gid = pe.groupId ?? next.groupId ?? crypto.randomUUID();
      const absorbed = new Set([pe.groupId, next.groupId].filter((g): g is ID => !!g));
      const updates = items
        .filter((it) => it.id === pe.id || it.id === next.id || (it.groupId && absorbed.has(it.groupId)))
        .map((it) => ({ ...it, groupId: gid }));
      await programExercisesRepo.bulkPut(updates);
    } else if (pe.groupId && next.groupId === pe.groupId) {
      // Spezza il gruppo tra `pe` e `next`: la coda riceve un nuovo groupId.
      const tailId = crypto.randomUUID();
      const tail = items.slice(i + 1).filter((it) => it.groupId === pe.groupId);
      await programExercisesRepo.bulkPut(tail.map((it) => ({ ...it, groupId: tailId })));
    }
    await normalizeDay(pe.dayId);
  });
}

// ---------------------------------------------------------------- Letture per la UI

export interface ProgramSummary {
  program: Program;
  days: number;
  exercises: number;
  sessions: number;
}

export async function listProgramSummaries(): Promise<ProgramSummary[]> {
  const programs = await programsRepo.list();
  return Promise.all(
    programs.map(async (program) => {
      const days = await daysRepo.listByProgram(program.id);
      const exercises = days.length ? (await programExercisesRepo.listByDays(days.map((d) => d.id))).length : 0;
      return { program, days: days.length, exercises, sessions: await programsRepo.countSessions(program.id) };
    }),
  );
}

export interface DayItem {
  item: ProgramExercise;
  exercise: Exercise;
}

export interface DayDetail {
  program: Program;
  day: ProgramDay;
  items: DayItem[];
}

export async function getDayDetail(dayId: ID): Promise<DayDetail | undefined> {
  const day = await daysRepo.get(dayId);
  if (!day) return undefined;
  const program = await programsRepo.get(day.programId);
  if (!program) return undefined;
  const items = await programExercisesRepo.listByDay(dayId);
  const exercises = await exercisesRepo.bulkGet(items.map((i) => i.exerciseId));
  return {
    program,
    day,
    items: items.flatMap((item, i) => {
      const exercise = exercises[i];
      return exercise ? [{ item, exercise }] : [];
    }),
  };
}

export interface ProgramDetail {
  program: Program;
  days: { day: ProgramDay; exercises: number }[];
  sessions: number;
}

export async function getProgramDetail(id: ID): Promise<ProgramDetail | undefined> {
  const program = await programsRepo.get(id);
  if (!program) return undefined;
  const days = await daysRepo.listByProgram(id);
  const all = days.length ? await programExercisesRepo.listByDays(days.map((d) => d.id)) : [];
  return {
    program,
    days: days.map((day) => ({ day, exercises: all.filter((e) => e.dayId === day.id).length })),
    sessions: await programsRepo.countSessions(id),
  };
}

export const getActiveProgram = () => programsRepo.getActive();
export const getProgram = (id: ID) => programsRepo.get(id);

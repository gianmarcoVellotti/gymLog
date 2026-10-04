import { db } from '../db/db';
import { normalizeName } from '../domain/calc';
import type { Exercise, ID, Metric, PlannedSet, Program, WeightMode } from '../domain/types';
import { exercisesRepo } from '../repositories/catalog';
import { createExercise, listMuscleGroups } from '../services/catalog';
import { activateProgram, addDay, addProgramExercise, createProgram } from '../services/programs';

/** DB pulito a ogni test (le tabelle e i distretti preset vengono ricreati da `populate`). */
export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

export async function ensureExercise(
  name: string,
  opts: { group?: string; metric?: Metric; weightMode?: WeightMode; tareKg?: number } = {},
): Promise<Exercise> {
  const existing = await exercisesRepo.findActiveByNameKey(normalizeName(name));
  if (existing) return existing;
  const groups = await listMuscleGroups();
  const group = groups.find((g) => g.name === (opts.group ?? 'Petto'));
  if (!group) throw new Error(`distretto inesistente: ${opts.group}`);
  return createExercise({
    name,
    muscleGroupId: group.id,
    metric: opts.metric ?? 'weightReps',
    weightMode: opts.weightMode ?? 'perSide',
    tareKg: opts.tareKg,
  });
}

export const sets = (reps: number[], kind: PlannedSet['kind'] = 'normal'): PlannedSet[] =>
  reps.map((r) => ({ kind, repsMin: r, repsMax: r }));

export interface DayFixture {
  label: string;
  title?: string;
  exercises: {
    name: string;
    group?: string;
    metric?: Metric;
    weightMode?: WeightMode;
    sets: PlannedSet[];
    rest?: number;
    groupWithNext?: boolean;
  }[];
}

/** Crea una scheda con giorni ed esercizi usando i service (non scrive direttamente nel DB). */
export async function makeProgram(
  name: string,
  days: DayFixture[],
  opts: { activate?: boolean } = {},
): Promise<{ program: Program; dayIds: ID[]; exerciseIds: Record<string, ID>; programExerciseIds: ID[][] }> {
  const program = await createProgram(name);
  const dayIds: ID[] = [];
  const exerciseIds: Record<string, ID> = {};
  const programExerciseIds: ID[][] = [];
  for (const d of days) {
    const day = await addDay(program.id, { label: d.label, title: d.title });
    dayIds.push(day.id);
    const ids: ID[] = [];
    for (const e of d.exercises) {
      const ex = await ensureExercise(e.name, e);
      exerciseIds[e.name] = ex.id;
      const pe = await addProgramExercise(day.id, { exerciseId: ex.id, sets: e.sets, restSeconds: e.rest ?? 90 });
      ids.push(pe.id);
    }
    programExerciseIds.push(ids);
  }
  if (opts.activate) await activateProgram(program.id);
  return { program, dayIds, exerciseIds, programExerciseIds };
}

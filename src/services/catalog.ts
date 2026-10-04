import { db } from '../db/db';
import { normalizeName } from '../domain/calc';
import { DomainError, ERR } from '../domain/errors';
import type { Exercise, ID, Metric, MuscleGroup, WeightMode } from '../domain/types';
import { validName, validWeight } from '../domain/validation';
import { exercisesRepo, muscleGroupsRepo } from '../repositories/catalog';

export interface ExerciseInput {
  name: string;
  muscleGroupId: ID;
  metric: Metric;
  weightMode: WeightMode;
  tareKg?: number;
}

function normalizeInput(input: ExerciseInput) {
  const name = validName(input.name);
  // Senza peso (solo ripetizioni) weightMode/tara non hanno significato: valori neutri.
  const usesWeight = input.metric === 'weightReps';
  return {
    name,
    nameKey: normalizeName(name),
    metric: input.metric,
    weightMode: usesWeight ? input.weightMode : ('total' as WeightMode),
    tareKg: usesWeight && input.weightMode === 'perSide' ? validWeight(input.tareKg ?? 0) : 0,
  };
}

// ---- Esercizi ----

export async function createExercise(input: ExerciseInput, now = Date.now()): Promise<Exercise> {
  const n = normalizeInput(input);
  return db.transaction('rw', [db.exercises, db.muscleGroups], async () => {
    if (!(await muscleGroupsRepo.get(input.muscleGroupId))) throw new DomainError(ERR.MUSCLE_GROUP_NOT_FOUND);
    if (await exercisesRepo.findActiveByNameKey(n.nameKey)) throw new DomainError(ERR.EXERCISE_NAME_EXISTS);
    const ex: Exercise = {
      id: crypto.randomUUID(),
      ...n,
      muscleGroupId: input.muscleGroupId,
      archived: false,
      createdAt: now,
    };
    await exercisesRepo.add(ex);
    return ex;
  });
}

export async function updateExercise(id: ID, input: ExerciseInput): Promise<Exercise> {
  const n = normalizeInput(input);
  return db.transaction('rw', [db.exercises, db.muscleGroups], async () => {
    const ex = await exercisesRepo.get(id);
    if (!ex) throw new DomainError(ERR.EXERCISE_NOT_FOUND);
    if (!(await muscleGroupsRepo.get(input.muscleGroupId))) throw new DomainError(ERR.MUSCLE_GROUP_NOT_FOUND);
    const clash = await exercisesRepo.findActiveByNameKey(n.nameKey);
    if (clash && clash.id !== id && !ex.archived) throw new DomainError(ERR.EXERCISE_NAME_EXISTS);
    const next: Exercise = { ...ex, ...n, muscleGroupId: input.muscleGroupId };
    await exercisesRepo.put(next);
    return next;
  });
}

export async function setExerciseArchived(id: ID, archived: boolean): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const ex = await exercisesRepo.get(id);
    if (!ex) throw new DomainError(ERR.EXERCISE_NOT_FOUND);
    if (!archived) {
      const clash = await exercisesRepo.findActiveByNameKey(ex.nameKey);
      if (clash && clash.id !== id) throw new DomainError(ERR.EXERCISE_NAME_EXISTS);
    }
    await exercisesRepo.put({ ...ex, archived });
  });
}

/** Elimina solo se senza storico e non usato in nessuna scheda; altrimenti va archiviato. */
export async function deleteExercise(id: ID): Promise<void> {
  await db.transaction('rw', [db.exercises, db.setLogs, db.programExercises], async () => {
    if (!(await exercisesRepo.get(id))) throw new DomainError(ERR.EXERCISE_NOT_FOUND);
    if ((await exercisesRepo.countHistory(id)) > 0) throw new DomainError(ERR.EXERCISE_HAS_HISTORY);
    if ((await exercisesRepo.countInPrograms(id)) > 0) throw new DomainError(ERR.EXERCISE_IN_USE);
    await exercisesRepo.remove(id);
  });
}

export const listExercises = (includeArchived = false) => exercisesRepo.list(includeArchived);
export const getExercise = (id: ID) => exercisesRepo.get(id);

export async function getExerciseUsage(id: ID): Promise<{ historySets: number; programs: number }> {
  const [historySets, programs] = await Promise.all([exercisesRepo.countHistory(id), exercisesRepo.countInPrograms(id)]);
  return { historySets, programs };
}

// ---- Distretti muscolari ----

export async function createMuscleGroup(name: string): Promise<MuscleGroup> {
  const clean = validName(name, 40);
  return db.transaction('rw', db.muscleGroups, async () => {
    const nameKey = normalizeName(clean);
    if (await muscleGroupsRepo.findByNameKey(nameKey)) throw new DomainError(ERR.MUSCLE_GROUP_NAME_EXISTS);
    const g: MuscleGroup = {
      id: crypto.randomUUID(),
      name: clean,
      nameKey,
      order: (await muscleGroupsRepo.maxOrder()) + 1,
      archived: false,
    };
    await muscleGroupsRepo.add(g);
    return g;
  });
}

export async function renameMuscleGroup(id: ID, name: string): Promise<void> {
  const clean = validName(name, 40);
  await db.transaction('rw', db.muscleGroups, async () => {
    const g = await muscleGroupsRepo.get(id);
    if (!g) throw new DomainError(ERR.MUSCLE_GROUP_NOT_FOUND);
    const nameKey = normalizeName(clean);
    const clash = await muscleGroupsRepo.findByNameKey(nameKey);
    if (clash && clash.id !== id) throw new DomainError(ERR.MUSCLE_GROUP_NAME_EXISTS);
    await muscleGroupsRepo.put({ ...g, name: clean, nameKey });
  });
}

/** I distretti non si eliminano: si archiviano (i nomi nelle sessioni passate sono snapshot). */
export async function setMuscleGroupArchived(id: ID, archived: boolean): Promise<void> {
  await db.transaction('rw', db.muscleGroups, async () => {
    const g = await muscleGroupsRepo.get(id);
    if (!g) throw new DomainError(ERR.MUSCLE_GROUP_NOT_FOUND);
    if (!archived) {
      const clash = await muscleGroupsRepo.findByNameKey(g.nameKey);
      if (clash && clash.id !== id) throw new DomainError(ERR.MUSCLE_GROUP_NAME_EXISTS);
    }
    await muscleGroupsRepo.put({ ...g, archived });
  });
}

export const listMuscleGroups = (includeArchived = false) => muscleGroupsRepo.list(includeArchived);

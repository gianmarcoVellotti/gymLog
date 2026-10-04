import Dexie from 'dexie';
import { db } from '../db/db';
import type { Exercise, ID, MuscleGroup } from '../domain/types';

export const muscleGroupsRepo = {
  async list(includeArchived = false): Promise<MuscleGroup[]> {
    const all = await db.muscleGroups.orderBy('order').toArray();
    return includeArchived ? all : all.filter((g) => !g.archived);
  },
  get: (id: ID) => db.muscleGroups.get(id),
  async findByNameKey(nameKey: string): Promise<MuscleGroup | undefined> {
    return (await db.muscleGroups.where('nameKey').equals(nameKey).toArray()).find((g) => !g.archived);
  },
  async add(g: MuscleGroup): Promise<void> {
    await db.muscleGroups.add(g);
  },
  async put(g: MuscleGroup): Promise<void> {
    await db.muscleGroups.put(g);
  },
  async maxOrder(): Promise<number> {
    const last = await db.muscleGroups.orderBy('order').last();
    return last ? last.order : -1;
  },
};

export const exercisesRepo = {
  get: (id: ID) => db.exercises.get(id),
  bulkGet: (ids: ID[]) => db.exercises.bulkGet(ids),
  async list(includeArchived = false): Promise<Exercise[]> {
    const all = await db.exercises.orderBy('nameKey').toArray();
    return includeArchived ? all : all.filter((e) => !e.archived);
  },
  async findActiveByNameKey(nameKey: string): Promise<Exercise | undefined> {
    return (await db.exercises.where('nameKey').equals(nameKey).toArray()).find((e) => !e.archived);
  },
  async add(e: Exercise): Promise<void> {
    await db.exercises.add(e);
  },
  async put(e: Exercise): Promise<void> {
    await db.exercises.put(e);
  },
  async remove(id: ID): Promise<void> {
    await db.exercises.delete(id);
  },
  countInPrograms: (id: ID) => db.programExercises.where('exerciseId').equals(id).count(),
  countInGroup: (muscleGroupId: ID) => db.exercises.where('muscleGroupId').equals(muscleGroupId).count(),
  countHistory: (id: ID) =>
    db.setLogs.where('[exerciseId+completedAt]').between([id, Dexie.minKey], [id, Dexie.maxKey]).count(),
};

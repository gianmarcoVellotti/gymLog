import { db } from '../db/db';
import type { ID, Program, ProgramDay, ProgramExercise } from '../domain/types';

export const programsRepo = {
  get: (id: ID) => db.programs.get(id),
  async list(): Promise<Program[]> {
    return (await db.programs.toArray()).sort((a, b) => b.createdAt - a.createdAt);
  },
  async getActive(): Promise<Program | undefined> {
    return db.programs.where('status').equals('active').first();
  },
  listByStatus: (status: Program['status']) => db.programs.where('status').equals(status).toArray(),
  async add(p: Program): Promise<void> {
    await db.programs.add(p);
  },
  async put(p: Program): Promise<void> {
    await db.programs.put(p);
  },
  async remove(id: ID): Promise<void> {
    await db.programs.delete(id);
  },
  countSessions: (programId: ID) => db.sessions.where('programId').equals(programId).count(),
};

export const daysRepo = {
  get: (id: ID) => db.programDays.get(id),
  async listByProgram(programId: ID): Promise<ProgramDay[]> {
    return (await db.programDays.where('programId').equals(programId).toArray()).sort((a, b) => a.order - b.order);
  },
  async add(d: ProgramDay): Promise<void> {
    await db.programDays.add(d);
  },
  async put(d: ProgramDay): Promise<void> {
    await db.programDays.put(d);
  },
  async bulkPut(ds: ProgramDay[]): Promise<void> {
    await db.programDays.bulkPut(ds);
  },
  async remove(id: ID): Promise<void> {
    await db.programDays.delete(id);
  },
  async removeByProgram(programId: ID): Promise<void> {
    await db.programDays.where('programId').equals(programId).delete();
  },
};

export const programExercisesRepo = {
  get: (id: ID) => db.programExercises.get(id),
  async listByDay(dayId: ID): Promise<ProgramExercise[]> {
    return (await db.programExercises.where('dayId').equals(dayId).toArray()).sort((a, b) => a.order - b.order);
  },
  async listByDays(dayIds: ID[]): Promise<ProgramExercise[]> {
    return db.programExercises.where('dayId').anyOf(dayIds).toArray();
  },
  async add(e: ProgramExercise): Promise<void> {
    await db.programExercises.add(e);
  },
  async bulkAdd(es: ProgramExercise[]): Promise<void> {
    await db.programExercises.bulkAdd(es);
  },
  async put(e: ProgramExercise): Promise<void> {
    await db.programExercises.put(e);
  },
  async bulkPut(es: ProgramExercise[]): Promise<void> {
    await db.programExercises.bulkPut(es);
  },
  async remove(id: ID): Promise<void> {
    await db.programExercises.delete(id);
  },
  async removeByDay(dayId: ID): Promise<void> {
    await db.programExercises.where('dayId').equals(dayId).delete();
  },
};

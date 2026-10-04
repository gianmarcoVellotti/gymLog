import Dexie, { type EntityTable } from 'dexie';
import { normalizeName } from '../domain/calc';
import type {
  Exercise,
  MuscleGroup,
  Program,
  ProgramDay,
  ProgramExercise,
  Session,
  SessionExercise,
  SetLog,
  Settings,
} from '../domain/types';

/** Distretti preimpostati al primo avvio: rinominabili, archiviabili, estendibili. */
export const DEFAULT_MUSCLE_GROUPS = [
  'Petto',
  'Schiena',
  'Spalle',
  'Bicipiti',
  'Tricipiti',
  'Avambracci',
  'Quadricipiti',
  'Femorali',
  'Glutei',
  'Polpacci',
  'Addome',
  'Cardio',
] as const;

export const DEFAULT_WEIGHT_STEP_KG = 2.5;

/** Versione dello schema, usata anche come schemaVersion dei backup. */
export const SCHEMA_VERSION = 1;

export class GymDB extends Dexie {
  muscleGroups!: EntityTable<MuscleGroup, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  programs!: EntityTable<Program, 'id'>;
  programDays!: EntityTable<ProgramDay, 'id'>;
  programExercises!: EntityTable<ProgramExercise, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionExercises!: EntityTable<SessionExercise, 'id'>;
  setLogs!: EntityTable<SetLog, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'gymLog') {
    super(name);

    // Ogni cambio di schema = NUOVA db.version(n) con upgrade(); mai modificare versioni già rilasciate.
    this.version(SCHEMA_VERSION).stores({
      muscleGroups: 'id, nameKey, order',
      exercises: 'id, nameKey, muscleGroupId',
      programs: 'id, status',
      programDays: 'id, programId',
      programExercises: 'id, dayId, exerciseId',
      sessions: 'id, date, status, programId',
      sessionExercises: 'id, sessionId, exerciseId',
      setLogs: 'id, sessionExerciseId, sessionId, [exerciseId+completedAt]',
      settings: 'id',
    });

    this.on('populate', (tx) => {
      DEFAULT_MUSCLE_GROUPS.forEach((name, order) => {
        void tx.table('muscleGroups').add({
          id: crypto.randomUUID(),
          name,
          nameKey: normalizeName(name),
          order,
          archived: false,
        } satisfies MuscleGroup);
      });
      void tx.table('settings').add({ id: 'main', weightStepKg: DEFAULT_WEIGHT_STEP_KG } satisfies Settings);
    });
  }
}

export const db = new GymDB();

/** Tabelle in ordine stabile: usato da backup e da test. */
export const TABLE_NAMES = [
  'muscleGroups',
  'exercises',
  'programs',
  'programDays',
  'programExercises',
  'sessions',
  'sessionExercises',
  'setLogs',
  'settings',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

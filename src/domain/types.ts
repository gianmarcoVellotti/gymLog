// Modello dati di gymLog — vedi docs/DESIGN.md §3.
export type ID = string;
/** Data LOCALE nel formato YYYY-MM-DD. Si ottiene solo con toLocalISODate(). */
export type ISODate = string;

export type Metric = 'weightReps' | 'reps';
export type WeightMode = 'perSide' | 'total';
export type SetKind = 'normal' | 'warmup' | 'amrap' | 'drop';
export type Tag = 'slow' | 'iso';
export type ProgramStatus = 'draft' | 'active' | 'archived';
export type SessionStatus = 'active' | 'completed';

export interface MuscleGroup {
  id: ID;
  name: string;
  nameKey: string;
  order: number;
  archived: boolean;
}

export interface Exercise {
  id: ID;
  name: string;
  /** Nome normalizzato (vedi normalizeName): univoco tra gli esercizi non archiviati. */
  nameKey: string;
  muscleGroupId: ID;
  metric: Metric;
  /** Rilevante solo con metric = 'weightReps'. */
  weightMode: WeightMode;
  /** Tara (es. peso del bilanciere) sommata al totale quando weightMode = 'perSide'. */
  tareKg: number;
  archived: boolean;
  createdAt: number;
}

export interface Program {
  id: ID;
  name: string;
  status: ProgramStatus;
  startDate?: ISODate;
  endDate?: ISODate;
  notes?: string;
  createdAt: number;
}

export interface ProgramDay {
  id: ID;
  programId: ID;
  order: number;
  label: string;
  title?: string;
}

export interface PlannedSet {
  kind: SetKind;
  repsMin?: number;
  repsMax?: number;
}

export interface ProgramExercise {
  id: ID;
  dayId: ID;
  exerciseId: ID;
  order: number;
  /** Una voce per serie: [8,8,6,6] sono 4 elementi. */
  sets: PlannedSet[];
  restSeconds: number;
  tags: Tag[];
  notes?: string;
  /** Stesso groupId su esercizi consecutivi = superset (gruppo unico, un solo recupero). */
  groupId?: ID;
}

export interface Session {
  id: ID;
  date: ISODate;
  programId: ID;
  dayId: ID;
  programName: string;
  dayLabel: string;
  dayTitle?: string;
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;
  endedBy?: 'manual' | 'auto';
  lastActivityAt: number;
  restEndsAt?: number;
  restTotalMs?: number;
  restSessionExerciseId?: ID;
  notes?: string;
}

export interface SuggestedSet {
  weightKg?: number;
  reps?: number;
}

export interface SessionExercise {
  id: ID;
  sessionId: ID;
  exerciseId: ID;
  order: number;
  groupId?: ID;
  exerciseName: string;
  muscleGroupName: string;
  metric: Metric;
  weightMode: WeightMode;
  tareKg: number;
  plannedSets: PlannedSet[];
  restSeconds: number;
  tags: Tag[];
  notes?: string;
  suggestions: SuggestedSet[];
}

export interface SetLog {
  id: ID;
  sessionExerciseId: ID;
  sessionId: ID;
  exerciseId: ID;
  setNumber: number;
  kind: SetKind;
  reps?: number;
  /** Valore INSERITO: per lato o totale, secondo weightMode dello snapshot. */
  weightKg?: number;
  rir?: number;
  note?: string;
  completedAt: number;
}

export interface Settings {
  id: 'main';
  weightStepKg: number;
  lastBackupAt?: number;
}

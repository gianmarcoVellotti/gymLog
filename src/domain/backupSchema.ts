import { DomainError, ERR } from './errors';
import { validPlannedSets, validReps, validRestSeconds, validRir, validWeight } from './validation';

// Specifica dei campi per tabella. 'x?' = opzionale. {oneOf} = valore ammesso da elenco.
type Spec = 'string' | 'number' | 'boolean' | 'array' | `${'string' | 'number' | 'boolean' | 'array'}?` | {
  oneOf: readonly string[];
  optional?: boolean;
};
type TableSpec = Record<string, Spec>;

const STATUS_PROGRAM = ['draft', 'active', 'archived'] as const;
const METRIC = ['weightReps', 'reps'] as const;
const WEIGHT_MODE = ['perSide', 'total'] as const;
const SESSION_STATUS = ['active', 'completed'] as const;
const KIND = ['normal', 'warmup', 'amrap', 'drop'] as const;

export const TABLE_SPECS = {
  muscleGroups: { id: 'string', name: 'string', nameKey: 'string', order: 'number', archived: 'boolean' },
  exercises: {
    id: 'string', name: 'string', nameKey: 'string', muscleGroupId: 'string',
    metric: { oneOf: METRIC }, weightMode: { oneOf: WEIGHT_MODE }, tareKg: 'number', archived: 'boolean', createdAt: 'number',
  },
  programs: {
    id: 'string', name: 'string', status: { oneOf: STATUS_PROGRAM },
    startDate: 'string?', endDate: 'string?', notes: 'string?', createdAt: 'number',
  },
  programDays: { id: 'string', programId: 'string', order: 'number', label: 'string', title: 'string?' },
  programExercises: {
    id: 'string', dayId: 'string', exerciseId: 'string', order: 'number', sets: 'array',
    restSeconds: 'number', tags: 'array', notes: 'string?', groupId: 'string?',
  },
  sessions: {
    id: 'string', date: 'string', programId: 'string', dayId: 'string', programName: 'string', dayLabel: 'string',
    dayTitle: 'string?', status: { oneOf: SESSION_STATUS }, startedAt: 'number', endedAt: 'number?',
    endedBy: { oneOf: ['manual', 'auto'], optional: true }, lastActivityAt: 'number',
    restEndsAt: 'number?', restTotalMs: 'number?', restSessionExerciseId: 'string?', notes: 'string?',
  },
  sessionExercises: {
    id: 'string', sessionId: 'string', exerciseId: 'string', order: 'number', groupId: 'string?',
    exerciseName: 'string', muscleGroupName: 'string', metric: { oneOf: METRIC }, weightMode: { oneOf: WEIGHT_MODE },
    tareKg: 'number', plannedSets: 'array', restSeconds: 'number', tags: 'array', notes: 'string?', suggestions: 'array',
  },
  setLogs: {
    id: 'string', sessionExerciseId: 'string', sessionId: 'string', exerciseId: 'string', setNumber: 'number',
    kind: { oneOf: KIND }, reps: 'number?', weightKg: 'number?', rir: 'number?', note: 'string?', completedAt: 'number',
  },
  settings: { id: { oneOf: ['main'] }, weightStepKg: 'number', lastBackupAt: 'number?' },
} satisfies Record<string, TableSpec>;

const bad = (msg: string): never => {
  throw new DomainError(ERR.BACKUP_INVALID, msg);
};

function checkValue(table: string, field: string, spec: Spec, value: unknown): void {
  const where = `${table}.${field}`;
  if (typeof spec === 'object') {
    if (value === undefined && spec.optional) return;
    if (typeof value !== 'string' || !spec.oneOf.includes(value)) bad(`${where}: valore non ammesso`);
    return;
  }
  const optional = spec.endsWith('?');
  const base = optional ? spec.slice(0, -1) : spec;
  if (value === undefined) {
    if (!optional) bad(`${where}: campo mancante`);
    return;
  }
  const ok =
    base === 'array' ? Array.isArray(value) : base === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === base;
  if (!ok) bad(`${where}: tipo non valido`);
}

/** Valida e ripulisce una riga (campi sconosciuti scartati). */
export function validateRow(table: keyof typeof TABLE_SPECS, row: unknown): Record<string, unknown> {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return bad(`${table}: riga non valida`);
  const src = row as Record<string, unknown>;
  const spec: TableSpec = TABLE_SPECS[table];
  const out: Record<string, unknown> = {};
  for (const [field, s] of Object.entries(spec)) {
    checkValue(table, field, s, src[field]);
    if (src[field] !== undefined) out[field] = src[field];
  }
  validateLimits(table, out);
  return out;
}

/** Limiti di valore (stessi del service): un backup non può reintrodurre dati che l'app rifiuterebbe. */
function validateLimits(table: string, row: Record<string, unknown>): void {
  try {
    if (table === 'setLogs') {
      if (row.weightKg !== undefined) validWeight(row.weightKg);
      if (row.reps !== undefined) validReps(row.reps);
      if (row.rir !== undefined) validRir(row.rir);
      if (!Number.isInteger(row.setNumber) || (row.setNumber as number) < 1) bad('setLogs.setNumber non valido');
    } else if (table === 'exercises') {
      validWeight(row.tareKg);
    } else if (table === 'programExercises') {
      validRestSeconds(row.restSeconds);
      validPlannedSets(row.sets);
    } else if (table === 'sessionExercises') {
      validRestSeconds(row.restSeconds);
      validWeight(row.tareKg);
      validPlannedSets(row.plannedSets);
    }
  } catch (e) {
    if (e instanceof DomainError && e.code === ERR.BACKUP_INVALID) throw e;
    return bad(`${table}: valore fuori limiti`);
  }
}

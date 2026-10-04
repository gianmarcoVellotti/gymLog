import { db, SCHEMA_VERSION, TABLE_NAMES, type TableName } from '../db/db';
import { TABLE_SPECS, validateRow } from '../domain/backupSchema';
import { toLocalISODate } from '../domain/date';
import { DomainError, ERR } from '../domain/errors';
import { backupRepo, type TableDump } from '../repositories/backup';
import { settingsRepo } from '../repositories/settings';

export const BACKUP_APP = 'gymLog';

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  data: TableDump;
}

const ALL_TABLES = () => TABLE_NAMES.map((n) => db.table(n));

/** Esporta TUTTE le tabelle in un envelope versionato (JSON). */
export async function buildBackup(now = Date.now()): Promise<{ fileName: string; json: string }> {
  const data = await db.transaction('r', ALL_TABLES(), () => backupRepo.readAll());
  const file: BackupFile = { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: new Date(now).toISOString(), data };
  return { fileName: `gymLog-${toLocalISODate(new Date(now))}.json`, json: JSON.stringify(file) };
}

/** Migrazioni di backup da una versione alla successiva (vuoto finché esiste solo la v1). */
const BACKUP_MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

function migrateBackup(data: Record<string, unknown>, from: number): Record<string, unknown> {
  let current = data;
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = BACKUP_MIGRATIONS[v];
    if (!step) throw new DomainError(ERR.BACKUP_INVALID, `Nessuna migrazione da v${v}`);
    current = step(current);
  }
  return current;
}

/** Parsing + validazione di forma, versione, limiti e integrità referenziale. Non tocca il DB. */
export function parseBackup(text: string): TableDump {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DomainError(ERR.BACKUP_INVALID, 'Il file non è un JSON valido');
  }
  if (typeof raw !== 'object' || raw === null) throw new DomainError(ERR.BACKUP_INVALID);
  const file = raw as Record<string, unknown>;
  if (file.app !== BACKUP_APP) throw new DomainError(ERR.BACKUP_INVALID, 'Non è un backup di gymLog');
  const version = file.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new DomainError(ERR.BACKUP_INVALID, 'schemaVersion non valida');
  if (version > SCHEMA_VERSION) throw new DomainError(ERR.BACKUP_FUTURE_VERSION);
  if (typeof file.data !== 'object' || file.data === null || Array.isArray(file.data))
    throw new DomainError(ERR.BACKUP_INVALID, 'Dati mancanti');

  const data = migrateBackup(file.data as Record<string, unknown>, version);
  const out = {} as TableDump;
  for (const name of TABLE_NAMES) {
    const rows = data[name];
    if (!Array.isArray(rows)) throw new DomainError(ERR.BACKUP_INVALID, `Tabella mancante: ${name}`);
    out[name] = rows.map((r) => validateRow(name as keyof typeof TABLE_SPECS, r));
  }
  checkIntegrity(out);
  return out;
}

type Row = Record<string, unknown>;

function checkIntegrity(d: TableDump): void {
  const rows = (t: TableName) => d[t] as Row[];
  const ids = {} as Record<TableName, Set<unknown>>;
  for (const name of TABLE_NAMES) {
    ids[name] = new Set<unknown>();
    for (const r of rows(name)) {
      if (ids[name].has(r.id)) throw new DomainError(ERR.BACKUP_INVALID, `${name}: id duplicato`);
      ids[name].add(r.id);
    }
  }
  const ref = (table: TableName, field: string, target: TableName) => {
    for (const r of rows(table))
      if (!ids[target].has(r[field])) throw new DomainError(ERR.BACKUP_INVALID, `${table}.${field}: riferimento inesistente`);
  };
  ref('exercises', 'muscleGroupId', 'muscleGroups');
  ref('programDays', 'programId', 'programs');
  ref('programExercises', 'dayId', 'programDays');
  ref('programExercises', 'exerciseId', 'exercises');
  ref('sessionExercises', 'sessionId', 'sessions');
  ref('sessionExercises', 'exerciseId', 'exercises');
  ref('setLogs', 'sessionExerciseId', 'sessionExercises');
  ref('setLogs', 'sessionId', 'sessions');
  ref('setLogs', 'exerciseId', 'exercises');

  const seById = new Map(rows('sessionExercises').map((r) => [r.id, r]));
  for (const l of rows('setLogs')) {
    const se = seById.get(l.sessionExerciseId);
    if (se && (se.sessionId !== l.sessionId || se.exerciseId !== l.exerciseId))
      throw new DomainError(ERR.BACKUP_INVALID, 'setLogs: riferimenti incoerenti');
  }
  if (rows('programs').filter((p) => p.status === 'active').length > 1)
    throw new DomainError(ERR.BACKUP_INVALID, 'Più di una scheda attiva');
  if (rows('sessions').filter((s) => s.status === 'active').length > 1)
    throw new DomainError(ERR.BACKUP_INVALID, 'Più di una sessione attiva');
  if (rows('settings').length > 1) throw new DomainError(ERR.BACKUP_INVALID, 'Impostazioni duplicate');
}

/**
 * "Sostituisci tutto": valida PRIMA di toccare il DB, poi svuota e riscrive in UNA transazione.
 * Qualsiasi errore lascia il DB invariato.
 */
export async function importBackup(text: string): Promise<void> {
  const data = parseBackup(text);
  if (data.settings.length === 0) data.settings = [await settingsRepo.get()];
  await db.transaction('rw', ALL_TABLES(), () => backupRepo.replaceAll(data));
}

import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../db/db';
import { DomainError, ERR } from '../domain/errors';
import { backupRepo } from '../repositories/backup';
import { makeProgram, resetDb, sets } from '../test/helpers';
import { buildBackup, importBackup, parseBackup } from './backup';
import { markBackupDone, setWeightStep, getSettings } from './settings';
import { setLinkedWithNext } from './programs';
import { endSession, getSessionView, logSet, startSession } from './sessions';

beforeEach(resetDb);

const T0 = new Date(2026, 9, 3, 10, 0, 0).getTime();

/** Dati realistici: 2 schede, superset, sessione conclusa e una attiva con timer in corso. */
async function populate() {
  const a = await makeProgram('Scheda 1', [
    { label: 'A', exercises: [
      { name: 'Panca', sets: sets([8, 8, 6, 6]), rest: 120 },
      { name: 'Croci', sets: sets([10, 10]), rest: 60 },
    ] },
    { label: 'B', exercises: [{ name: 'Squat', group: 'Quadricipiti', sets: sets([8, 8]) }] },
  ], { activate: true });
  await setLinkedWithNext(a.programExerciseIds[0]![0]!, true);

  const s1 = await startSession(a.dayIds[0]!, T0);
  const v1 = (await getSessionView(s1))!;
  await logSet({ sessionExerciseId: v1.exercises[0]!.id, setNumber: 1, kind: 'normal', weightKg: 12.5, reps: 8, rir: 2, note: 'ok' }, T0 + 1000);
  await logSet({ sessionExerciseId: v1.exercises[1]!.id, setNumber: 1, kind: 'normal', weightKg: 8, reps: 10 }, T0 + 2000);
  await endSession(s1, T0 + 40 * 60_000);

  await makeProgram('Scheda 2', [{ label: 'X', exercises: [{ name: 'Panca', sets: sets([5]) }] }]);
  const s2 = await startSession(a.dayIds[1]!, T0 + 24 * 3600_000);
  const v2 = (await getSessionView(s2))!;
  await logSet({ sessionExerciseId: v2.exercises[0]!.id, setNumber: 1, kind: 'normal', weightKg: 40, reps: 8 }, T0 + 24 * 3600_000 + 1000);

  await setWeightStep(1.25);
  await markBackupDone(T0);
}

const dump = () => backupRepo.readAll();

async function expectInvalid(text: string, code: string = ERR.BACKUP_INVALID) {
  const before = await dump();
  await expect(importBackup(text)).rejects.toSatisfy((e) => e instanceof DomainError && e.code === code);
  expect(await dump()).toEqual(before); // DB invariato
}

/** Backup valido da cui partire per costruire i casi malformati. */
async function validFile() {
  const { json } = await buildBackup(T0);
  return JSON.parse(json) as { app: string; schemaVersion: number; data: Record<string, Record<string, unknown>[]> };
}

describe('backup: round-trip', () => {
  it('export → svuota DB → import = dati identici', async () => {
    await populate();
    const original = await dump();
    const { json, fileName } = await buildBackup(T0);
    expect(fileName).toBe('gymLog-2026-10-03.json');
    expect(JSON.parse(json)).toMatchObject({ app: 'gymLog', schemaVersion: SCHEMA_VERSION });

    await resetDb(); // wipe: torna ai soli distretti preset
    expect((await dump()).sessions).toHaveLength(0);

    await importBackup(json);
    expect(await dump()).toEqual(original);
    expect(await getSettings()).toMatchObject({ weightStepKg: 1.25, lastBackupAt: T0 });
  });

  it('l\'import sostituisce tutto (non fonde con i dati presenti)', async () => {
    await populate();
    const { json } = await buildBackup(T0);
    await makeProgram('Scheda extra', [{ label: 'Q', exercises: [{ name: 'Extra', sets: sets([1]) }] }]);
    await importBackup(json);
    const programs = (await dump()).programs as { name: string }[];
    expect(programs.map((p) => p.name).sort()).toEqual(['Scheda 1', 'Scheda 2']);
  });

  it('la sessione attiva con il timer in corso sopravvive al round-trip', async () => {
    await populate();
    const { json } = await buildBackup(T0);
    await resetDb();
    await importBackup(json);
    const sessions = (await dump()).sessions as { status: string; restEndsAt?: number }[];
    const active = sessions.find((s) => s.status === 'active');
    expect(active?.restEndsAt).toBeDefined();
  });
});

describe('backup: file non valido → DomainError e DB invariato', () => {
  beforeEach(populate);

  it('JSON malformato o non di gymLog', async () => {
    await expectInvalid('questo non è json');
    await expectInvalid('[]');
    await expectInvalid(JSON.stringify({ app: 'altra-app', schemaVersion: 1, data: {} }));
  });

  it('schemaVersion futura → BACKUP_FUTURE_VERSION', async () => {
    const f = await validFile();
    await expectInvalid(JSON.stringify({ ...f, schemaVersion: SCHEMA_VERSION + 1 }), ERR.BACKUP_FUTURE_VERSION);
  });

  it('schemaVersion assente o non intera', async () => {
    const f = await validFile();
    await expectInvalid(JSON.stringify({ ...f, schemaVersion: '1' }));
    await expectInvalid(JSON.stringify({ ...f, schemaVersion: 0 }));
  });

  it('tabella mancante, riga con tipo sbagliato o valore non ammesso', async () => {
    const f = await validFile();
    const { sessions: _omit, ...withoutSessions } = f.data;
    await expectInvalid(JSON.stringify({ ...f, data: withoutSessions }));

    const wrongType = structuredClone(f);
    wrongType.data.exercises![0]!.name = 42;
    await expectInvalid(JSON.stringify(wrongType));

    const wrongEnum = structuredClone(f);
    wrongEnum.data.programs![0]!.status = 'boh';
    await expectInvalid(JSON.stringify(wrongEnum));
  });

  it('valori fuori dai limiti (peso, ripetizioni, serie)', async () => {
    const f = await validFile();
    const w = structuredClone(f);
    w.data.setLogs![0]!.weightKg = 5000;
    await expectInvalid(JSON.stringify(w));
    const r = structuredClone(f);
    r.data.setLogs![0]!.reps = 8.5;
    await expectInvalid(JSON.stringify(r));
    const s = structuredClone(f);
    s.data.programExercises![0]!.sets = [];
    await expectInvalid(JSON.stringify(s));
  });

  it('integrità referenziale: riferimenti inesistenti e id duplicati', async () => {
    const f = await validFile();
    const dangling = structuredClone(f);
    dangling.data.setLogs![0]!.sessionExerciseId = 'non-esiste';
    await expectInvalid(JSON.stringify(dangling));

    const dangling2 = structuredClone(f);
    dangling2.data.programDays![0]!.programId = 'non-esiste';
    await expectInvalid(JSON.stringify(dangling2));

    const dup = structuredClone(f);
    dup.data.exercises!.push({ ...dup.data.exercises![0]! });
    await expectInvalid(JSON.stringify(dup));

    const mismatch = structuredClone(f);
    mismatch.data.setLogs![0]!.sessionId = (f.data.sessions!.find((s) => s.id !== f.data.setLogs![0]!.sessionId)!.id) as string;
    await expectInvalid(JSON.stringify(mismatch));
  });

  it('più di una scheda o sessione attiva → rifiutato', async () => {
    const f = await validFile();
    const twoPrograms = structuredClone(f);
    for (const p of twoPrograms.data.programs!) p.status = 'active';
    await expectInvalid(JSON.stringify(twoPrograms));

    const twoSessions = structuredClone(f);
    for (const s of twoSessions.data.sessions!) s.status = 'active';
    await expectInvalid(JSON.stringify(twoSessions));
  });
});

describe('backup: validazione senza effetti', () => {
  it('parseBackup non tocca il DB e scarta i campi sconosciuti', async () => {
    await populate();
    const f = await validFile();
    f.data.exercises![0]!.campoStrano = 'x';
    const before = await dump();
    const parsed = parseBackup(JSON.stringify(f));
    expect(Object.keys(parsed.exercises[0] as object)).not.toContain('campoStrano');
    expect(await dump()).toEqual(before);
  });
});

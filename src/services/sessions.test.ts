import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError, ERR } from '../domain/errors';
import type { ID, SetKind } from '../domain/types';
import { sessionsRepo } from '../repositories/sessions';
import { ensureExercise, makeProgram, resetDb, sets } from '../test/helpers';
import { updateExercise, listMuscleGroups } from './catalog';
import { getExerciseHistory } from './progression';
import { activateProgram, setLinkedWithNext, updateProgramExercise } from './programs';
import {
  addSetToSessionExercise,
  adjustRest,
  AUTO_CLOSE_MS,
  autoCloseStaleSession,
  deleteSetLog,
  discardSession,
  endSession,
  getDayPlan,
  getMonthSessions,
  getSessionView,
  getTodayOverview,
  logSet,
  setRestSeconds,
  setSessionEnd,
  setSessionExerciseRest,
  skipRest,
  startSession,
  timerOf,
  updateSetLog,
} from './sessions';
import { remainingMs } from '../timer/rest';

beforeEach(resetDb);

const T0 = new Date(2026, 9, 3, 10, 0, 0).getTime();
const MIN = 60_000;

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e) => e instanceof DomainError && e.code === code);
}

/** Registra tutte le serie di un esercizio con i pesi dati; ritorna l'id del SessionExercise. */
async function logAll(sessionId: ID, exName: string, weights: number[], reps: number[], now = T0, kinds: SetKind[] = []) {
  const view = await getSessionView(sessionId);
  const se = view!.exercises.find((e) => e.exerciseName === exName)!;
  for (const [i, w] of weights.entries())
    await logSet({ sessionExerciseId: se.id, setNumber: i + 1, kind: kinds[i] ?? 'normal', weightKg: w, reps: reps[i] }, now + i * 1000);
  return se.id;
}

const simpleProgram = (name = 'Scheda 1', exs = ['Panca'], rest = 120) =>
  makeProgram(name, [{ label: 'A', title: 'Petto', exercises: exs.map((n) => ({ name: n, sets: sets([8, 8, 6, 6]), rest })) }], { activate: true });

describe('startSession', () => {
  it('crea sessione e snapshot degli esercizi (nomi, serie target, recupero, distretto)', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    const v = (await getSessionView(sid))!;
    expect(v.session).toMatchObject({
      status: 'active', date: '2026-10-03', programName: 'Scheda 1', dayLabel: 'A', dayTitle: 'Petto', startedAt: T0, lastActivityAt: T0,
    });
    expect(v.exercises).toHaveLength(1);
    expect(v.exercises[0]).toMatchObject({
      exerciseName: 'Panca', muscleGroupName: 'Petto', metric: 'weightReps', weightMode: 'perSide', restSeconds: 120,
    });
    expect(v.exercises[0]!.plannedSets.map((s) => s.repsMin)).toEqual([8, 8, 6, 6]); // 4 serie, rep diverse
    expect(v.exercises[0]!.suggestions).toEqual([{ reps: 8 }, { reps: 8 }, { reps: 6 }, { reps: 6 }]); // nessuna storia → solo reps
  });

  it('pre-compila i pesi dall\'ultima volta, anche tra schede diverse (stesso exerciseId)', async () => {
    const p1 = await simpleProgram('Scheda 1');
    const s1 = await startSession(p1.dayIds[0]!, T0);
    await logAll(s1, 'Panca', [10, 12.5, 15, 15], [8, 8, 6, 6]);
    await endSession(s1, T0 + 40 * MIN);

    const p2 = await makeProgram('Scheda 2', [{ label: 'A', exercises: [{ name: 'Panca', sets: sets([10, 10, 8, 8, 8]) }] }]);
    await activateProgram(p2.program.id);
    const s2 = await startSession(p2.dayIds[0]!, T0 + 7 * 24 * 60 * MIN);
    const v = (await getSessionView(s2))!;
    expect(v.exercises[0]!.suggestions).toEqual([
      { weightKg: 10, reps: 10 },
      { weightKg: 12.5, reps: 10 },
      { weightKg: 15, reps: 8 },
      { weightKg: 15, reps: 8 },
      { weightKg: 15, reps: 8 }, // la quinta serie usa l'ultimo peso disponibile
    ]);
  });

  it('la pre-compilazione tiene separati riscaldamento e serie di lavoro', async () => {
    const { dayIds } = await makeProgram('P', [
      { label: 'A', exercises: [{ name: 'Panca', sets: [{ kind: 'warmup', repsMin: 10 }, ...sets([8, 8])] }] },
    ], { activate: true });
    const s1 = await startSession(dayIds[0]!, T0);
    await logAll(s1, 'Panca', [5, 20, 22.5], [10, 8, 8], T0, ['warmup', 'normal', 'normal']);
    await endSession(s1, T0 + MIN);
    const s2 = await startSession(dayIds[0]!, T0 + 100 * MIN);
    expect((await getSessionView(s2))!.exercises[0]!.suggestions.map((s) => s.weightKg)).toEqual([5, 20, 22.5]);
  });

  it('l\'anteprima del giorno non scrive nulla', async () => {
    const { dayIds } = await simpleProgram();
    const plan = await getDayPlan(dayIds[0]!);
    expect(plan.items).toHaveLength(1);
    expect(await sessionsRepo.getActive()).toBeUndefined();
  });

  it('una sola sessione attiva alla volta', async () => {
    const { dayIds } = await simpleProgram();
    await startSession(dayIds[0]!, T0);
    await expectCode(startSession(dayIds[0]!, T0 + MIN), ERR.SESSION_ALREADY_ACTIVE);
  });

  it('giorno inesistente → DAY_NOT_FOUND', async () => {
    await expectCode(startSession('nope'), ERR.DAY_NOT_FOUND);
  });

  it('la data è quella LOCALE di inizio (mezzanotte, fuso Europe/Rome)', async () => {
    const { dayIds } = await simpleProgram();
    // 23:50 del 3 ottobre a Roma = 21:50 UTC dello stesso giorno
    const late = await startSession(dayIds[0]!, new Date(2026, 9, 3, 23, 50).getTime());
    expect((await sessionsRepo.get(late))!.date).toBe('2026-10-03');
    await logAll(late, 'Panca', [10], [8], new Date(2026, 9, 3, 23, 55).getTime());
    await endSession(late, new Date(2026, 9, 4, 0, 30).getTime()); // finisce dopo mezzanotte: la data resta quella di inizio
    expect((await sessionsRepo.get(late))!.date).toBe('2026-10-03');
    // 00:30 locale del 4 ottobre = 22:30 UTC del 3: deve finire il 4
    const early = await startSession(dayIds[0]!, Date.UTC(2026, 9, 3, 22, 30));
    expect((await sessionsRepo.get(early))!.date).toBe('2026-10-04');
  });
});

describe('storico immutabile', () => {
  it('modificare la scheda o rinominare l\'esercizio non cambia le sessioni passate', async () => {
    const { dayIds, programExerciseIds, exerciseIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    await logAll(sid, 'Panca', [10, 10, 10, 10], [8, 8, 6, 6]);
    await endSession(sid, T0 + 30 * MIN);
    const before = (await getSessionView(sid))!;

    await updateProgramExercise(programExerciseIds[0]![0]!, { exerciseId: exerciseIds['Panca']!, sets: sets([12, 12, 12]), restSeconds: 45 });
    const groups = await listMuscleGroups();
    await updateExercise(exerciseIds['Panca']!, {
      name: 'Distensioni panca',
      muscleGroupId: groups.find((g) => g.name === 'Spalle')!.id,
      metric: 'weightReps',
      weightMode: 'total',
    });

    const after = (await getSessionView(sid))!;
    expect(after.session).toEqual(before.session);
    expect(after.exercises).toEqual(before.exercises);
    expect(after.logs).toEqual(before.logs);
    expect(after.exercises[0]).toMatchObject({ exerciseName: 'Panca', muscleGroupName: 'Petto', weightMode: 'perSide', restSeconds: 120 });
  });
});

describe('registrazione serie e validazione', () => {
  it('serie con ripetizioni e pesi diversi (4×8 8 6 6), aggiorna l\'ultima attività', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    await logAll(sid, 'Panca', [10, 12.5, 15, 15], [8, 8, 6, 6], T0 + 5 * MIN);
    const v = (await getSessionView(sid))!;
    expect(v.logs.map((l) => [l.setNumber, l.weightKg, l.reps])).toEqual([[1, 10, 8], [2, 12.5, 8], [3, 15, 6], [4, 15, 6]]);
    expect(v.session.lastActivityAt).toBe(T0 + 5 * MIN + 3000);
    expect(v.stats).toMatchObject({ sets: 4, exercises: 1, volumeKg: 8 * 20 + 8 * 25 + 6 * 30 + 6 * 30 });
  });

  it('rifiuta valori fuori limite e reps mancanti per peso+rep', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    const se = (await getSessionView(sid))!.exercises[0]!.id;
    const base = { sessionExerciseId: se, setNumber: 1, kind: 'normal' as const };
    await expectCode(logSet({ ...base, reps: 8, weightKg: 1000.5 }), ERR.INVALID_WEIGHT);
    await expectCode(logSet({ ...base, reps: 1000, weightKg: 10 }), ERR.INVALID_REPS);
    await expectCode(logSet({ ...base, weightKg: 10 }), ERR.INVALID_REPS);
    await expectCode(logSet({ ...base, reps: 8, weightKg: 10, rir: 6 }), ERR.INVALID_RIR);
    await expectCode(logSet({ ...base, setNumber: 0, reps: 8, weightKg: 10 }), ERR.INVALID_SETS);
    expect((await getSessionView(sid))!.logs).toHaveLength(0);
  });

  it('esercizio "solo ripetizioni" (addome/cardio): le reps sono opzionali, la serie si segna come fatta con una nota', async () => {
    const cardio = await ensureExercise('Tapis roulant', { group: 'Cardio', metric: 'reps' });
    const { dayIds } = await makeProgram('P', [{ label: 'A', exercises: [{ name: cardio.name, metric: 'reps', group: 'Cardio', sets: [{ kind: 'normal' }] }] }], { activate: true });
    const sid = await startSession(dayIds[0]!, T0);
    const se = (await getSessionView(sid))!.exercises[0]!;
    expect(se.metric).toBe('reps');
    await logSet({ sessionExerciseId: se.id, setNumber: 1, kind: 'normal', note: '20 min, pendenza 6, vel 5.5' }, T0 + MIN);
    const log = (await getSessionView(sid))!.logs[0]!;
    expect(log.reps).toBeUndefined();
    expect(log.weightKg).toBeUndefined();
    expect(log.note).toBe('20 min, pendenza 6, vel 5.5');
    await endSession(sid, T0 + 2 * MIN); // conta come serie registrata
  });

  it('correggere o eliminare una serie, anche a sessione conclusa', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    await logAll(sid, 'Panca', [10, 10], [8, 8]);
    await endSession(sid, T0 + MIN);
    const [l1, l2] = (await getSessionView(sid))!.logs;
    await updateSetLog(l1!.id, { weightKg: 12.5, rir: 2, note: 'facile' });
    await updateSetLog(l1!.id, { rir: null });
    await expectCode(updateSetLog(l1!.id, { weightKg: 5000 }), ERR.INVALID_WEIGHT);
    await expectCode(updateSetLog(l1!.id, { reps: null }), ERR.INVALID_REPS);
    await deleteSetLog(l2!.id);
    const v = (await getSessionView(sid))!;
    expect(v.logs).toHaveLength(1);
    expect(v.logs[0]).toMatchObject({ weightKg: 12.5, note: 'facile' });
    expect(v.logs[0]!.rir).toBeUndefined();
  });

  it('non si può registrare su una sessione conclusa; "+ serie" aggiunge una serie solo a questa sessione', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    const seId = await logAll(sid, 'Panca', [10], [8]);
    await addSetToSessionExercise(seId, T0 + MIN);
    const se = (await getSessionView(sid))!.exercises[0]!;
    expect(se.plannedSets).toHaveLength(5);
    expect(se.suggestions).toHaveLength(5);
    await endSession(sid, T0 + 2 * MIN);
    await expectCode(logSet({ sessionExerciseId: seId, setNumber: 2, kind: 'normal', reps: 8, weightKg: 10 }), ERR.SESSION_NOT_ACTIVE);
    await expectCode(addSetToSessionExercise(seId), ERR.SESSION_NOT_ACTIVE);
  });
});

describe('timer di recupero (stato nella sessione)', () => {
  it('parte dal recupero dell\'esercizio dopo ogni nuova serie; correggere la serie non lo riavvia', async () => {
    const { dayIds } = await simpleProgram('P', ['Panca'], 120);
    const sid = await startSession(dayIds[0]!, T0);
    const se = (await getSessionView(sid))!.exercises[0]!;
    await logSet({ sessionExerciseId: se.id, setNumber: 1, kind: 'normal', weightKg: 10, reps: 8 }, T0 + MIN);
    let s = (await getSessionView(sid))!.session;
    expect(timerOf(s)).toEqual({ endsAt: T0 + MIN + 120_000, totalMs: 120_000 });
    expect(s.restSessionExerciseId).toBe(se.id);

    await logSet({ sessionExerciseId: se.id, setNumber: 1, kind: 'normal', weightKg: 12.5, reps: 8 }, T0 + 90_000); // correzione
    s = (await getSessionView(sid))!.session;
    expect(s.restEndsAt).toBe(T0 + MIN + 120_000); // invariato
  });

  it('±15 s e valore digitato valgono solo per quel recupero; salta lo azzera; il residuo va in negativo', async () => {
    const { dayIds } = await simpleProgram('P', ['Panca'], 60);
    const sid = await startSession(dayIds[0]!, T0);
    const se = (await getSessionView(sid))!.exercises[0]!;
    await logSet({ sessionExerciseId: se.id, setNumber: 1, kind: 'normal', weightKg: 10, reps: 8 }, T0);
    await adjustRest(sid, 15, T0 + 1000);
    let s = (await getSessionView(sid))!.session;
    expect(remainingMs(timerOf(s)!, T0 + 1000)).toBe(74_000); // 60 s + 15 s, già trascorso 1 s
    // app sospesa fino a 105 s dopo la serie: il recupero (75 s) risulta scaduto da 30 s
    expect(remainingMs(timerOf(s)!, T0 + 105_000)).toBe(-30_000);

    await setRestSeconds(sid, 200, T0 + 2000);
    s = (await getSessionView(sid))!.session;
    expect(remainingMs(timerOf(s)!, T0 + 2000)).toBe(200_000);
    expect((await getSessionView(sid))!.exercises[0]!.restSeconds).toBe(60); // il default dell'esercizio non cambia

    await skipRest(sid, T0 + 3000);
    expect(timerOf((await getSessionView(sid))!.session)).toBeUndefined();
    await adjustRest(sid, 15, T0 + 4000); // senza timer: nessun effetto
    expect(timerOf((await getSessionView(sid))!.session)).toBeUndefined();
    await expectCode(setRestSeconds(sid, 4000), ERR.INVALID_REST);
  });

  it('superset: il recupero parte solo dopo l\'ultimo esercizio del giro, con il suo valore', async () => {
    const { dayIds, programExerciseIds } = await makeProgram('P', [{
      label: 'A',
      exercises: [
        { name: 'Press manubri', sets: sets([8, 8]), rest: 30 },
        { name: 'Croci manubri', sets: sets([10, 10]), rest: 150 },
        { name: 'Cavi', sets: sets([10]), rest: 60 },
      ],
    }], { activate: true });
    await setLinkedWithNext(programExerciseIds[0]![0]!, true);
    const sid = await startSession(dayIds[0]!, T0);
    const [press, croci] = (await getSessionView(sid))!.exercises;
    expect(press!.groupId).toBeDefined();
    expect(press!.groupId).toBe(croci!.groupId);

    await logSet({ sessionExerciseId: press!.id, setNumber: 1, kind: 'normal', weightKg: 14, reps: 8 }, T0);
    expect(timerOf((await getSessionView(sid))!.session)).toBeUndefined(); // primo membro: nessun recupero
    await logSet({ sessionExerciseId: croci!.id, setNumber: 1, kind: 'normal', weightKg: 8, reps: 10 }, T0 + 1000);
    expect(timerOf((await getSessionView(sid))!.session)).toEqual({ endsAt: T0 + 1000 + 150_000, totalMs: 150_000 });
  });

  it('drop set: nessun recupero tra una drop e la successiva, recupero dopo l\'ultima', async () => {
    const { dayIds } = await makeProgram('P', [{
      label: 'A',
      exercises: [{ name: 'Curl cavo', sets: [{ kind: 'normal', repsMin: 10 }, { kind: 'drop', repsMin: 10 }, { kind: 'drop', repsMin: 10 }], rest: 90 }],
    }], { activate: true });
    const sid = await startSession(dayIds[0]!, T0);
    const se = (await getSessionView(sid))!.exercises[0]!;
    await logSet({ sessionExerciseId: se.id, setNumber: 1, kind: 'normal', weightKg: 30, reps: 10 }, T0);
    expect(timerOf((await getSessionView(sid))!.session)?.totalMs).toBe(90_000);
    await logSet({ sessionExerciseId: se.id, setNumber: 2, kind: 'drop', weightKg: 25, reps: 10 }, T0 + 1000);
    expect(timerOf((await getSessionView(sid))!.session)).toBeUndefined(); // seguita da un'altra drop
    await logSet({ sessionExerciseId: se.id, setNumber: 3, kind: 'drop', weightKg: 20, reps: 10 }, T0 + 2000);
    expect(timerOf((await getSessionView(sid))!.session)?.endsAt).toBe(T0 + 2000 + 90_000);
  });
});

describe('recupero di un esercizio nella sessione', () => {
  it('cambia solo lo snapshot della sessione, non la scheda; il nuovo valore guida il timer', async () => {
    const { dayIds, programExerciseIds } = await simpleProgram('P', ['Panca'], 120);
    const sid = await startSession(dayIds[0]!, T0);
    const se = (await getSessionView(sid))!.exercises[0]!;
    await setSessionExerciseRest(se.id, 45);
    await expectCode(setSessionExerciseRest(se.id, 5000), ERR.INVALID_REST);
    await logSet({ sessionExerciseId: se.id, setNumber: 1, kind: 'normal', weightKg: 10, reps: 8 }, T0);
    expect(timerOf((await getSessionView(sid))!.session)?.totalMs).toBe(45_000);
    // la scheda conserva il recupero originale
    const { getDayDetail } = await import('./programs');
    expect((await getDayDetail(dayIds[0]!))!.items[0]!.item.restSeconds).toBe(120);
    expect(programExerciseIds).toHaveLength(1);
  });
});

describe('fine sessione e auto-chiusura', () => {
  it('endSession registra la fine, azzera il timer; 0 serie → SESSION_EMPTY, poi si può scartare', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    await expectCode(endSession(sid, T0 + MIN), ERR.SESSION_EMPTY);
    await discardSession(sid);
    expect(await sessionsRepo.get(sid)).toBeUndefined();
    expect((await getSessionView(sid))).toBeUndefined();

    const s2 = await startSession(dayIds[0]!, T0);
    await logAll(s2, 'Panca', [10], [8], T0 + MIN);
    await expectCode(discardSession(s2), ERR.SESSION_NOT_EMPTY);
    await endSession(s2, T0 + 72 * MIN + 40_000);
    const s = (await sessionsRepo.get(s2))!;
    expect(s).toMatchObject({ status: 'completed', endedBy: 'manual', endedAt: T0 + 72 * MIN + 40_000 });
    expect(s.restEndsAt).toBeUndefined();
    expect(s.endedAt! - s.startedAt).toBe(72 * MIN + 40_000); // durata totale 1:12:40
  });

  it('dopo 1 h senza attività si chiude con fine = ultima attività (non l\'ora della chiusura)', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    await logAll(sid, 'Panca', [10], [8], T0 + 20 * MIN); // ultima attività: T0+20min
    const last = T0 + 20 * MIN;

    expect(await autoCloseStaleSession(last + AUTO_CLOSE_MS)).toBe('none'); // esattamente 1 h: ancora aperta
    expect(await autoCloseStaleSession(last + AUTO_CLOSE_MS + 1)).toBe('closed');
    const s = (await sessionsRepo.get(sid))!;
    expect(s).toMatchObject({ status: 'completed', endedBy: 'auto', endedAt: last });
    expect(s.restEndsAt).toBeUndefined();
    expect(await autoCloseStaleSession(last + 10 * AUTO_CLOSE_MS)).toBe('none'); // nulla da chiudere
  });

  it('ogni scrittura sposta l\'ultima attività: la sessione non si chiude se la usi', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    const seId = await logAll(sid, 'Panca', [10], [8], T0);
    await adjustRest(sid, 15, T0 + 50 * MIN); // sei ancora lì
    expect(await autoCloseStaleSession(T0 + 100 * MIN)).toBe('none');
    expect(await autoCloseStaleSession(T0 + 111 * MIN)).toBe('closed');
    expect(seId).toBeDefined();
  });

  it('una sessione senza serie viene scartata dall\'auto-chiusura', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    expect(await autoCloseStaleSession(T0 + AUTO_CLOSE_MS + 1)).toBe('discarded');
    expect(await sessionsRepo.get(sid)).toBeUndefined();
    expect(await sessionsRepo.getActive()).toBeUndefined();
  });

  it('correggere l\'orario di fine: solo su sessioni concluse e dopo l\'inizio', async () => {
    const { dayIds } = await simpleProgram();
    const sid = await startSession(dayIds[0]!, T0);
    await logAll(sid, 'Panca', [10], [8]);
    await expectCode(setSessionEnd(sid, T0 + 30 * MIN), ERR.SESSION_NOT_ACTIVE); // ancora attiva
    await autoCloseStaleSession(T0 + 3 * AUTO_CLOSE_MS);
    await setSessionEnd(sid, T0 + 45 * MIN);
    expect((await sessionsRepo.get(sid))!.endedAt).toBe(T0 + 45 * MIN);
    await expectCode(setSessionEnd(sid, T0 - 1), ERR.INVALID_TIME);
  });
});

describe('calendario e panoramica', () => {
  it('le sessioni del mese si leggono per intervallo di date (bordi inclusi/esclusi)', async () => {
    const { dayIds } = await simpleProgram();
    const days = [new Date(2026, 8, 30, 12), new Date(2026, 9, 1, 0, 5), new Date(2026, 9, 31, 23, 50), new Date(2026, 10, 1, 8)];
    for (const d of days) {
      const sid = await startSession(dayIds[0]!, d.getTime());
      await logAll(sid, 'Panca', [10], [8], d.getTime());
      await endSession(sid, d.getTime() + MIN);
    }
    const oct = await getMonthSessions(2026, 9);
    expect(oct.map((s) => s.date)).toEqual(['2026-10-01', '2026-10-31']);
  });

  it('Oggi: giorni della scheda attiva con ultima volta', async () => {
    const { dayIds } = await makeProgram('P', [
      { label: 'A', exercises: [{ name: 'Panca', sets: sets([8]) }] },
      { label: 'B', exercises: [{ name: 'Squat', sets: sets([8]) }, { name: 'Stacco', sets: sets([5]) }] },
    ], { activate: true });
    const sid = await startSession(dayIds[1]!, T0);
    await logAll(sid, 'Squat', [60], [8]);
    await endSession(sid, T0 + MIN);
    const o = (await getTodayOverview())!;
    expect(o.program.name).toBe('P');
    expect(o.days.map((d) => [d.day.label, d.exercises, d.lastDate])).toEqual([['A', 1, undefined], ['B', 2, '2026-10-03']]);
  });
});

describe('storico per esercizio (progressione)', () => {
  it('stesso exerciseId in due schede → serie storica unica, ordinata dalla più recente', async () => {
    const p1 = await simpleProgram('Scheda 1');
    const s1 = await startSession(p1.dayIds[0]!, T0);
    await logAll(s1, 'Panca', [10, 10], [8, 8], T0);
    await endSession(s1, T0 + 30 * MIN);

    const p2 = await makeProgram('Scheda 2', [{ label: 'Z', exercises: [{ name: 'Panca', sets: sets([6, 6]) }] }]);
    await activateProgram(p2.program.id);
    const s2 = await startSession(p2.dayIds[0]!, T0 + 7 * 24 * 60 * MIN);
    await logAll(s2, 'Panca', [15, 15], [6, 6], T0 + 7 * 24 * 60 * MIN);
    await endSession(s2, T0 + 7 * 24 * 60 * MIN + MIN);

    const h = await getExerciseHistory(p1.exerciseIds['Panca']!);
    expect(h.entries.map((e) => [e.programName, e.dayLabel, e.sets.map((s) => s.weightKg)])).toEqual([
      ['Scheda 2', 'Z', [15, 15]],
      ['Scheda 1', 'A', [10, 10]],
    ]);
    expect(h.nextBefore).toBeUndefined();
  });

  it('è per exerciseId, non per nome: rinominare l\'esercizio non spezza lo storico; paginazione', async () => {
    const { dayIds, exerciseIds } = await simpleProgram();
    for (let i = 0; i < 5; i++) {
      const t = T0 + i * 24 * 60 * MIN;
      const sid = await startSession(dayIds[0]!, t);
      await logAll(sid, 'Panca', [10 + i], [8], t);
      await endSession(sid, t + MIN);
    }
    const groups = await listMuscleGroups();
    await updateExercise(exerciseIds['Panca']!, { name: 'Distensioni', muscleGroupId: groups[0]!.id, metric: 'weightReps', weightMode: 'perSide' });
    const page1 = await getExerciseHistory(exerciseIds['Panca']!, 3);
    expect(page1.entries.map((e) => e.sets[0]!.weightKg)).toEqual([14, 13, 12]);
    expect(page1.nextBefore).toBeDefined();
    const page2 = await getExerciseHistory(exerciseIds['Panca']!, 3, page1.nextBefore);
    expect(page2.entries.map((e) => e.sets[0]!.weightKg)).toEqual([11, 10]);
    expect(page2.nextBefore).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError, ERR } from '../domain/errors';
import { programsRepo } from '../repositories/programs';
import { makeProgram, resetDb, sets } from '../test/helpers';
import { deleteExercise, createExercise, listMuscleGroups, setExerciseArchived, createMuscleGroup } from './catalog';
import {
  activateProgram,
  addProgramExercise,
  deleteDay,
  deleteProgram,
  deleteProgramExercise,
  duplicateProgram,
  getDayDetail,
  getProgramDetail,
  moveDay,
  moveProgramExercise,
  setLinkedWithNext,
  updateProgramExercise,
} from './programs';
import { startSession, logSet, getSessionView } from './sessions';

beforeEach(resetDb);

const day = (label: string, names: string[]) => ({
  label,
  exercises: names.map((name) => ({ name, sets: sets([8, 8, 6, 6]) })),
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e) => e instanceof DomainError && e.code === code);
}

describe('schede', () => {
  it('una scheda ha N giorni e N esercizi senza limiti artificiali (3 o 7 giorni)', async () => {
    const week = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((l) => day(l, ['Panca', 'Squat']));
    const { program } = await makeProgram('Settimana piena', week);
    expect((await getProgramDetail(program.id))?.days).toHaveLength(7);
    const three = await makeProgram('Tre giorni', week.slice(0, 3));
    expect((await getProgramDetail(three.program.id))?.days).toHaveLength(3);
  });

  it('attivare una nuova scheda archivia la vecchia: una sola attiva, storico intatto', async () => {
    const a = await makeProgram('Scheda 1', [day('A', ['Panca'])], { activate: true });
    const b = await makeProgram('Scheda 2', [day('A', ['Panca'])]);
    await activateProgram(b.program.id, '2026-11-15');

    const all = await programsRepo.list();
    expect(all.filter((p) => p.status === 'active').map((p) => p.id)).toEqual([b.program.id]);
    const old = await programsRepo.get(a.program.id);
    expect(old?.status).toBe('archived');
    expect(old?.endDate).toBe('2026-11-15');
    // la vecchia scheda conserva giorni ed esercizi
    expect((await getProgramDetail(a.program.id))?.days[0]?.exercises).toBe(1);

    // si può riattivare una scheda archiviata: sempre una sola attiva
    await activateProgram(a.program.id);
    expect((await programsRepo.listByStatus('active')).map((p) => p.id)).toEqual([a.program.id]);
  });

  it('eliminare una scheda con sessioni → PROGRAM_HAS_SESSIONS; senza sessioni si elimina con tutto il contenuto', async () => {
    const { program, dayIds } = await makeProgram('Usata', [day('A', ['Panca'])], { activate: true });
    const sid = await startSession(dayIds[0]!);
    const view = await getSessionView(sid);
    await logSet({ sessionExerciseId: view!.exercises[0]!.id, setNumber: 1, kind: 'normal', reps: 8, weightKg: 10 });
    await expectCode(deleteProgram(program.id), ERR.PROGRAM_HAS_SESSIONS);
    expect(await programsRepo.get(program.id)).toBeDefined();

    const { program: free } = await makeProgram('Mai usata', [day('A', ['Squat'])]);
    await deleteProgram(free.id);
    expect(await programsRepo.get(free.id)).toBeUndefined();
  });

  it('duplica una scheda in bozza copiando giorni, esercizi e superset con nuovi id', async () => {
    const { program, programExerciseIds } = await makeProgram('Originale', [day('A', ['Panca', 'Croci', 'Squat'])]);
    await setLinkedWithNext(programExerciseIds[0]![0]!, true);
    const copy = await duplicateProgram(program.id);
    expect(copy.status).toBe('draft');
    expect(copy.name).toBe('Originale (copia)');
    const d = await getProgramDetail(copy.id);
    expect(d?.days).toHaveLength(1);
    const items = (await getDayDetail(d!.days[0]!.day.id))!.items;
    expect(items).toHaveLength(3);
    const [first, second, third] = items;
    expect(first!.item.groupId).toBeDefined();
    expect(first!.item.groupId).toBe(second!.item.groupId);
    expect(third!.item.groupId).toBeUndefined();
    // gli id e il groupId sono nuovi: nessun legame con l'originale
    const orig = (await getDayDetail((await getProgramDetail(program.id))!.days[0]!.day.id))!.items;
    expect(first!.item.id).not.toBe(orig[0]!.item.id);
    expect(first!.item.groupId).not.toBe(orig[0]!.item.groupId);
  });

  it('eliminare un giorno lo toglie dalla scheda ma non tocca le sessioni passate', async () => {
    const { program, dayIds } = await makeProgram('P', [day('A', ['Panca']), day('B', ['Squat'])], { activate: true });
    const sid = await startSession(dayIds[0]!);
    const before = await getSessionView(sid);
    await deleteDay(dayIds[0]!);
    expect((await getProgramDetail(program.id))?.days).toHaveLength(1);
    const after = await getSessionView(sid);
    expect(after?.exercises).toEqual(before?.exercises);
    expect(after?.session.dayLabel).toBe('A');
  });
});

describe('ordine dei giorni', () => {
  it('moveDay scambia la posizione col giorno vicino e ignora i bordi', async () => {
    const { program, dayIds } = await makeProgram('P', [day('A', ['Panca']), day('B', ['Squat']), day('C', ['Stacco'])]);
    const labels = async () => (await getProgramDetail(program.id))!.days.map((d) => d.day.label);
    expect(await labels()).toEqual(['A', 'B', 'C']);
    await moveDay(dayIds[2]!, -1);
    expect(await labels()).toEqual(['A', 'C', 'B']);
    await moveDay(dayIds[0]!, -1); // già primo: nessun effetto
    await moveDay(dayIds[1]!, 1); // già ultimo: nessun effetto
    expect(await labels()).toEqual(['A', 'C', 'B']);
    await moveDay(dayIds[0]!, 1);
    expect(await labels()).toEqual(['C', 'A', 'B']);
  });
});

describe('superset e ordine', () => {
  it('collega/scollega e scioglie il gruppo se non è più consecutivo', async () => {
    const { dayIds, programExerciseIds } = await makeProgram('P', [day('A', ['E1', 'E2', 'E3', 'E4'])]);
    const [e1, e2, e3] = programExerciseIds[0]!;
    await setLinkedWithNext(e1!, true);
    await setLinkedWithNext(e2!, true); // E1+E2+E3 nello stesso gruppo
    let items = (await getDayDetail(dayIds[0]!))!.items;
    const g = items[0]!.item.groupId;
    expect(g).toBeDefined();
    expect([items[1]!.item.groupId, items[2]!.item.groupId]).toEqual([g, g]);
    expect(items[3]!.item.groupId).toBeUndefined();

    // scollega tra E2 ed E3: restano E1+E2; E3 resta solo e perde il gruppo
    await setLinkedWithNext(e2!, false);
    items = (await getDayDetail(dayIds[0]!))!.items;
    expect(items[0]!.item.groupId).toBe(items[1]!.item.groupId);
    expect(items[0]!.item.groupId).toBeDefined();
    expect(items[2]!.item.groupId).toBeUndefined();

    // spostare E3 sopra E2 la inserisce nel mezzo: nessun gruppo non consecutivo
    await moveProgramExercise(e3!, -1);
    items = (await getDayDetail(dayIds[0]!))!.items;
    for (const [i, it] of items.entries())
      if (it.item.groupId) {
        const same = items.filter((x) => x.item.groupId === it.item.groupId).map((x) => items.indexOf(x));
        expect(Math.max(...same) - Math.min(...same) + 1).toBe(same.length);
        expect(same.length).toBeGreaterThan(1);
        expect(i).toBeGreaterThanOrEqual(0);
      }
  });

  it('eliminare un membro lascia il gruppo con un solo esercizio: sciolto', async () => {
    const { dayIds, programExerciseIds } = await makeProgram('P', [day('A', ['E1', 'E2'])]);
    await setLinkedWithNext(programExerciseIds[0]![0]!, true);
    await deleteProgramExercise(programExerciseIds[0]![1]!);
    const items = (await getDayDetail(dayIds[0]!))!.items;
    expect(items).toHaveLength(1);
    expect(items[0]!.item.groupId).toBeUndefined();
  });

  it('un esercizio può essere sostituito a metà periodo e le sessioni passate restano', async () => {
    const { dayIds, programExerciseIds, exerciseIds } = await makeProgram('P', [day('A', ['Panca'])], { activate: true });
    const sid = await startSession(dayIds[0]!);
    const groups = await listMuscleGroups();
    const incl = await createExercise({
      name: 'Panca inclinata',
      muscleGroupId: groups[0]!.id,
      metric: 'weightReps',
      weightMode: 'perSide',
    });
    await updateProgramExercise(programExerciseIds[0]![0]!, { exerciseId: incl.id, sets: sets([10, 10]), restSeconds: 60 });
    const items = (await getDayDetail(dayIds[0]!))!.items;
    expect(items[0]!.exercise.name).toBe('Panca inclinata');
    expect(items[0]!.item.sets).toHaveLength(2);
    const old = await getSessionView(sid);
    expect(old?.exercises[0]?.exerciseName).toBe('Panca');
    expect(old?.exercises[0]?.exerciseId).toBe(exerciseIds['Panca']);
  });
});

describe('catalogo', () => {
  it('nomi esercizio univoci (ignorando maiuscole/accenti); eliminazione protetta', async () => {
    const groups = await listMuscleGroups();
    const base = { muscleGroupId: groups[0]!.id, metric: 'weightReps', weightMode: 'perSide' } as const;
    const ex = await createExercise({ ...base, name: 'Panca Piana' });
    await expectCode(createExercise({ ...base, name: '  panca   piana ' }), ERR.EXERCISE_NAME_EXISTS);

    // usato in una scheda → non eliminabile
    const { dayIds } = await makeProgram('P', [{ label: 'A', exercises: [{ name: 'Panca Piana', sets: sets([8]) }] }]);
    expect(dayIds).toHaveLength(1);
    await expectCode(deleteExercise(ex.id), ERR.EXERCISE_IN_USE);

    // con storico → non eliminabile, solo archiviabile
    await activateProgramAndLog(dayIds[0]!);
    await expectCode(deleteExercise(ex.id), ERR.EXERCISE_HAS_HISTORY);
    await setExerciseArchived(ex.id, true);
    // archiviato libera il nome
    await createExercise({ ...base, name: 'Panca piana' });
  });

  it('esercizio con storico ma tolto dalle schede → EXERCISE_HAS_HISTORY', async () => {
    const { dayIds, programExerciseIds, exerciseIds } = await makeProgram('P', [day('A', ['Panca'])]);
    await activateProgramAndLog(dayIds[0]!);
    await deleteProgramExercise(programExerciseIds[0]![0]!);
    await expectCode(deleteExercise(exerciseIds['Panca']!), ERR.EXERCISE_HAS_HISTORY);
  });

  it('distretti preset presenti e aggiungibili; nome duplicato rifiutato', async () => {
    const names = (await listMuscleGroups()).map((g) => g.name);
    expect(names).toContain('Petto');
    expect(names).toContain('Cardio');
    const g = await createMuscleGroup('Lombari');
    expect((await listMuscleGroups()).map((x) => x.id)).toContain(g.id);
    await expectCode(createMuscleGroup('petto'), ERR.MUSCLE_GROUP_NAME_EXISTS);
  });

  it('addProgramExercise rifiuta esercizio o giorno inesistenti', async () => {
    const { dayIds } = await makeProgram('P', [day('A', ['Panca'])]);
    await expectCode(addProgramExercise(dayIds[0]!, { exerciseId: 'nope', sets: sets([8]), restSeconds: 60 }), ERR.EXERCISE_NOT_FOUND);
    await expectCode(addProgramExercise('nope', { exerciseId: 'x', sets: sets([8]), restSeconds: 60 }), ERR.DAY_NOT_FOUND);
  });
});

async function activateProgramAndLog(dayId: string) {
  const dayDetail = await getDayDetail(dayId);
  await activateProgram(dayDetail!.program.id);
  expect((await programsRepo.getActive())?.id).toBe(dayDetail!.program.id);
  const sid = await startSession(dayId);
  const view = await getSessionView(sid);
  await logSet({ sessionExerciseId: view!.exercises[0]!.id, setNumber: 1, kind: 'normal', reps: 8, weightKg: 10 });
}

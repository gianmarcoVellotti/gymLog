import { useState } from 'react';
import { totalWeightKg } from '../../domain/calc';
import { createExercise, deleteExercise, getExercise, getExerciseUsage, listMuscleGroups, setExerciseArchived, updateExercise } from '../../services/catalog';
import { getExerciseHistory, type HistoryEntry } from '../../services/progression';
import { ExerciseForm } from '../components/ExerciseForm';
import { Loading, TopBar } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';
import { formatDateShort, formatKg } from '../lib/format';
import { navigate } from '../router';

function setsText(e: HistoryEntry): string {
  const se = e.sessionExercise;
  return e.sets
    .map((s) => {
      const w = s.weightKg !== undefined ? `${formatKg(s.weightKg)}${se.weightMode === 'perSide' ? '/lato' : ' kg'} × ` : '';
      const r = s.reps !== undefined ? String(s.reps) : '✓';
      const tag = s.kind === 'warmup' ? ' (risc.)' : s.kind === 'drop' ? ' (drop)' : s.kind === 'amrap' ? ' (AMRAP)' : '';
      const tot =
        se.weightMode === 'perSide' && s.weightKg !== undefined && se.metric === 'weightReps'
          ? ` [tot. ${formatKg(totalWeightKg(s.weightKg, 'perSide', se.tareKg))}]`
          : '';
      return `${w}${r}${tag}${tot}`;
    })
    .join('  ·  ');
}

export function ExerciseDetailView({ id }: { id: string }) {
  const isNew = id === 'new';
  const data = useLive(async () => ({ ex: isNew ? undefined : await getExercise(id), usage: isNew ? undefined : await getExerciseUsage(id) }), [id]);
  const groups = useLive(() => listMuscleGroups(), []);
  const first = useLive(() => (isNew ? undefined : getExerciseHistory(id, 10)), [id]);
  const { confirm, run, toast } = useDialogs();
  const [extra, setExtra] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number | undefined | null>(null); // null = usa quello della prima pagina

  if (!data || !groups) return <Loading />;
  const { ex, usage } = data;

  if (isNew) {
    return (
      <div>
        <TopBar back="/more/exercises" kick="Catalogo" title="Nuovo esercizio" />
        <ExerciseForm
          groups={groups}
          submitLabel="Crea esercizio"
          onSubmit={async (input) => {
            const created = await run(() => createExercise(input));
            if (created) navigate(`/more/exercises/${created.id}`, { replace: true });
          }}
        />
      </div>
    );
  }

  if (!ex) {
    return (
      <div className="empty">
        Esercizio non trovato.
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => navigate('/more/exercises')}>
            Torna al catalogo
          </button>
        </div>
      </div>
    );
  }

  const entries = [...(first?.entries ?? []), ...extra];
  const nextBefore = cursor === null ? first?.nextBefore : cursor;

  const loadMore = async () => {
    if (nextBefore === undefined) return;
    const page = await run(() => getExerciseHistory(id, 10, nextBefore));
    if (!page) return;
    setExtra((cur) => [...cur, ...page.entries]);
    setCursor(page.nextBefore);
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Eliminare "${ex.name}"?`,
      message: "L'esercizio verrà cancellato dal catalogo. Non è usato in nessuna scheda e non ha storico.",
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    const done = await run(async () => {
      await deleteExercise(ex.id);
      return true;
    });
    if (done) navigate('/more/exercises', { replace: true });
  };

  return (
    <div>
      <TopBar back="/more/exercises" kick={ex.archived ? 'Archiviato' : 'Esercizio'} title={ex.name} />
      <div className="mut" style={{ fontSize: 13.5 }}>
        Usato in {usage?.programs ?? 0} {(usage?.programs ?? 0) === 1 ? 'scheda' : 'schede'} · {usage?.historySets ?? 0} serie registrate
      </div>

      <ExerciseForm
        key={ex.id + ex.name}
        initial={ex}
        groups={groups}
        submitLabel="Salva modifiche"
        onSubmit={async (input) => {
          const saved = await run(() => updateExercise(ex.id, input));
          if (saved) toast('Esercizio aggiornato. Gli allenamenti passati non cambiano.');
        }}
      />

      <div className="stack" style={{ marginTop: 12 }}>
        <button
          className="btn block"
          onClick={() => void run(() => setExerciseArchived(ex.id, !ex.archived))}
        >
          {ex.archived ? 'Ripristina esercizio' : 'Archivia esercizio'}
        </button>
        <button className="btn danger block" onClick={() => void remove()}>
          Elimina esercizio
        </button>
      </div>

      <span className="lab">Storico</span>
      <div className="stack">
        {entries.map((e) => (
          <button key={e.sessionExercise.id} className="glass hist" style={{ textAlign: 'left', width: '100%' }} onClick={() => navigate(`/sessions/${e.sessionId}`)}>
            <div className="row-between">
              <b>{formatDateShort(e.date)}</b>
              <span className="mut" style={{ fontSize: 12.5 }}>
                {e.programName} · Giorno {e.dayLabel}
              </span>
            </div>
            <div className="sets">{setsText(e)}</div>
          </button>
        ))}
        {first && entries.length === 0 && <div className="glass empty">Nessuna serie registrata per questo esercizio.</div>}
        {nextBefore !== undefined && (
          <button className="btn block" onClick={() => void loadMore()}>
            Mostra sessioni precedenti
          </button>
        )}
      </div>
    </div>
  );
}

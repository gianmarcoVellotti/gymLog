import { useEffect, useState } from 'react';
import { normalizeName } from '../../domain/calc';
import type { Exercise, PlannedSet, SetKind, Tag } from '../../domain/types';
import { createExercise, listExercises, listMuscleGroups } from '../../services/catalog';
import { addProgramExercise, deleteProgramExercise, getDayDetail, setLinkedWithNext, updateProgramExercise } from '../../services/programs';
import { parseClockInput } from '../../timer/rest';
import { ExerciseForm } from '../components/ExerciseForm';
import { InfoButton, Loading, Toggle, TopBar } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { Icon } from '../components/Icon';
import { useLive } from '../hooks/useLive';
import { clockLabel, KIND_LABEL, parseIntStrict, parseRepsInput, repsLabel } from '../lib/format';
import { KIND_INFO, TAG_INFO, TAG_LABEL } from '../lib/glossary';
import { navigate } from '../router';

interface Row {
  kind: SetKind;
  reps: string;
}

const KINDS: SetKind[] = ['normal', 'warmup', 'amrap', 'drop'];

function Picker({ onPick }: { onPick: (e: Exercise) => void }) {
  const exercises = useLive(() => listExercises(), []);
  const groups = useLive(() => listMuscleGroups(), []);
  const { run } = useDialogs();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  if (!exercises || !groups) return <Loading />;
  const key = normalizeName(q);
  const filtered = exercises.filter((e) => key === '' || e.nameKey.includes(key));

  if (creating) {
    return (
      <div>
        <button className="chip t" onClick={() => setCreating(false)}>
          ← Scegli dal catalogo
        </button>
        <ExerciseForm
          groups={groups}
          submitLabel="Crea e usa"
          onSubmit={async (input) => {
            const ex = await run(() => createExercise(input));
            if (ex) onPick(ex);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <input className="input" placeholder="Cerca un esercizio…" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
        <Icon name="plus" size={18} /> Nuovo esercizio
      </button>
      {groups.map((g) => {
        const list = filtered.filter((e) => e.muscleGroupId === g.id);
        if (list.length === 0) return null;
        return (
          <div key={g.id}>
            <span className="lab">{g.name}</span>
            <div className="stack">
              {list.map((e) => (
                <button key={e.id} className="glass listrow" onClick={() => onPick(e)}>
                  <div className="grow">
                    <div className="name">{e.name}</div>
                    <div className="small">{e.metric === 'weightReps' ? (e.weightMode === 'perSide' ? 'peso per lato' : 'peso totale') : 'solo rep'}</div>
                  </div>
                  <Icon name="chev" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <div className="empty">Nessun esercizio trovato: creane uno nuovo.</div>}
    </div>
  );
}

/** Editor di un esercizio della scheda: scelta dal catalogo e pianificazione delle serie. */
export function ExerciseEditorView({ programId, dayId, peId }: { programId: string; dayId: string; peId: string }) {
  const isNew = peId === 'new';
  const detail = useLive(async () => ({ d: await getDayDetail(dayId) }), [dayId]);
  const { confirm, form, run, info } = useDialogs();
  const back = `/programs/${programId}/day/${dayId}`;

  const existing = detail?.d?.items.find((i) => i.item.id === peId);
  const index = detail?.d?.items.findIndex((i) => i.item.id === peId) ?? -1;
  const next = index >= 0 ? detail?.d?.items[index + 1] : undefined;
  const linked = !!existing?.item.groupId && next?.item.groupId === existing.item.groupId;

  const [exercise, setExercise] = useState<Exercise | undefined>();
  const [picking, setPicking] = useState(isNew);
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 3 }, () => ({ kind: 'normal' as SetKind, reps: '10' })));
  const [rest, setRest] = useState(90);
  const [tags, setTags] = useState<Tag[]>([]);
  const [notes, setNotes] = useState('');
  const [quickN, setQuickN] = useState('4');
  const [quickReps, setQuickReps] = useState('8');
  const [badRows, setBadRows] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (loaded || !existing) return;
    setExercise(existing.exercise);
    setRows(existing.item.sets.map((s) => ({ kind: s.kind, reps: repsLabel(s) })));
    setRest(existing.item.restSeconds);
    setTags(existing.item.tags);
    setNotes(existing.item.notes ?? '');
    setLoaded(true);
  }, [existing, loaded]);

  if (!detail || (!isNew && !loaded && existing)) return <Loading />;
  if (!detail.d || (!isNew && !existing && !loaded)) {
    return (
      <div className="empty">
        Esercizio non trovato.
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => navigate(back)}>
            Torna al giorno
          </button>
        </div>
      </div>
    );
  }

  if (picking || !exercise) {
    return (
      <div>
        <TopBar
          back={back}
          kick={`Giorno ${detail.d.day.label}`}
          title={isNew ? 'Scegli l\'esercizio' : 'Cambia esercizio'}
        />
        <Picker
          onPick={(e) => {
            setExercise(e);
            setPicking(false);
          }}
        />
      </div>
    );
  }

  const applyQuick = () => {
    const n = parseIntStrict(quickN);
    const reps = parseRepsInput(quickReps);
    if (n === undefined || n < 1 || n > 50 || reps === null) return void info('Valori non validi', 'Scrivi un numero di serie (1–50) e le ripetizioni (es. 8 oppure 8-12).');
    setRows(Array.from({ length: n }, () => ({ kind: 'normal' as SetKind, reps: quickReps.trim() })));
    setBadRows(new Set());
  };

  const toggleTag = (t: Tag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const editRest = async () => {
    const r = await form({
      title: 'Recupero',
      message: 'Scrivi i secondi (es. 90) oppure minuti:secondi (es. 2:00).',
      fields: [{ key: 'v', label: 'Recupero', initial: clockLabel(rest), inputMode: 'numeric', required: true }],
    });
    if (!r) return;
    const sec = parseClockInput(r.v ?? '');
    if (sec === null || sec > 3600) return void info('Valore non valido', 'Il recupero va da 0 a 60 minuti.');
    setRest(sec);
  };

  const save = async () => {
    const bad = new Set<number>();
    const sets: PlannedSet[] = rows.map((row, i) => {
      const reps = parseRepsInput(row.reps);
      if (reps === null) bad.add(i);
      return { kind: row.kind, ...(reps ?? {}) };
    });
    setBadRows(bad);
    if (bad.size > 0) return void info('Ripetizioni non valide', 'Scrivi un numero (8) oppure un intervallo (8-12), oppure lascia vuoto.');
    const input = { exerciseId: exercise.id, sets, restSeconds: rest, tags, notes };
    const saved = await run(async () => {
      if (isNew) await addProgramExercise(dayId, input);
      else await updateProgramExercise(peId, input);
      return true;
    });
    if (saved) navigate(back);
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Togliere "${exercise.name}" dal giorno?`,
      message: "L'esercizio resta nel catalogo e gli allenamenti già registrati non cambiano.",
      confirmLabel: 'Togli',
      danger: true,
    });
    if (!ok) return;
    const done = await run(async () => {
      await deleteProgramExercise(peId);
      return true;
    });
    if (done) navigate(back, { replace: true });
  };

  return (
    <div>
      <TopBar back={back} kick={`Giorno ${detail.d.day.label} · ${isNew ? 'nuovo esercizio' : 'esercizio'}`} title="Modifica esercizio" />

      <div className="glass card row-between">
        <div style={{ minWidth: 0 }}>
          <h3>{exercise.name}</h3>
          <div className="sub">
            {exercise.metric === 'weightReps' ? (exercise.weightMode === 'perSide' ? 'Peso per lato' : 'Peso totale') : 'Solo ripetizioni'}
          </div>
        </div>
        <button className="btn sm" onClick={() => setPicking(true)}>
          Cambia
        </button>
      </div>

      <span className="lab">Serie rapide</span>
      <div className="row-between" style={{ gap: 8 }}>
        <input className="input" style={{ width: 70, textAlign: 'center' }} inputMode="numeric" value={quickN} onChange={(e) => setQuickN(e.target.value)} aria-label="Numero di serie" />
        <span className="mut">serie ×</span>
        <input className="input" style={{ flex: 1, textAlign: 'center' }} value={quickReps} onChange={(e) => setQuickReps(e.target.value)} aria-label="Ripetizioni" placeholder="8 o 8-12" />
        <button className="btn sm" onClick={applyQuick}>
          Applica
        </button>
      </div>

      <div className="row-between">
        <span className="lab">Serie (ripetizioni per ogni serie)</span>
        <InfoButton title="Tipi di serie">
          {KINDS.map((k) => (
            <p key={k}>
              <b>{KIND_INFO[k].title}.</b> {KIND_INFO[k].text}
            </p>
          ))}
        </InfoButton>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="setrow" style={{ gridTemplateColumns: '28px 1fr 1fr 40px' }}>
          <div className="n">{i + 1}</div>
          <input
            className={`input ${badRows.has(i) ? 'bad' : ''}`}
            inputMode="numeric"
            value={row.reps}
            placeholder="rep (8 o 8-12)"
            aria-label={`Ripetizioni serie ${i + 1}`}
            onChange={(e) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, reps: e.target.value } : r)))}
          />
          <select
            className="input"
            value={row.kind}
            aria-label={`Tipo serie ${i + 1}`}
            onChange={(e) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, kind: e.target.value as SetKind } : r)))}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <button className="infobtn" aria-label={`Rimuovi serie ${i + 1}`} disabled={rows.length === 1} style={{ opacity: rows.length === 1 ? 0.3 : 1 }} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>
            <Icon name="x" size={18} />
          </button>
        </div>
      ))}
      <button className="btn block" style={{ marginTop: 10 }} disabled={rows.length >= 50} onClick={() => setRows((cur) => [...cur, { ...(cur[cur.length - 1] ?? { kind: 'normal', reps: '' }) }])}>
        <Icon name="plus" size={18} /> Aggiungi serie
      </button>

      <span className="lab">Recupero</span>
      <div className="seg">
        <button onClick={() => setRest((r) => Math.max(0, r - 15))}>−15</button>
        <button className="on" style={{ flex: 2 }} onClick={() => void editRest()} aria-label="Imposta il recupero a mano">
          {clockLabel(rest)}
        </button>
        <button onClick={() => setRest((r) => Math.min(3600, r + 15))}>+15</button>
      </div>

      <span className="lab">Modalità di esecuzione</span>
      <div className="chips" style={{ alignItems: 'center' }}>
        {(['slow', 'iso'] as Tag[]).map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button className={`chip ${tags.includes(t) ? '' : 't'}`} onClick={() => toggleTag(t)}>
              {TAG_LABEL[t]}
            </button>
            <InfoButton title={TAG_INFO[t].title}>{TAG_INFO[t].text}</InfoButton>
          </span>
        ))}
      </div>

      {existing && next && (
        <>
          <span className="lab">Superset</span>
          <Toggle on={linked} label={`Collega a "${next.exercise.name}" (gruppo unico, un solo recupero)`} onChange={(v) => void run(() => setLinkedWithNext(peId, v))} />
        </>
      )}

      <span className="lab">Note</span>
      <textarea className="input" rows={3} value={notes} maxLength={1000} placeholder="es. 10 per lato × 2, poi 15 × 2 — pesante" onChange={(e) => setNotes(e.target.value)} />

      {!isNew && (
        <button className="btn danger block" style={{ marginTop: 18 }} onClick={() => void remove()}>
          Togli dal giorno
        </button>
      )}

      <div className="actionbar">
        <button className="btn primary" onClick={() => void save()}>
          Salva esercizio
        </button>
      </div>
    </div>
  );
}

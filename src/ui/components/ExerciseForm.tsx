import { useState } from 'react';
import type { Exercise, Metric, MuscleGroup, WeightMode } from '../../domain/types';
import { createMuscleGroup, type ExerciseInput } from '../../services/catalog';
import { parseDecimal } from '../lib/format';
import { Seg } from './common';
import { useDialogs } from './Dialogs';

/** Anagrafica di un esercizio del catalogo: nome, distretto, cosa si registra, per lato/totale, tara. */
export function ExerciseForm({
  initial,
  groups,
  submitLabel,
  onSubmit,
}: {
  initial?: Exercise;
  groups: MuscleGroup[];
  submitLabel: string;
  onSubmit: (input: ExerciseInput) => void | Promise<void>;
}) {
  const { form, run, info } = useDialogs();
  const [name, setName] = useState(initial?.name ?? '');
  const [groupId, setGroupId] = useState(initial?.muscleGroupId ?? '');
  const [metric, setMetric] = useState<Metric>(initial?.metric ?? 'weightReps');
  const [mode, setMode] = useState<WeightMode>(initial?.weightMode ?? 'perSide');
  const [tare, setTare] = useState(initial && initial.tareKg ? String(initial.tareKg).replace('.', ',') : '');
  const [busy, setBusy] = useState(false);

  const addGroup = async () => {
    const r = await form({ title: 'Nuovo distretto', fields: [{ key: 'name', label: 'Nome', required: true, maxLength: 40 }], confirmLabel: 'Aggiungi' });
    if (!r) return;
    const g = await run(() => createMuscleGroup(r.name ?? ''));
    if (g) setGroupId(g.id);
  };

  const submit = async () => {
    if (name.trim() === '') return void info('Manca il nome', "Scrivi il nome dell'esercizio.");
    if (!groupId) return void info('Manca il distretto', 'Scegli il distretto muscolare.');
    const tareKg = tare.trim() === '' ? 0 : parseDecimal(tare);
    if (tareKg === undefined) return void info('Tara non valida', 'Scrivi un numero (es. 20).');
    setBusy(true);
    try {
      await onSubmit({ name, muscleGroupId: groupId, metric, weightMode: mode, tareKg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="lab">Nome dell'esercizio</span>
      <input className="input" value={name} maxLength={80} placeholder="es. Distensioni panca piana" onChange={(e) => setName(e.target.value)} />

      <span className="lab">Distretto muscolare</span>
      <div className="chips">
        {groups.map((g) => (
          <button key={g.id} className={`chip ${g.id === groupId ? '' : 't'}`} onClick={() => setGroupId(g.id)}>
            {g.name}
          </button>
        ))}
        <button className="chip t" onClick={() => void addGroup()}>
          + nuovo
        </button>
      </div>

      <span className="lab">Cosa registri</span>
      <Seg<Metric>
        value={metric}
        options={[
          { value: 'weightReps', label: 'Peso + rep' },
          { value: 'reps', label: 'Solo rep / fatto' },
        ]}
        onChange={setMetric}
      />
      {metric === 'reps' && (
        <div className="mut" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.45 }}>
          Per corpo libero, addome e cardio: le ripetizioni sono facoltative e puoi scrivere una nota per serie (es. "20 min, pendenza 6").
        </div>
      )}

      {metric === 'weightReps' && (
        <>
          <span className="lab">Peso</span>
          <Seg<WeightMode>
            value={mode}
            options={[
              { value: 'perSide', label: 'Per lato' },
              { value: 'total', label: 'Totale' },
            ]}
            onChange={setMode}
          />
          <div className="mut" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.45 }}>
            {mode === 'perSide'
              ? 'Bilanciere e manubri: inserisci il peso di un lato; l\'app mostra anche il totale (×2, più la tara).'
              : 'Macchinari: inserisci direttamente il peso totale.'}
          </div>
          {mode === 'perSide' && (
            <>
              <span className="lab">Tara (peso a vuoto, es. bilanciere) — facoltativa</span>
              <input className="input" inputMode="decimal" value={tare} placeholder="0" onChange={(e) => setTare(e.target.value)} />
            </>
          )}
        </>
      )}

      <button className="btn primary block" style={{ marginTop: 20 }} disabled={busy} onClick={() => void submit()}>
        {submitLabel}
      </button>
    </div>
  );
}

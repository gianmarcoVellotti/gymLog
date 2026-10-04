import type { SessionExercise, SetLog } from '../../domain/types';
import { addSetToSessionExercise, setSessionExerciseRest } from '../../services/sessions';
import { parseClockInput } from '../../timer/rest';
import { TAG_INFO, TAG_LABEL } from '../lib/glossary';
import { clockLabel, formatKg } from '../lib/format';
import { navigate } from '../router';
import { InfoButton } from './common';
import { useDialogs } from './Dialogs';
import { Icon } from './Icon';
import { SetRow } from './SetRow';

interface Props {
  se: SessionExercise;
  logs: SetLog[];
  step: number;
  mode: 'live' | 'past';
  open: boolean;
  onToggle: () => void;
  onLogged?: () => void;
}

export function ExerciseCard({ se, logs, step, mode, open, onToggle, onLogged }: Props) {
  const { form, run, info } = useDialogs();
  const byNumber = new Map(logs.map((l) => [l.setNumber, l]));
  const total = se.plannedSets.length;
  const done = se.plannedSets.filter((_, i) => byNumber.has(i + 1)).length;
  const usesWeight = se.metric === 'weightReps';
  const unit = se.weightMode === 'perSide' ? 'kg/lato' : 'kg';

  // "Ultima volta": pesi suggeriti (quelli dell'ultima sessione), senza ripetizioni consecutive.
  const lastWeights = se.suggestions.map((s) => s.weightKg).filter((w): w is number => w !== undefined);
  const lastLabel = lastWeights.filter((w, i) => i === 0 || w !== lastWeights[i - 1]).map(formatKg).join(' · ');

  const indices = se.plannedSets.map((_, i) => i).filter((i) => mode === 'live' || byNumber.has(i + 1));

  const editRest = async () => {
    const r = await form({
      title: 'Recupero di questo esercizio',
      message: "Vale solo per l'allenamento in corso. Per cambiarlo sempre, modifica l'esercizio nella scheda. Scrivi secondi (90) o m:ss (1:30).",
      fields: [{ key: 'v', label: 'Recupero', initial: clockLabel(se.restSeconds), inputMode: 'numeric', required: true }],
    });
    if (!r) return;
    const sec = parseClockInput(r.v ?? '');
    if (sec === null) return void info('Formato non valido', 'Scrivi i secondi (es. 90) oppure minuti:secondi (es. 1:30).');
    await run(() => setSessionExerciseRest(se.id, sec));
  };

  return (
    <div className={`ex glass ${mode === 'live' && done === total && total > 0 ? 'done-all' : ''}`}>
      <button className="ex-head" onClick={onToggle} aria-expanded={open}>
        <div style={{ minWidth: 0 }}>
          <h4>{se.exerciseName}</h4>
          <div className="chips" style={{ marginTop: 6 }}>
            <span className="chip">{se.muscleGroupName}</span>
            {se.tags.map((t) => (
              <span key={t} className="chip t">
                {TAG_LABEL[t]}
              </span>
            ))}
            {mode === 'live' && (
              <span className="chip t">
                {done}/{total}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div className="meta" style={{ marginTop: 0 }}>
            Recupero
          </div>
          <b style={{ fontSize: 15 }}>{clockLabel(se.restSeconds)}</b>
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 6 }}>
          {se.tags.length > 0 && (
            <div className="chips" style={{ alignItems: 'center' }}>
              {se.tags.map((t) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span className="chip">{TAG_LABEL[t]}</span>
                  <InfoButton title={TAG_INFO[t].title}>{TAG_INFO[t].text}</InfoButton>
                </span>
              ))}
            </div>
          )}
          {se.notes && <div className="mut" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.45 }}>{se.notes}</div>}
          {usesWeight && lastLabel && mode === 'live' && (
            <div className="mut" style={{ fontSize: 12.5, marginTop: 8 }}>
              Ultima volta: {lastLabel} {unit}
            </div>
          )}

          {indices.map((i) => (
            <SetRow
              key={i}
              se={se}
              index={i}
              planned={se.plannedSets[i]!}
              suggestion={se.suggestions[i] ?? {}}
              log={byNumber.get(i + 1)}
              step={step}
              mode={mode}
              onLogged={onLogged}
            />
          ))}

          <div className="chips" style={{ marginTop: 12 }}>
            {mode === 'live' && (
              <>
                <button className="chip t" onClick={() => void run(() => addSetToSessionExercise(se.id))}>
                  <Icon name="plus" size={14} /> serie
                </button>
                <button className="chip t" onClick={() => void editRest()}>
                  Recupero
                </button>
              </>
            )}
            <button className="chip t" onClick={() => navigate(`/more/exercises/${se.exerciseId}`)}>
              Storico
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

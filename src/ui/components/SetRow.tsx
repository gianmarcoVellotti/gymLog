import { useEffect, useState } from 'react';
import { totalWeightKg } from '../../domain/calc';
import type { PlannedSet, SessionExercise, SetKind, SetLog, SuggestedSet } from '../../domain/types';
import { deleteSetLog, logSet, updateSetLog } from '../../services/sessions';
import { KIND_INFO, RIR_INFO } from '../lib/glossary';
import { formatKg, KIND_LABEL, KIND_SHORT, parseDecimal, parseIntStrict } from '../lib/format';
import { InfoButton } from './common';
import { useDialogs } from './Dialogs';
import { Icon } from './Icon';

const numText = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

function NumField({
  value,
  unit,
  placeholder,
  decimal,
  suggested,
  logged,
  bad,
  onChange,
  onStep,
  onCommit,
  label,
}: {
  value: string;
  unit: string;
  placeholder?: string;
  decimal: boolean;
  suggested: boolean;
  logged: boolean;
  bad: boolean;
  onChange: (v: string) => void;
  onStep: (dir: -1 | 1) => void;
  onCommit: () => void;
  label: string;
}) {
  return (
    <div className={`num ${suggested ? 'sug' : ''} ${logged ? 'logged' : ''} ${bad ? 'bad' : ''}`}>
      <button aria-label={`${label} meno`} onClick={() => onStep(-1)}>
        −
      </button>
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        inputMode={decimal ? 'decimal' : 'numeric'}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button aria-label={`${label} più`} onClick={() => onStep(1)}>
        +
      </button>
      <span className="unit">{unit}</span>
    </div>
  );
}

export interface SetRowProps {
  se: SessionExercise;
  index: number;
  planned: PlannedSet;
  suggestion: SuggestedSet;
  log?: SetLog;
  step: number;
  /** 'live' durante l'allenamento (✓ registra); 'past' in sessioni concluse (solo correzione). */
  mode: 'live' | 'past';
  onLogged?: () => void;
}

export function SetRow({ se, index, planned, suggestion, log, step, mode, onLogged }: SetRowProps) {
  const { confirm, run } = useDialogs();
  const usesWeight = se.metric === 'weightReps';
  const [w, setW] = useState(numText(log?.weightKg ?? suggestion.weightKg));
  const [r, setR] = useState(numText(log?.reps ?? suggestion.reps));
  const [kind, setKind] = useState<SetKind>(log?.kind ?? planned.kind);
  const [rir, setRir] = useState<number | undefined>(log?.rir);
  const [note, setNote] = useState(log?.note ?? '');
  const [open, setOpen] = useState(se.metric === 'reps' && !log && mode === 'live');
  const [bad, setBad] = useState<{ w?: boolean; r?: boolean }>({});

  // Se la riga cambia da fuori (aggiornamento del DB), riallinea i campi.
  useEffect(() => {
    if (!log) return;
    setW(numText(log.weightKg));
    setR(numText(log.reps));
    setKind(log.kind);
    setRir(log.rir);
    setNote(log.note ?? '');
  }, [log?.weightKg, log?.reps, log?.kind, log?.rir, log?.note]); // eslint-disable-line react-hooks/exhaustive-deps

  const weight = parseDecimal(w);
  const reps = parseIntStrict(r);
  const unit = se.weightMode === 'perSide' ? 'kg/lato' : 'kg';
  const logged = !!log;

  const parsed = () => {
    const wBad = usesWeight && w.trim() !== '' && weight === undefined;
    const rBad = (usesWeight && reps === undefined) || (!usesWeight && r.trim() !== '' && reps === undefined);
    setBad({ w: wBad, r: rBad });
    return !wBad && !rBad;
  };

  const saveRow = async (patch?: { kind?: SetKind; rir?: number | null; note?: string | null }) => {
    if (!log) return;
    if (!parsed()) return;
    await run(() =>
      updateSetLog(log.id, {
        weightKg: usesWeight ? (weight ?? null) : undefined,
        reps: reps ?? null,
        ...patch,
      }),
    );
  };

  const commit = () => {
    if (!log) return;
    const changed = (usesWeight && weight !== log.weightKg) || reps !== log.reps;
    if (changed) void saveRow();
  };

  const stepWeight = (dir: -1 | 1) => {
    const base = weight ?? suggestion.weightKg ?? 0;
    const next = Math.max(0, Math.round((base + dir * step) * 100) / 100);
    setW(numText(next));
    if (log) void run(() => updateSetLog(log.id, { weightKg: next }));
  };
  const stepReps = (dir: -1 | 1) => {
    const base = reps ?? suggestion.reps ?? 0;
    const next = Math.max(0, base + dir);
    setR(String(next));
    if (log) void run(() => updateSetLog(log.id, { reps: next }));
  };

  const onCheck = async () => {
    if (log) {
      const ok = await confirm({
        title: 'Rimuovere questa serie?',
        message: `Serie ${index + 1}: ${usesWeight && log.weightKg !== undefined ? `${formatKg(log.weightKg)} ${unit} × ` : ''}${log.reps ?? '—'}. La registrazione verrà cancellata.`,
        confirmLabel: 'Rimuovi',
        danger: true,
      });
      if (ok) await run(() => deleteSetLog(log.id));
      return;
    }
    if (!parsed()) return;
    const done = await run(() =>
      logSet({
        sessionExerciseId: se.id,
        setNumber: index + 1,
        kind,
        reps,
        weightKg: usesWeight ? weight : undefined,
        rir,
        note,
      }),
    );
    if (done) onLogged?.();
  };

  const total = usesWeight && se.weightMode === 'perSide' && weight !== undefined ? totalWeightKg(weight, 'perSide', se.tareKg) : undefined;
  const marker = KIND_SHORT[kind];

  return (
    <>
      <div className={`setrow ${usesWeight ? '' : 'single'}`}>
        <button className={`n glass ${marker ? 'kind' : ''}`} aria-label={`Serie ${index + 1}: dettagli`} onClick={() => setOpen((o) => !o)}>
          {index + 1}
          {marker && <small style={{ fontSize: 9, marginLeft: 1 }}>{marker}</small>}
        </button>
        {usesWeight && (
          <NumField
            label="Peso"
            value={w}
            unit={unit}
            decimal
            suggested={!logged && suggestion.weightKg !== undefined && w === numText(suggestion.weightKg)}
            logged={logged}
            bad={!!bad.w}
            onChange={(v) => {
              setW(v);
              setBad((b) => ({ ...b, w: false }));
            }}
            onStep={stepWeight}
            onCommit={commit}
          />
        )}
        <NumField
          label="Ripetizioni"
          value={r}
          unit="rep"
          placeholder={usesWeight ? undefined : '—'}
          decimal={false}
          suggested={!logged && suggestion.reps !== undefined && r === numText(suggestion.reps)}
          logged={logged}
          bad={!!bad.r}
          onChange={(v) => {
            setR(v);
            setBad((b) => ({ ...b, r: false }));
          }}
          onStep={stepReps}
          onCommit={commit}
        />
        <button className={`ck ${logged ? 'done' : ''}`} aria-label={logged ? 'Serie registrata: tocca per rimuovere' : 'Registra la serie'} onClick={() => void onCheck()}>
          <Icon name={logged && mode === 'past' ? 'trash' : 'check'} />
        </button>
      </div>
      {total !== undefined && (
        <div className="totline">
          Totale: {formatKg(total)} kg{se.tareKg > 0 ? ` (incl. tara ${formatKg(se.tareKg)} kg)` : ''}
        </div>
      )}
      {open && (
        <div className="setdetail">
          <div className="row-between">
            <span className="lab">Tipo di serie</span>
            <InfoButton title="Tipi di serie">
              {(['normal', 'warmup', 'amrap', 'drop'] as SetKind[]).map((k) => (
                <p key={k}>
                  <b>{KIND_INFO[k].title}.</b> {KIND_INFO[k].text}
                </p>
              ))}
            </InfoButton>
          </div>
          <div className="chips">
            {(['normal', 'warmup', 'amrap', 'drop'] as SetKind[]).map((k) => (
              <button
                key={k}
                className={`chip ${k === kind ? '' : 't'}`}
                onClick={() => {
                  setKind(k);
                  if (log) void saveRow({ kind: k });
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="row-between">
            <span className="lab">RIR (ripetizioni di riserva)</span>
            <InfoButton title={RIR_INFO.title}>{RIR_INFO.text}</InfoButton>
          </div>
          <div className="chips">
            {[undefined, 0, 1, 2, 3, 4, 5].map((v) => (
              <button
                key={String(v)}
                className={`chip ${v === rir ? '' : 't'}`}
                onClick={() => {
                  setRir(v);
                  if (log) void saveRow({ rir: v ?? null });
                }}
              >
                {v === undefined ? '—' : v}
              </button>
            ))}
          </div>
          <span className="lab">Nota della serie</span>
          <input
            className="input"
            value={note}
            maxLength={500}
            placeholder={se.metric === 'reps' ? 'es. 20 min, pendenza 6, vel 5.5' : 'facoltativa'}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (log && (log.note ?? '') !== note.trim()) void saveRow({ note: note.trim() === '' ? null : note });
            }}
          />
        </div>
      )}
    </>
  );
}

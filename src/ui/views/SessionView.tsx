import { useEffect, useRef, useState } from 'react';
import { formatElapsed } from '../../domain/calc';
import { ERR, DomainError } from '../../domain/errors';
import type { ID, SessionExercise } from '../../domain/types';
import { discardSession, endSession, getSessionView } from '../../services/sessions';
import { getSettings } from '../../services/settings';
import { ExerciseCard } from '../components/ExerciseCard';
import { Loading } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';
import { useNow } from '../hooks/useNow';
import { navigate } from '../router';
import { getActiveSession } from '../../services/sessions';

/** Blocchi: un esercizio singolo o un gruppo di superset consecutivi. */
function toBlocks(list: SessionExercise[]): SessionExercise[][] {
  const blocks: SessionExercise[][] = [];
  for (const se of list) {
    const last = blocks[blocks.length - 1];
    if (se.groupId && last && last[0]?.groupId === se.groupId) last.push(se);
    else blocks.push([se]);
  }
  return blocks;
}

export function SessionView() {
  const active = useLive(() => getActiveSession(), []);
  const view = useLive(() => (active ? getSessionView(active.id) : undefined), [active?.id]);
  const settings = useLive(() => getSettings(), []);
  const now = useNow(!!active);
  const { confirm, run } = useDialogs();
  const [open, setOpen] = useState<Set<ID>>(new Set());
  const initialised = useRef(false);

  const exercises = view?.exercises;
  const logs = view?.logs;
  const latest = useRef({ exercises, logs });
  latest.current = { exercises, logs };

  const remaining = (se: SessionExercise) =>
    se.plannedSets.filter((_, i) => !logs?.some((l) => l.sessionExerciseId === se.id && l.setNumber === i + 1)).length;

  // Apre per default il primo esercizio non completato (con i suoi compagni di superset).
  useEffect(() => {
    if (initialised.current || !exercises || !logs) return;
    initialised.current = true;
    const first = exercises.find((e) => remaining(e) > 0) ?? exercises[0];
    if (first) setOpen(new Set(exercises.filter((e) => e.id === first.id || (first.groupId && e.groupId === first.groupId)).map((e) => e.id)));
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (active === undefined || (active && !view)) return <Loading />;
  if (!active || !view || !exercises || !logs) {
    return (
      <div className="empty">
        Nessun allenamento in corso.
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={() => navigate('/')}>
            Scegli il giorno
          </button>
        </div>
      </div>
    );
  }

  const session = view.session;

  const toggle = (id: ID) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Dopo una serie registrata: se l'esercizio (o il giro di superset) è finito, apri il prossimo da fare.
  // Si attende il ridisegno con i dati aggiornati (liveQuery) prima di contare le serie rimaste.
  const afterLogged = (se: SessionExercise) => {
    window.setTimeout(() => {
      const { exercises: ex, logs: lg } = latest.current;
      if (!ex || !lg) return;
      const left = (m: SessionExercise) =>
        m.plannedSets.filter((_, i) => !lg.some((l) => l.sessionExerciseId === m.id && l.setNumber === i + 1)).length;
      const mates = se.groupId ? ex.filter((e) => e.groupId === se.groupId) : [se];
      if (mates.some((m) => left(m) > 0)) return;
      const idx = ex.findIndex((e) => e.id === se.id);
      const next = ex.slice(idx + 1).find((e) => left(e) > 0 && (!se.groupId || e.groupId !== se.groupId));
      if (!next) return;
      setOpen(new Set(ex.filter((e) => e.id === next.id || (next.groupId && e.groupId === next.groupId)).map((e) => e.id)));
    }, 300);
  };

  const finish = async () => {
    const ok = await confirm({
      title: "Terminare l'allenamento?",
      message: `Durata finora ${formatElapsed(Date.now() - session.startedAt)} · ${view.stats.sets} ${view.stats.sets === 1 ? 'serie registrata' : 'serie registrate'}.`,
      confirmLabel: 'Termina',
    });
    if (!ok) return;
    try {
      await endSession(session.id);
      navigate(`/sessions/${session.id}`, { replace: true });
    } catch (e) {
      if (e instanceof DomainError && e.code === ERR.SESSION_EMPTY) {
        const discard = await confirm({
          title: 'Nessuna serie registrata',
          message: "Non hai registrato nessuna serie: l'allenamento verrà scartato e non comparirà nel calendario.",
          confirmLabel: 'Scarta allenamento',
          danger: true,
        });
        if (discard) {
          await run(() => discardSession(session.id));
          navigate('/', { replace: true });
        }
      } else {
        await run(() => Promise.reject(e));
      }
    }
  };

  return (
    <div>
      <div className="row-between">
        <div>
          <div className="kick">
            Giorno {session.dayLabel}
            {session.dayTitle ? ` · ${session.dayTitle}` : ''} · in corso
          </div>
          <div className="elapsed" style={{ marginTop: 8 }} aria-label="Durata dell'allenamento">
            {formatElapsed(now - session.startedAt)}
          </div>
        </div>
        <button className="btn glass" onClick={() => void finish()}>
          Termina
        </button>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        {toBlocks(exercises).map((block) => {
          const cards = block.map((se) => (
            <ExerciseCard
              key={se.id}
              se={se}
              logs={logs.filter((l) => l.sessionExerciseId === se.id)}
              step={settings?.weightStepKg ?? 2.5}
              mode="live"
              open={open.has(se.id)}
              onToggle={() => toggle(se.id)}
              onLogged={() => afterLogged(se)}
            />
          ));
          return block.length > 1 ? (
            <div key={block[0]!.id} className="ss" aria-label="Superset">
              {cards}
            </div>
          ) : (
            cards[0]
          );
        })}
        {exercises.length === 0 && <div className="empty">Questo giorno non ha esercizi.</div>}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { formatElapsed } from '../../domain/calc';
import { formatDurationShort } from '../../domain/calc';
import type { ID, SessionExercise } from '../../domain/types';
import { getSessionView, setSessionEnd, setSessionNotes } from '../../services/sessions';
import { getSettings } from '../../services/settings';
import { ExerciseCard } from '../components/ExerciseCard';
import { Loading, TopBar } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';
import { formatDateShort, formatKg, formatTime } from '../lib/format';
import { navigate } from '../router';

function toBlocks(list: SessionExercise[]): SessionExercise[][] {
  const blocks: SessionExercise[][] = [];
  for (const se of list) {
    const last = blocks[blocks.length - 1];
    if (se.groupId && last && last[0]?.groupId === se.groupId) last.push(se);
    else blocks.push([se]);
  }
  return blocks;
}

/** Riepilogo di un allenamento concluso (durata totale, statistiche, note) con correzione delle serie. */
export function SessionDetailView({ sessionId }: { sessionId: string }) {
  const view = useLive(async () => ({ v: await getSessionView(sessionId) }), [sessionId]);
  const settings = useLive(() => getSettings(), []);
  const { form, run } = useDialogs();
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState<Set<ID>>(new Set());

  const savedNotes = view?.v?.session.notes ?? '';
  useEffect(() => setNotes(savedNotes), [savedNotes]);

  if (!view || !settings) return <Loading />;
  const v = view.v;
  if (!v) {
    return (
      <div className="empty">
        Allenamento non trovato.
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => navigate('/calendar')}>
            Vai al calendario
          </button>
        </div>
      </div>
    );
  }
  const { session, exercises, logs, stats } = v;
  if (session.status === 'active') {
    navigate('/session', { replace: true });
    return <Loading />;
  }

  const duration = (session.endedAt ?? session.startedAt) - session.startedAt;
  const toggle = (id: ID) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const editEnd = async () => {
    const r = await form({
      title: "Orario di fine",
      message: `Allenamento iniziato alle ${formatTime(session.startedAt)}. Se l'orario inserito è precedente all'inizio, si intende il giorno dopo.`,
      fields: [{ key: 't', label: 'Ora di fine', type: 'time', initial: formatTime(session.endedAt ?? session.startedAt), required: true }],
    });
    if (!r?.t) return;
    const [hh, mm] = r.t.split(':').map(Number);
    const start = new Date(session.startedAt);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), hh ?? 0, mm ?? 0, 0, 0);
    if (end.getTime() <= session.startedAt) end.setDate(end.getDate() + 1);
    await run(() => setSessionEnd(session.id, end.getTime()));
  };

  return (
    <div>
      <TopBar back="/calendar" kick={`${formatDateShort(session.date)} · Giorno ${session.dayLabel}`} title={session.programName} />

      <div className="glass card" style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 22 }}>
        <div className="kick">Allenamento concluso{session.dayTitle ? ` · ${session.dayTitle}` : ''}</div>
        <div className="big" style={{ marginTop: 14 }}>
          {formatElapsed(duration)}
        </div>
        <div className="mut" style={{ marginTop: 8, fontSize: 14 }}>
          durata totale · {formatTime(session.startedAt)} → {formatTime(session.endedAt ?? session.startedAt)} ({formatDurationShort(duration)})
        </div>
        {session.endedBy === 'auto' && (
          <div className="chip t" style={{ marginTop: 10 }}>
            chiuso automaticamente dopo 1 h senza attività
          </div>
        )}
      </div>

      <div className="stats">
        <div className="glass stat">
          <b>{stats.sets}</b>
          <span>serie</span>
        </div>
        <div className="glass stat">
          <b>{stats.exercises}</b>
          <span>esercizi</span>
        </div>
        <div className="glass stat">
          <b>{formatKg(stats.volumeKg)}</b>
          <span>kg volume</span>
        </div>
      </div>

      <button className="btn block" style={{ marginTop: 12 }} onClick={() => void editEnd()}>
        Modifica orario di fine
      </button>

      <span className="lab">Note della sessione</span>
      <textarea
        className="input"
        rows={3}
        placeholder="Come ti sei sentito oggi?"
        value={notes}
        maxLength={1000}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes.trim() !== savedNotes.trim()) void run(() => setSessionNotes(session.id, notes));
        }}
      />

      <span className="lab">Serie registrate (tocca per correggere)</span>
      <div className="stack">
        {toBlocks(exercises).map((block) => {
          const cards = block.map((se) => (
            <ExerciseCard
              key={se.id}
              se={se}
              logs={logs.filter((l) => l.sessionExerciseId === se.id)}
              step={settings.weightStepKg}
              mode="past"
              open={open.has(se.id)}
              onToggle={() => toggle(se.id)}
            />
          ));
          return block.length > 1 ? (
            <div key={block[0]!.id} className="ss">
              {cards}
            </div>
          ) : (
            cards[0]
          );
        })}
      </div>
    </div>
  );
}

import { formatElapsed } from '../../domain/calc';
import { adjustRest, getActiveSession, setRestSeconds, skipRest, timerOf } from '../../services/sessions';
import { clockLabel } from '../lib/format';
import { formatClock, isOvertime, parseClockInput, remainingMs, restProgress } from '../../timer/rest';
import { useLive } from '../hooks/useLive';
import { useNow } from '../hooks/useNow';
import { navigate } from '../router';
import { useDialogs } from './Dialogs';
import { Icon } from './Icon';

/**
 * Barra della sessione in corso. `full` (schermata sessione): pannello recupero con ±15 / digitazione / salta.
 * `mini` (altre schermate): durata e recupero, tocca per tornare alla sessione.
 * Il timer mostra un tempo calcolato da timestamp e può essere negativo (−0:30).
 */
export function SessionDock({ mode }: { mode: 'full' | 'mini' }) {
  const session = useLive(() => getActiveSession(), []);
  const now = useNow(!!session);
  const { form, run, info } = useDialogs();
  if (!session) return null;

  const timer = timerOf(session);
  const rem = timer ? remainingMs(timer, now) : 0;
  const late = timer ? isOvertime(timer, now) : false;

  if (mode === 'mini') {
    return (
      <button className={`dock glass minibar ${late ? 'late' : ''}`} onClick={() => navigate('/session')} aria-label="Torna all'allenamento">
        <span className="dot" />
        <div style={{ flex: 1 }}>
          <div className="sub" style={{ marginTop: 0 }}>
            Giorno {session.dayLabel} · in corso
          </div>
          <div className="time">{formatElapsed(now - session.startedAt)}</div>
        </div>
        {timer && (
          <div style={{ textAlign: 'right' }}>
            <div className="sub" style={{ marginTop: 0 }}>
              Recupero
            </div>
            <div className="time" style={{ color: late ? 'var(--late)' : undefined }}>
              {formatClock(rem)}
            </div>
          </div>
        )}
        <Icon name="chev" />
      </button>
    );
  }

  if (!timer) return null;

  const progress = restProgress(timer, now);
  const editExact = async () => {
    const r = await form({
      title: 'Recupero',
      message: 'Quanto recupero ti resta da adesso? Scrivi i secondi (es. 90) oppure minuti:secondi (es. 1:30).',
      fields: [{ key: 'v', label: 'Tempo', initial: String(Math.max(0, Math.round(rem / 1000))), inputMode: 'numeric', required: true }],
      confirmLabel: 'Imposta',
    });
    if (!r) return;
    const sec = parseClockInput(r.v ?? '');
    if (sec === null) return void info('Formato non valido', 'Scrivi i secondi (es. 90) oppure minuti:secondi (es. 1:30).');
    await run(() => setRestSeconds(session.id, sec));
  };

  return (
    <div className={`dock glass ${late ? 'late' : ''}`} role="timer" aria-live="off">
      <div
        className="ring"
        style={{ background: `conic-gradient(${late ? 'var(--late)' : 'var(--v1)'} ${Math.round(progress * 100)}%, rgba(255,255,255,0.08) 0)` }}
      >
        <i />
      </div>
      <button style={{ flex: 1, textAlign: 'left' }} onClick={() => void editExact()} aria-label="Imposta il recupero a mano">
        <div className="time">{formatClock(rem)}</div>
        <div className="sub">
          Recupero {clockLabel(Math.round(timer.totalMs / 1000))}
          {late ? ' · scaduto' : ' · tocca per cambiarlo'}
        </div>
      </button>
      <button className="pm" onClick={() => void run(() => adjustRest(session.id, -15))}>
        −15
      </button>
      <button className="pm" onClick={() => void run(() => adjustRest(session.id, 15))}>
        +15
      </button>
      <button className="pm" aria-label="Salta il recupero" onClick={() => void run(() => skipRest(session.id))}>
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

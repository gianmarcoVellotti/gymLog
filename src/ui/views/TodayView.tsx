import { toLocalISODate } from '../../domain/date';
import { getTodayOverview } from '../../services/sessions';
import { getSettings } from '../../services/settings';
import { listProgramSummaries } from '../../services/programs';
import { getActiveSession } from '../../services/sessions';
import { Loading } from '../components/common';
import { Icon } from '../components/Icon';
import { UpdateBanner } from '../components/UpdateBanner';
import { useLive } from '../hooks/useLive';
import { daysAgoLabel, formatDayLong } from '../lib/format';
import { navigate } from '../router';

const BACKUP_REMINDER_MS = 14 * 24 * 60 * 60 * 1000;

export function TodayView() {
  const overview = useLive(async () => ({ today: await getTodayOverview() }), []);
  const settings = useLive(() => getSettings(), []);
  const active = useLive(async () => ({ s: await getActiveSession() }), []);
  const programs = useLive(() => listProgramSummaries(), []);

  if (!overview || !settings || !active || !programs) return <Loading />;
  const today = overview.today;
  const hasData = programs.length > 0;
  const needBackup = hasData && (settings.lastBackupAt === undefined || Date.now() - settings.lastBackupAt > BACKUP_REMINDER_MS);
  const lastBackupText =
    settings.lastBackupAt === undefined
      ? 'Non hai ancora fatto un backup. Salvalo ora.'
      : `Ultimo backup ${daysAgoLabel(toLocalISODate(new Date(settings.lastBackupAt)))}. Salvalo ora.`;

  return (
    <div className="stack">
      <div>
        <div className="kick">{formatDayLong(new Date())}</div>
        <div className="title">Cosa alleni oggi?</div>
      </div>

      <UpdateBanner />

      {active.s && (
        <button className="day-card glass violet" onClick={() => navigate('/session')}>
          <div className="badge glass">{active.s.dayLabel}</div>
          <div style={{ flex: 1 }}>
            <h3>Allenamento in corso</h3>
            <p style={{ color: '#e9defe' }}>Riprendi da dove eri · Giorno {active.s.dayLabel}</p>
          </div>
          <Icon name="chev" />
        </button>
      )}

      {today ? (
        <>
          <div className="glass card row-between">
            <div>
              <div className="mut" style={{ fontSize: 12 }}>
                Scheda attiva
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 2 }}>{today.program.name}</div>
            </div>
            {today.program.startDate && <span className="chip">dal {today.program.startDate.split('-').reverse().join('/')}</span>}
          </div>
          {today.days.map(({ day, exercises, lastDate }) => (
            <button key={day.id} className="day-card glass" onClick={() => navigate(`/day/${day.id}`)}>
              <div className="badge violet">{day.label}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3>{day.title || `Giorno ${day.label}`}</h3>
                <p>
                  {exercises} {exercises === 1 ? 'esercizio' : 'esercizi'} · {lastDate ? `ultima volta ${daysAgoLabel(lastDate)}` : 'mai eseguito'}
                </p>
              </div>
              <Icon name="chev" />
            </button>
          ))}
          {today.days.length === 0 && (
            <div className="glass empty">
              Questa scheda non ha ancora giorni.
              <div style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={() => navigate(`/programs/${today.program.id}`)}>
                  Aggiungi i giorni
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass empty">
          {hasData ? 'Nessuna scheda attiva: attivane una per iniziare ad allenarti.' : 'Benvenuto! Crea la tua prima scheda per iniziare.'}
          <div style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={() => navigate('/programs')}>
              {hasData ? 'Vai alle schede' : 'Crea la prima scheda'}
            </button>
          </div>
        </div>
      )}

      {needBackup && (
        <button className="banner glass" onClick={() => navigate('/more')}>
          <span className="chip">Backup</span> {lastBackupText}
        </button>
      )}
    </div>
  );
}

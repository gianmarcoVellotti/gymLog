import { buildSessionPlan, getActiveSession, startSession } from '../../services/sessions';
import { TAG_LABEL } from '../lib/glossary';
import { Loading, TopBar } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';
import { clockLabel, formatKg, setsSummary } from '../lib/format';
import { navigate } from '../router';

export function DayPreviewView({ dayId }: { dayId: string }) {
  const { run } = useDialogs();
  const plan = useLive(async () => {
    try {
      return { plan: await buildSessionPlan(dayId) };
    } catch {
      return { plan: undefined };
    }
  }, [dayId]);
  const active = useLive(async () => ({ s: await getActiveSession() }), []);

  if (!plan || !active) return <Loading />;
  if (!plan.plan) {
    return (
      <div className="empty">
        Giorno non trovato.
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => navigate('/')}>
            Torna a Oggi
          </button>
        </div>
      </div>
    );
  }
  const { day, items } = plan.plan;

  const start = async () => {
    const id = await run(() => startSession(dayId));
    if (id) navigate('/session');
  };

  return (
    <div>
      <TopBar back="/" kick={`Giorno ${day.label}`} title={day.title || `Giorno ${day.label}`} />
      <div className="stack">
        {items.map((it) => {
          const weights = it.suggestions.map((s) => s.weightKg).filter((w): w is number => w !== undefined);
          const unit = it.weightMode === 'perSide' ? 'kg/lato' : 'kg';
          return (
            <div key={it.order} className="glass card" style={it.groupId ? { borderLeft: '4px solid var(--v3)' } : undefined}>
              <div className="row-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h3>{it.exerciseName}</h3>
                  <div className="chips" style={{ marginTop: 6 }}>
                    <span className="chip">{it.muscleGroupName}</span>
                    {it.tags.map((t) => (
                      <span key={t} className="chip t">
                        {TAG_LABEL[t]}
                      </span>
                    ))}
                    {it.groupId && <span className="chip t">superset</span>}
                  </div>
                </div>
                <div className="mut" style={{ fontSize: 12, textAlign: 'right' }}>
                  Recupero
                  <br />
                  <b style={{ color: 'var(--ink)' }}>{clockLabel(it.restSeconds)}</b>
                </div>
              </div>
              <div className="sub" style={{ marginTop: 8 }}>
                {setsSummary(it.plannedSets)}
              </div>
              {it.metric === 'weightReps' && weights.length > 0 && (
                <div className="sub">
                  Ultima volta: {weights.map(formatKg).join(' · ')} {unit}
                </div>
              )}
              {it.notes && (
                <div className="mut" style={{ fontSize: 13, marginTop: 6 }}>
                  {it.notes}
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div className="empty">Questo giorno non ha esercizi: aggiungili dalla scheda.</div>}
      </div>

      <div className="actionbar">
        {active.s ? (
          <button className="btn primary" onClick={() => navigate('/session')}>
            Riprendi l'allenamento in corso
          </button>
        ) : (
          <button className="btn primary" disabled={items.length === 0} onClick={() => void start()}>
            Inizia allenamento
          </button>
        )}
      </div>
    </div>
  );
}

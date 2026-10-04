import { deleteDay, getDayDetail, moveProgramExercise, setLinkedWithNext, updateDay } from '../../services/programs';
import { Icon } from '../components/Icon';
import { Loading, TopBar } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';
import { clockLabel, setsSummary } from '../lib/format';
import { TAG_LABEL } from '../lib/glossary';
import { navigate } from '../router';

export function DayEditorView({ programId, dayId }: { programId: string; dayId: string }) {
  const detail = useLive(async () => ({ d: await getDayDetail(dayId) }), [dayId]);
  const { confirm, form, run } = useDialogs();
  if (!detail) return <Loading />;
  const d = detail.d;
  const back = `/programs/${programId}`;
  if (!d) {
    return (
      <div className="empty">
        Giorno non trovato.
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => navigate(back)}>
            Torna alla scheda
          </button>
        </div>
      </div>
    );
  }
  const { day, items } = d;

  const edit = async () => {
    const r = await form({
      title: 'Giorno',
      fields: [
        { key: 'label', label: 'Etichetta', initial: day.label, required: true, maxLength: 12 },
        { key: 'title', label: 'Titolo (facoltativo)', initial: day.title ?? '', maxLength: 60 },
      ],
    });
    if (r) await run(() => updateDay(day.id, { label: r.label ?? '', title: r.title ?? '' }));
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Eliminare il giorno ${day.label}?`,
      message: `Verranno tolti dalla scheda il giorno e i suoi ${items.length} esercizi. Gli allenamenti già registrati non cambiano.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    const done = await run(async () => {
      await deleteDay(day.id);
      return true;
    });
    if (done) navigate(back, { replace: true });
  };

  return (
    <div>
      <TopBar
        back={back}
        kick={`${d.program.name} · Giorno ${day.label}`}
        title={day.title || `Giorno ${day.label}`}
        right={
          <button className="iconbtn glass" aria-label="Modifica giorno" onClick={() => void edit()}>
            <Icon name="edit" />
          </button>
        }
      />

      <div>
        {items.map(({ item, exercise }, i) => {
          const next = items[i + 1];
          const linked = !!item.groupId && next?.item.groupId === item.groupId;
          const inGroup = !!item.groupId && (linked || items[i - 1]?.item.groupId === item.groupId);
          return (
            <div key={item.id} className={inGroup ? 'ss' : undefined} style={{ marginTop: i === 0 ? 0 : linked ? 8 : 12 }}>
              <div className="glass listrow" style={{ padding: '10px 12px' }}>
                <button className="listrow grow" style={{ padding: '4px 4px' }} onClick={() => navigate(`/programs/${programId}/day/${dayId}/exercise/${item.id}`)}>
                  <div className="grow">
                    <div className="name">{exercise.name}</div>
                    <div className="small">
                      {setsSummary(item.sets)} · recupero {clockLabel(item.restSeconds)}
                    </div>
                    <div className="chips" style={{ marginTop: 6 }}>
                      <span className="chip">{exercise.metric === 'weightReps' ? (exercise.weightMode === 'perSide' ? 'per lato' : 'peso totale') : 'solo rep'}</span>
                      {item.tags.map((t) => (
                        <span key={t} className="chip t">
                          {TAG_LABEL[t]}
                        </span>
                      ))}
                      {exercise.archived && <span className="chip t">archiviato</span>}
                    </div>
                  </div>
                  <Icon name="chev" />
                </button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <button className="infobtn" aria-label="Sposta su" style={{ opacity: i === 0 ? 0.3 : 1 }} disabled={i === 0} onClick={() => void run(() => moveProgramExercise(item.id, -1))}>
                    <Icon name="up" size={18} />
                  </button>
                  <button
                    className="infobtn"
                    aria-label="Sposta giù"
                    style={{ opacity: i === items.length - 1 ? 0.3 : 1 }}
                    disabled={i === items.length - 1}
                    onClick={() => void run(() => moveProgramExercise(item.id, 1))}
                  >
                    <Icon name="down" size={18} />
                  </button>
                </div>
              </div>
              {next && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
                  <button className={`chip ${linked ? '' : 't'}`} onClick={() => void run(() => setLinkedWithNext(item.id, !linked))}>
                    <Icon name="link" size={14} /> {linked ? 'Superset con il successivo (scollega)' : 'Collega al successivo (superset)'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div className="glass empty">Nessun esercizio in questo giorno.</div>}
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <button className="btn primary block" onClick={() => navigate(`/programs/${programId}/day/${dayId}/exercise/new`)}>
          <Icon name="plus" size={18} /> Aggiungi esercizio
        </button>
        <button className="btn danger block" onClick={() => void remove()}>
          Elimina giorno
        </button>
      </div>
    </div>
  );
}

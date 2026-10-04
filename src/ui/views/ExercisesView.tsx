import { useState } from 'react';
import { normalizeName } from '../../domain/calc';
import { listExercises, listMuscleGroups } from '../../services/catalog';
import { Icon } from '../components/Icon';
import { Loading, TopBar } from '../components/common';
import { useLive } from '../hooks/useLive';
import { navigate } from '../router';

export function ExercisesView() {
  const exercises = useLive(() => listExercises(true), []);
  const groups = useLive(() => listMuscleGroups(true), []);
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  if (!exercises || !groups) return <Loading />;

  const key = normalizeName(q);
  const visible = exercises.filter((e) => (showArchived || !e.archived) && (key === '' || e.nameKey.includes(key)));

  return (
    <div>
      <TopBar
        back="/more"
        kick="Catalogo"
        title="Esercizi"
        right={
          <button className="iconbtn violet" aria-label="Nuovo esercizio" onClick={() => navigate('/more/exercises/new')}>
            <Icon name="plus" />
          </button>
        }
      />
      <input className="input" placeholder="Cerca un esercizio…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ marginTop: 10 }}>
        <button className={`chip ${showArchived ? '' : 't'}`} onClick={() => setShowArchived((v) => !v)}>
          Mostra archiviati
        </button>
      </div>
      {groups.map((g) => {
        const list = visible.filter((e) => e.muscleGroupId === g.id);
        if (list.length === 0) return null;
        return (
          <div key={g.id}>
            <span className="lab">
              {g.name}
              {g.archived ? ' (archiviato)' : ''}
            </span>
            <div className="stack">
              {list.map((e) => (
                <button key={e.id} className="glass listrow" onClick={() => navigate(`/more/exercises/${e.id}`)}>
                  <div className="grow">
                    <div className="name">{e.name}</div>
                    <div className="small">
                      {e.metric === 'weightReps' ? (e.weightMode === 'perSide' ? 'peso per lato' : 'peso totale') : 'solo rep'}
                      {e.archived ? ' · archiviato' : ''}
                    </div>
                  </div>
                  <Icon name="chev" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {visible.length === 0 && <div className="glass empty" style={{ marginTop: 16 }}>Nessun esercizio. Si creano anche direttamente mentre costruisci una scheda.</div>}
    </div>
  );
}

import { createMuscleGroup, listMuscleGroups, renameMuscleGroup, setMuscleGroupArchived } from '../../services/catalog';
import { Icon } from '../components/Icon';
import { Loading, TopBar } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';

export function MuscleGroupsView() {
  const groups = useLive(() => listMuscleGroups(true), []);
  const { form, run } = useDialogs();
  if (!groups) return <Loading />;

  const add = async () => {
    const r = await form({ title: 'Nuovo distretto', fields: [{ key: 'name', label: 'Nome', required: true, maxLength: 40 }], confirmLabel: 'Aggiungi' });
    if (r) await run(() => createMuscleGroup(r.name ?? ''));
  };

  return (
    <div>
      <TopBar
        back="/more"
        kick="Catalogo"
        title="Distretti muscolari"
        right={
          <button className="iconbtn violet" aria-label="Nuovo distretto" onClick={() => void add()}>
            <Icon name="plus" />
          </button>
        }
      />
      <div className="mut" style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
        Rinomina, aggiungi o archivia i distretti. Archiviare non cancella nulla: gli allenamenti passati conservano il nome.
      </div>
      <div className="stack">
        {groups.map((g) => (
          <div key={g.id} className="glass listrow" style={{ opacity: g.archived ? 0.6 : 1 }}>
            <div className="grow">
              <div className="name">{g.name}</div>
              {g.archived && <div className="small">archiviato</div>}
            </div>
            <button
              className="iconbtn glass"
              aria-label={`Rinomina ${g.name}`}
              onClick={async () => {
                const r = await form({ title: 'Rinomina distretto', fields: [{ key: 'name', label: 'Nome', initial: g.name, required: true, maxLength: 40 }] });
                if (r) await run(() => renameMuscleGroup(g.id, r.name ?? ''));
              }}
            >
              <Icon name="edit" />
            </button>
            <button className="btn sm" onClick={() => void run(() => setMuscleGroupArchived(g.id, !g.archived))}>
              {g.archived ? 'Ripristina' : 'Archivia'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { activateProgram, archiveProgram, createProgram, duplicateProgram, listProgramSummaries, type ProgramSummary } from '../../services/programs';
import { Icon } from '../components/Icon';
import { Loading } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';
import { formatDateShort } from '../lib/format';
import { navigate } from '../router';

export function ProgramCard({ s }: { s: ProgramSummary }) {
  const { confirm, form, run } = useDialogs();
  const { program } = s;

  const activate = async () => {
    const ok = await confirm({
      title: program.status === 'draft' ? `Attivare "${program.name}"?` : `Riattivare "${program.name}"?`,
      message: 'La scheda attualmente attiva verrà archiviata: il suo storico resta intatto e la potrai riattivare.',
      confirmLabel: 'Attiva',
    });
    if (ok) await run(() => activateProgram(program.id));
  };
  const archive = async () => {
    const ok = await confirm({
      title: `Archiviare "${program.name}"?`,
      message: 'Non avrai nessuna scheda attiva finché non ne attivi un\'altra. Lo storico resta consultabile.',
      confirmLabel: 'Archivia',
    });
    if (ok) await run(() => archiveProgram(program.id));
  };
  const duplicate = async () => {
    const r = await form({
      title: 'Duplica scheda',
      message: 'Crea una copia in bozza con gli stessi giorni ed esercizi.',
      fields: [{ key: 'name', label: 'Nome della copia', initial: `${program.name} (copia)`, required: true, maxLength: 80 }],
      confirmLabel: 'Duplica',
    });
    if (!r) return;
    const copy = await run(() => duplicateProgram(program.id, r.name));
    if (copy) navigate(`/programs/${copy.id}`);
  };

  const statusChip =
    program.status === 'active' ? (
      <span className="chip">
        <i className="dot" /> Attiva
      </span>
    ) : (
      <span className="chip t">{program.status === 'draft' ? 'Bozza' : 'Archiviata'}</span>
    );

  return (
    <div className="glass card" style={program.status === 'active' ? { borderColor: 'rgba(167,139,250,.5)' } : undefined}>
      <button style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/programs/${program.id}`)}>
        <div className="row-between">
          <h3>{program.name}</h3>
          {statusChip}
        </div>
        <div className="sub">
          {s.days} {s.days === 1 ? 'giorno' : 'giorni'} · {s.exercises} esercizi
          {s.sessions > 0 ? ` · ${s.sessions} allenamenti` : ''}
          {program.startDate ? ` · dal ${formatDateShort(program.startDate)}` : ''}
        </div>
      </button>
      <div className="chips" style={{ marginTop: 12 }}>
        <button className="chip t" onClick={() => navigate(`/programs/${program.id}`)}>
          Modifica
        </button>
        <button className="chip t" onClick={() => void duplicate()}>
          Duplica
        </button>
        {program.status !== 'active' && (
          <button className="chip" onClick={() => void activate()}>
            {program.status === 'draft' ? 'Attiva ora' : 'Riattiva'}
          </button>
        )}
        {program.status === 'active' && (
          <button className="chip t" onClick={() => void archive()}>
            Archivia
          </button>
        )}
      </div>
    </div>
  );
}

export function ProgramsView() {
  const summaries = useLive(() => listProgramSummaries(), []);
  const { form, run } = useDialogs();
  if (!summaries) return <Loading />;

  const create = async () => {
    const r = await form({
      title: 'Nuova scheda',
      message: 'Nasce come bozza: la attivi quando è pronta.',
      fields: [{ key: 'name', label: 'Nome', placeholder: 'es. Ipertrofia Nov–Dic', required: true, maxLength: 80 }],
      confirmLabel: 'Crea',
    });
    if (!r) return;
    const p = await run(() => createProgram(r.name ?? ''));
    if (p) navigate(`/programs/${p.id}`);
  };

  const groups: { title: string; items: ProgramSummary[] }[] = [
    { title: 'Attiva', items: summaries.filter((s) => s.program.status === 'active') },
    { title: 'Bozze', items: summaries.filter((s) => s.program.status === 'draft') },
    { title: 'Archiviate', items: summaries.filter((s) => s.program.status === 'archived') },
  ];

  return (
    <div>
      <div className="row-between">
        <div>
          <div className="kick">Schede</div>
          <div className="title">Le tue schede</div>
        </div>
        <button className="iconbtn violet" aria-label="Nuova scheda" onClick={() => void create()}>
          <Icon name="plus" />
        </button>
      </div>
      {summaries.length === 0 && (
        <div className="glass empty" style={{ marginTop: 18 }}>
          Nessuna scheda. Creane una: puoi avere quanti giorni ed esercizi vuoi.
        </div>
      )}
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.title}>
              <span className="lab">{g.title}</span>
              <div className="stack">
                {g.items.map((s) => (
                  <ProgramCard key={s.program.id} s={s} />
                ))}
              </div>
            </div>
          ),
      )}
    </div>
  );
}

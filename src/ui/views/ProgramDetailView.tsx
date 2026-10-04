import { activateProgram, addDay, archiveProgram, deleteProgram, duplicateProgram, getProgramDetail, moveDay, updateProgram } from '../../services/programs';
import { Icon } from '../components/Icon';
import { Loading, TopBar } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useLive } from '../hooks/useLive';
import { formatDateShort } from '../lib/format';
import { navigate } from '../router';

const STATUS = { draft: 'Bozza', active: 'Attiva', archived: 'Archiviata' } as const;

/** Etichetta suggerita per il giorno successivo: A, B, C… poi numeri. */
const nextLabel = (n: number) => (n < 26 ? String.fromCharCode(65 + n) : String(n + 1));

export function ProgramDetailView({ programId }: { programId: string }) {
  const detail = useLive(async () => ({ d: await getProgramDetail(programId) }), [programId]);
  const { confirm, form, run, info } = useDialogs();
  if (!detail) return <Loading />;
  const d = detail.d;
  if (!d) {
    return (
      <div className="empty">
        Scheda non trovata.
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => navigate('/programs')}>
            Torna alle schede
          </button>
        </div>
      </div>
    );
  }
  const { program, days, sessions } = d;
  const totalExercises = days.reduce((n, x) => n + x.exercises, 0);

  const rename = async () => {
    const r = await form({
      title: 'Scheda',
      fields: [
        { key: 'name', label: 'Nome', initial: program.name, required: true, maxLength: 80 },
        { key: 'notes', label: 'Note', initial: program.notes ?? '', type: 'textarea', maxLength: 1000 },
      ],
    });
    if (r) await run(() => updateProgram(program.id, { name: r.name ?? '', notes: r.notes ?? '' }));
  };

  const add = async () => {
    const r = await form({
      title: 'Nuovo giorno',
      fields: [
        { key: 'label', label: 'Etichetta (es. A)', initial: nextLabel(days.length), required: true, maxLength: 12 },
        { key: 'title', label: 'Titolo (facoltativo)', placeholder: 'es. Petto e spalle', maxLength: 60 },
      ],
      confirmLabel: 'Aggiungi',
    });
    if (!r) return;
    const day = await run(() => addDay(program.id, { label: r.label ?? '', title: r.title }));
    if (day) navigate(`/programs/${program.id}/day/${day.id}`);
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

  const remove = async () => {
    if (sessions > 0) {
      await info(
        'Non si può eliminare',
        `Questa scheda ha ${sessions} ${sessions === 1 ? 'allenamento registrato' : 'allenamenti registrati'}: lo storico non si cancella. Puoi archiviarla.`,
      );
      return;
    }
    const ok = await confirm({
      title: `Eliminare "${program.name}"?`,
      message: `Verranno cancellati ${days.length} ${days.length === 1 ? 'giorno' : 'giorni'} e ${totalExercises} esercizi della scheda. L'operazione non si può annullare.`,
      confirmLabel: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    const done = await run(async () => {
      await deleteProgram(program.id);
      return true;
    });
    if (done) navigate('/programs', { replace: true });
  };

  return (
    <div>
      <TopBar
        back="/programs"
        kick={STATUS[program.status]}
        title={program.name}
        right={
          <button className="iconbtn glass" aria-label="Modifica nome e note" onClick={() => void rename()}>
            <Icon name="edit" />
          </button>
        }
      />
      <div className="mut" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        {days.length} {days.length === 1 ? 'giorno' : 'giorni'} · {totalExercises} esercizi
        {program.startDate ? ` · dal ${formatDateShort(program.startDate)}` : ''}
        {program.endDate ? ` al ${formatDateShort(program.endDate)}` : ''}
        {sessions > 0 ? ` · ${sessions} allenamenti registrati` : ''}
      </div>
      {program.notes && (
        <div className="glass card" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>
          {program.notes}
        </div>
      )}

      <span className="lab">Giorni</span>
      <div className="stack">
        {days.map(({ day, exercises }, i) => (
          <div key={day.id} className="glass listrow" style={{ padding: '10px 12px' }}>
            <button className="listrow grow" style={{ padding: '4px 4px' }} onClick={() => navigate(`/programs/${program.id}/day/${day.id}`)}>
              <div className="badge violet">{day.label}</div>
              <div className="grow">
                <div className="name">{day.title || `Giorno ${day.label}`}</div>
                <div className="small">
                  {exercises} {exercises === 1 ? 'esercizio' : 'esercizi'}
                </div>
              </div>
              <Icon name="chev" />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button className="infobtn" aria-label="Sposta su" disabled={i === 0} style={{ opacity: i === 0 ? 0.3 : 1 }} onClick={() => void run(() => moveDay(day.id, -1))}>
                <Icon name="up" size={18} />
              </button>
              <button
                className="infobtn"
                aria-label="Sposta giù"
                disabled={i === days.length - 1}
                style={{ opacity: i === days.length - 1 ? 0.3 : 1 }}
                onClick={() => void run(() => moveDay(day.id, 1))}
              >
                <Icon name="down" size={18} />
              </button>
            </div>
          </div>
        ))}
        {days.length === 0 && <div className="glass empty">Nessun giorno. Aggiungine quanti ne servono (3, 4, 7…).</div>}
        <button className="btn block" onClick={() => void add()}>
          <Icon name="plus" size={18} /> Aggiungi giorno
        </button>
      </div>

      <span className="lab">Azioni sulla scheda</span>
      <div className="stack">
        {program.status !== 'active' && (
          <button
            className="btn primary block"
            onClick={async () => {
              const ok = await confirm({
                title: `Attivare "${program.name}"?`,
                message: "La scheda attualmente attiva verrà archiviata: il suo storico resta intatto e la potrai riattivare.",
                confirmLabel: 'Attiva',
              });
              if (ok) await run(() => activateProgram(program.id));
            }}
          >
            {program.status === 'draft' ? 'Attiva scheda' : 'Riattiva scheda'}
          </button>
        )}
        {program.status === 'active' && (
          <button
            className="btn block"
            onClick={async () => {
              const ok = await confirm({
                title: `Archiviare "${program.name}"?`,
                message: "Non avrai nessuna scheda attiva finché non ne attivi un'altra. Lo storico resta consultabile.",
                confirmLabel: 'Archivia',
              });
              if (ok) await run(() => archiveProgram(program.id));
            }}
          >
            Archivia scheda
          </button>
        )}
        <button className="btn block" onClick={() => void duplicate()}>
          Duplica scheda
        </button>
        <button className="btn danger block" onClick={() => void remove()}>
          Elimina scheda
        </button>
      </div>
    </div>
  );
}

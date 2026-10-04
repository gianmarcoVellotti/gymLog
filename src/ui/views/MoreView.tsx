import { useCallback, useEffect, useState } from 'react';
import { buildBackup, importBackup, parseBackup } from '../../services/backup';
import { getActiveSession } from '../../services/sessions';
import { getSettings, markBackupDone, setWeightStep } from '../../services/settings';
import { toLocalISODate } from '../../domain/date';
import { Icon } from '../components/Icon';
import { Loading } from '../components/common';
import { useDialogs } from '../components/Dialogs';
import { useAppUpdate } from '../components/UpdateBanner';
import { useLive } from '../hooks/useLive';
import { daysAgoLabel, formatKg, parseDecimal } from '../lib/format';
import { saveFile } from '../lib/shareFile';
import { navigate } from '../router';

export function MoreView() {
  const settings = useLive(() => getSettings(), []);
  const active = useLive(async () => ({ s: await getActiveSession() }), []);
  const { confirm, info, run, toast } = useDialogs();
  const { needRefresh, update } = useAppUpdate();
  const [prepared, setPrepared] = useState<{ fileName: string; json: string } | null>(null);
  const [step, setStep] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const prepare = useCallback(async () => {
    setPrepared(await buildBackup());
  }, []);

  // Il file di backup è già pronto quando tocchi "Esporta": Safari richiede che la condivisione parta
  // direttamente dal tap (senza attese asincrone prima).
  useEffect(() => {
    void prepare();
  }, [prepare]);
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);
  useEffect(() => {
    if (settings) setStep(String(settings.weightStepKg).replace('.', ','));
  }, [settings?.weightStepKg]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!settings || !active) return <Loading />;

  const exportBackup = async () => {
    if (!prepared) return;
    const file = new File([prepared.json], prepared.fileName, { type: 'application/json' });
    const result = await saveFile(file);
    if (result === 'cancelled') return;
    await run(() => markBackupDone());
    toast(result === 'shared' ? 'Backup salvato.' : 'Backup scaricato: controlla la cartella Download / File.');
    void prepare();
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    let counts: { programs: number; sessions: number; sets: number };
    try {
      const d = parseBackup(text);
      counts = { programs: d.programs.length, sessions: d.sessions.length, sets: d.setLogs.length };
    } catch (e) {
      await run(() => Promise.reject(e));
      return;
    }
    const ok = await confirm({
      title: 'Sostituire tutti i dati?',
      message: (
        <>
          <p>
            Il backup contiene {counts.programs} {counts.programs === 1 ? 'scheda' : 'schede'}, {counts.sessions}{' '}
            {counts.sessions === 1 ? 'allenamento' : 'allenamenti'} e {counts.sets} serie.
          </p>
          <p>
            <b>Tutti i dati attuali di questo dispositivo verranno sostituiti.</b> L'operazione non si può annullare: se vuoi, esporta prima un backup dei dati attuali.
          </p>
        </>
      ),
      confirmLabel: 'Sostituisci tutto',
      danger: true,
    });
    if (!ok) return;
    const done = await run(async () => {
      await importBackup(text);
      return true;
    });
    if (done) {
      await info('Ripristino completato', 'I dati sono stati ripristinati dal backup.');
      void prepare();
    }
  };

  const lastBackup =
    settings.lastBackupAt === undefined
      ? 'Mai'
      : `${daysAgoLabel(toLocalISODate(new Date(settings.lastBackupAt)))} (${new Date(settings.lastBackupAt).toLocaleDateString('it-IT')})`;

  const saveStep = async () => {
    const n = parseDecimal(step);
    if (n === undefined) return void setStep(String(settings.weightStepKg).replace('.', ','));
    await run(() => setWeightStep(n));
  };

  return (
    <div>
      <div className="kick">Altro</div>
      <div className="title">Impostazioni</div>

      <span className="lab">Catalogo</span>
      <div className="stack">
        <button className="glass listrow" onClick={() => navigate('/more/exercises')}>
          <div className="grow">
            <div className="name">Esercizi</div>
            <div className="small">Anagrafica, archivio e storico per esercizio</div>
          </div>
          <Icon name="chev" />
        </button>
        <button className="glass listrow" onClick={() => navigate('/more/groups')}>
          <div className="grow">
            <div className="name">Distretti muscolari</div>
            <div className="small">Aggiungi, rinomina, archivia</div>
          </div>
          <Icon name="chev" />
        </button>
      </div>

      <span className="lab">Backup e ripristino</span>
      <div className="glass card">
        <div className="row-between">
          <div>
            <div className="name" style={{ fontWeight: 650 }}>
              Ultimo backup
            </div>
            <div className="sub">{lastBackup}</div>
          </div>
        </div>
        <div className="mut" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 10 }}>
          I dati vivono solo su questo telefono: se cancelli l'app o iOS libera spazio, si perdono. Salva il backup nei File (iCloud Drive) ogni tanto.
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          <button className="btn primary block" disabled={!prepared} onClick={() => void exportBackup()}>
            <Icon name="upload" size={18} /> Esporta backup
          </button>
          <label className="btn block" style={{ cursor: 'pointer' }}>
            <Icon name="download" size={18} /> Importa backup
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                void onImportFile(f);
              }}
            />
          </label>
        </div>
      </div>

      <span className="lab">Pesi</span>
      <div className="glass card">
        <div className="name" style={{ fontWeight: 650 }}>
          Incremento dei pulsanti − / +
        </div>
        <div className="sub">Quanto cambia il peso a ogni tocco (attuale: {formatKg(settings.weightStepKg)} kg).</div>
        <div className="row-between" style={{ gap: 10, marginTop: 10 }}>
          <input className="input" inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} onBlur={() => void saveStep()} aria-label="Incremento in kg" />
          <span className="mut">kg</span>
        </div>
      </div>

      <span className="lab">App</span>
      <div className="glass card">
        <div className="sub" style={{ marginTop: 0, lineHeight: 1.55 }}>
          Archiviazione persistente: <b style={{ color: 'var(--ink)' }}>{persisted === null ? 'non disponibile' : persisted ? 'attiva' : 'non garantita'}</b>
          <br />
          Funziona offline. Non invia nessun dato in rete. Non ci sono avvisi a schermo bloccato: il timer di recupero si aggiorna quando riapri l'app.
        </div>
        {persisted === false && (
          <button
            className="btn sm"
            style={{ marginTop: 10 }}
            onClick={async () => {
              const ok = await navigator.storage?.persist?.();
              setPersisted(!!ok);
              toast(ok ? 'Archiviazione persistente attivata.' : "iOS non l'ha concessa: fai backup regolari.");
            }}
          >
            Richiedi archiviazione persistente
          </button>
        )}
        {needRefresh && !active.s && (
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={update}>
            Aggiorna all'ultima versione
          </button>
        )}
        {needRefresh && active.s && <div className="chip t" style={{ marginTop: 12 }}>Aggiornamento pronto: termina l'allenamento per installarlo</div>}
      </div>
    </div>
  );
}

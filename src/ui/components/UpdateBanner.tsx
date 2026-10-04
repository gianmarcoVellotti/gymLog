import { useRegisterSW } from 'virtual:pwa-register/react';
import { getActiveSession } from '../../services/sessions';
import { useLive } from '../hooks/useLive';
import { useDialogs } from './Dialogs';
import { useEffect } from 'react';

/**
 * Aggiornamenti in modalità "prompt": il service worker nuovo resta in attesa finché non tocchi "Aggiorna".
 * Il banner NON compare durante un allenamento: mai ricaricare a metà sessione.
 */
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();
  return { needRefresh, offlineReady, update: () => updateServiceWorker(true) };
}

export function UpdateBanner() {
  const { needRefresh, offlineReady, update } = useAppUpdate();
  const active = useLive(async () => ({ s: await getActiveSession() }), []);
  const { toast } = useDialogs();

  useEffect(() => {
    if (offlineReady) toast("Pronta per l'uso offline.");
  }, [offlineReady, toast]);

  if (!needRefresh || !active || active.s) return null;
  return (
    <button className="banner glass" onClick={update}>
      <span className="chip">Aggiornamento</span> Nuova versione disponibile: tocca per aggiornare.
    </button>
  );
}

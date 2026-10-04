import { useEffect, useState } from 'react';

/**
 * Orologio per ridisegnare timer e durate. È SOLO per il rendering: i valori mostrati si ricalcolano
 * sempre da timestamp (Date.now()), quindi blocco schermo e sospensione non li alterano.
 */
export function useNow(active = true, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', tick);
    };
  }, [active, intervalMs]);
  return now;
}

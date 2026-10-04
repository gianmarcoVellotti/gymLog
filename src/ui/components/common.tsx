import type { ReactNode } from 'react';
import { navigate } from '../router';
import { useDialogs } from './Dialogs';
import { Icon } from './Icon';

export function TopBar({ back, kick, title, right }: { back?: string; kick?: string; title: string; right?: ReactNode }) {
  return (
    <div className="topbar">
      {back && (
        <button className="iconbtn glass" aria-label="Indietro" onClick={() => navigate(back)}>
          <Icon name="back" />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {kick && <div className="kick">{kick}</div>}
        <div className="title sm" style={{ marginTop: kick ? 2 : 0, overflowWrap: 'anywhere' }}>
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Pulsante ⓘ che apre una descrizione in italiano. */
export function InfoButton({ title, children }: { title: string; children: ReactNode }) {
  const { info } = useDialogs();
  return (
    <button className="infobtn" aria-label={`Cos'è: ${title}`} onClick={() => void info(title, children)}>
      <Icon name="info" size={18} />
    </button>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button className="toggle-row glass" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className={`sw ${on ? 'on' : ''}`} />
    </button>
  );
}

export function Loading() {
  return <div className="empty">Caricamento…</div>;
}

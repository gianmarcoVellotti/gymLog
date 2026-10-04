import { useState } from 'react';
import { formatDurationShort } from '../../domain/calc';
import { daysInMonth, toLocalISODate } from '../../domain/date';
import type { ISODate } from '../../domain/types';
import { getMonthSessions } from '../../services/sessions';
import { Icon } from '../components/Icon';
import { useLive } from '../hooks/useLive';
import { formatDateShort, formatMonthTitle, formatTime } from '../lib/format';
import { navigate } from '../router';

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export function CalendarView() {
  const todayIso = toLocalISODate();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<ISODate>(todayIso);
  const sessions = useLive(() => getMonthSessions(ym.y, ym.m), [ym.y, ym.m]);

  const shift = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  const lead = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7; // settimana da lunedì
  const count = daysInMonth(ym.y, ym.m);
  const cells: (ISODate | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, i) => toLocalISODate(new Date(ym.y, ym.m, i + 1))),
  ];
  const byDate = new Map<ISODate, NonNullable<typeof sessions>>();
  for (const s of sessions ?? []) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const ofSelected = byDate.get(selected) ?? [];

  return (
    <div>
      <div className="kick">Calendario</div>
      <div className="row-between" style={{ marginTop: 4 }}>
        <div className="title" style={{ fontSize: 28, marginTop: 0 }}>
          {formatMonthTitle(ym.y, ym.m)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="iconbtn glass" aria-label="Mese precedente" onClick={() => shift(-1)}>
            <Icon name="back" />
          </button>
          <button className="iconbtn glass" aria-label="Mese successivo" onClick={() => shift(1)}>
            <Icon name="chev" />
          </button>
        </div>
      </div>

      <div className="glass cal" style={{ marginTop: 14 }}>
        <div className="h">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="g">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b${i}`} />;
            const list = byDate.get(iso) ?? [];
            return (
              <button key={iso} className={`d ${iso === todayIso ? 'today' : ''} ${iso === selected ? 'sel' : ''}`} onClick={() => setSelected(iso)} aria-label={formatDateShort(iso)}>
                <span>{Number(iso.slice(8))}</span>
                {list[0] && <b>{list[0].dayLabel + (list.length > 1 ? `+${list.length - 1}` : '')}</b>}
              </button>
            );
          })}
        </div>
      </div>

      <span className="lab">{formatDateShort(selected)}</span>
      <div className="stack">
        {ofSelected.map((s) => (
          <button key={s.id} className="glass day-card" onClick={() => navigate(s.status === 'active' ? '/session' : `/sessions/${s.id}`)}>
            <div className="badge violet">{s.dayLabel}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3>{s.dayTitle || s.programName}</h3>
              <p>
                {s.status === 'active'
                  ? 'In corso'
                  : `${formatTime(s.startedAt)} · ${formatDurationShort((s.endedAt ?? s.startedAt) - s.startedAt)}`}{' '}
                · {s.programName}
              </p>
            </div>
            <Icon name="chev" />
          </button>
        ))}
        {sessions && ofSelected.length === 0 && <div className="glass empty">Nessun allenamento in questo giorno.</div>}
      </div>
    </div>
  );
}

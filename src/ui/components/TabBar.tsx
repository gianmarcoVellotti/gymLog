import { Icon, type IconName } from './Icon';

const TABS: { id: string; label: string; icon: IconName; path: string }[] = [
  { id: 'today', label: 'Oggi', icon: 'home', path: '/' },
  { id: 'programs', label: 'Schede', icon: 'list', path: '/programs' },
  { id: 'calendar', label: 'Calendario', icon: 'cal', path: '/calendar' },
  { id: 'more', label: 'Altro', icon: 'gear', path: '/more' },
];

export function tabOf(path: string): string {
  const first = path.split('?')[0]!.split('/').filter(Boolean)[0] ?? '';
  if (first === 'programs') return 'programs';
  if (first === 'calendar' || first === 'sessions') return 'calendar';
  if (first === 'more') return 'more';
  return 'today';
}

export function TabBar({ path }: { path: string }) {
  const current = tabOf(path);
  return (
    <nav className="tabbar glass" aria-label="Navigazione principale">
      {TABS.map((t) => (
        <a key={t.id} href={`#${t.path}`} className={`tab ${t.id === current ? 'on' : ''}`} aria-current={t.id === current ? 'page' : undefined}>
          <Icon name={t.icon} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}

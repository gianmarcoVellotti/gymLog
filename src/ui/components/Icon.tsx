const PATHS = {
  home: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  cal: 'M3.5 8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3zM8 3v4M16 3v4M3.5 10h17',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chev: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  x: 'M6 6l12 12M18 6 6 18',
  info: 'M12 11v5M12 8h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  edit: 'M4 20h4l10-10-4-4L4 16v4zM13 7l4 4',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  skip: 'M5 5l10 7-10 7zM19 5v14',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  download: 'M12 4v12m0 0 4-4m-4 4-4-4M5 20h14',
  upload: 'M12 16V4m0 0 4 4m-4-4-4 4M5 20h14',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

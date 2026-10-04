import { useCallback, useEffect, useState } from 'react';

const read = () => {
  const h = window.location.hash.replace(/^#/, '');
  return h === '' ? '/' : h;
};

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) window.location.replace(`#${path}`);
  else window.location.hash = path;
}

export function usePath(): string {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

/** Confronta un path con un pattern tipo "/programs/:pid/day/:did"; restituisce i parametri o null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('?')[0]!.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = s[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}

export function useNavigate() {
  return useCallback((path: string, opts?: { replace?: boolean }) => navigate(path, opts), []);
}

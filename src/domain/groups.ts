import type { ID } from './types';

interface Groupable {
  id: ID;
  order: number;
  groupId?: ID;
}

/**
 * Regola superset (DESIGN §3 regola 5): un groupId è valido solo se i suoi membri sono almeno 2 e
 * CONSECUTIVI. Altrimenti il gruppo viene sciolto. Restituisce solo gli elementi da aggiornare.
 */
export function normalizeGroups<T extends Groupable>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const positions = new Map<ID, number[]>();
  sorted.forEach((it, i) => {
    if (!it.groupId) return;
    const arr = positions.get(it.groupId) ?? [];
    arr.push(i);
    positions.set(it.groupId, arr);
  });
  const broken = new Set<ID>();
  for (const [gid, pos] of positions) {
    const first = pos[0] ?? 0;
    const last = pos[pos.length - 1] ?? 0;
    if (pos.length < 2 || last - first + 1 !== pos.length) broken.add(gid);
  }
  return sorted.filter((it) => it.groupId && broken.has(it.groupId)).map((it) => ({ ...it, groupId: undefined }));
}

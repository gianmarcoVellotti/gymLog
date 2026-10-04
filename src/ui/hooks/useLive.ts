import { useLiveQuery } from 'dexie-react-hooks';

/** Query reattiva su Dexie: il querier chiama SOLO funzioni dei service. `undefined` = in caricamento. */
export function useLive<T>(querier: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  return useLiveQuery(querier, deps);
}

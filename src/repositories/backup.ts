import { db, TABLE_NAMES, type TableName } from '../db/db';

export type TableDump = Record<TableName, unknown[]>;

export const backupRepo = {
  async readAll(): Promise<TableDump> {
    const out = {} as TableDump;
    for (const name of TABLE_NAMES) out[name] = await db.table(name).toArray();
    return out;
  },
  /** Svuota e riscrive tutte le tabelle. Da chiamare dentro una transazione 'rw' su tutte le tabelle. */
  async replaceAll(data: TableDump): Promise<void> {
    for (const name of TABLE_NAMES) {
      await db.table(name).clear();
      await db.table(name).bulkAdd(data[name]);
    }
  },
};

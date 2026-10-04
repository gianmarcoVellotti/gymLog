import { db, DEFAULT_WEIGHT_STEP_KG } from '../db/db';
import type { Settings } from '../domain/types';

export const settingsRepo = {
  async get(): Promise<Settings> {
    return (await db.settings.get('main')) ?? { id: 'main', weightStepKg: DEFAULT_WEIGHT_STEP_KG };
  },
  async put(s: Settings): Promise<void> {
    await db.settings.put(s);
  },
};

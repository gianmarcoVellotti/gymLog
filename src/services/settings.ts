import { db } from '../db/db';
import type { Settings } from '../domain/types';
import { validStep } from '../domain/validation';
import { settingsRepo } from '../repositories/settings';

export const getSettings = (): Promise<Settings> => settingsRepo.get();

export async function setWeightStep(step: number): Promise<void> {
  const weightStepKg = validStep(step);
  await db.transaction('rw', db.settings, async () => {
    await settingsRepo.put({ ...(await settingsRepo.get()), weightStepKg });
  });
}

export async function markBackupDone(now = Date.now()): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await settingsRepo.put({ ...(await settingsRepo.get()), lastBackupAt: now });
  });
}

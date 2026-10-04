import type { SetKind, Tag } from '../../domain/types';

/** Descrizioni mostrate nell'app (DESIGN §1 "Descrizioni in app"). */
export const KIND_INFO: Record<SetKind, { title: string; text: string }> = {
  normal: { title: 'Normale', text: 'Serie di lavoro standard: fai le ripetizioni previste con il carico scelto.' },
  warmup: {
    title: 'Riscaldamento',
    text: 'Serie leggera di preparazione prima dei carichi di lavoro. Non conta nel volume e non viene usata per proporti il peso la volta dopo.',
  },
  amrap: {
    title: 'AMRAP',
    text: '"As Many Reps As Possible": fai più ripetizioni che riesci, fino a quasi cedere. Il numero in scheda è solo un minimo/riferimento.',
  },
  drop: {
    title: 'Drop set',
    text: 'Appena finisci la serie, riduci il peso (di solito 20–30%) e continua subito, senza recupero, fino a cedere. Ogni riduzione si registra come una riga "drop".',
  },
};

export const TAG_INFO: Record<Tag, { title: string; text: string }> = {
  slow: { title: 'SLOW', text: 'Esecuzione lenta e controllata, soprattutto nella fase di discesa (di solito 3–4 secondi).' },
  iso: {
    title: 'ISO',
    text: 'Pausa isometrica: fermi il movimento nel punto di massima tensione per 1–3 secondi (o per il tempo indicato nelle note).',
  },
};

export const RIR_INFO = {
  title: 'RIR',
  text: '"Repetitions In Reserve": quante ripetizioni avresti ancora potuto fare a fine serie. 0 = sei arrivato a cedere; 2 = ne avevi ancora 2.',
};

export const TAG_LABEL: Record<Tag, string> = { slow: 'SLOW', iso: 'ISO' };

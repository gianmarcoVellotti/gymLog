import { afterEach, describe, expect, it, vi } from 'vitest';
import { adjustRest, formatClock, isOvertime, parseClockInput, remainingMs, restProgress, setRestRemaining, startRest } from './rest';

afterEach(() => vi.useRealTimers());

describe('timer di recupero', () => {
  it('parte dal valore dell\'esercizio e scende col tempo', () => {
    const t = startRest(120, 1_000_000);
    expect(remainingMs(t, 1_000_000)).toBe(120_000);
    expect(remainingMs(t, 1_030_000)).toBe(90_000);
  });

  it('dopo un salto temporale (schermo bloccato) il residuo è corretto, anche negativo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0, 0));
    const t = startRest(60); // usa Date.now() simulato
    vi.setSystemTime(new Date(2026, 9, 4, 10, 1, 30)); // l'app è rimasta sospesa 90 s
    expect(remainingMs(t)).toBe(-30_000);
    expect(isOvertime(t)).toBe(true);
    expect(formatClock(remainingMs(t))).toBe('−0:30');
  });

  it('a 0 esatto non è ancora in ritardo', () => {
    const t = startRest(60, 0);
    expect(remainingMs(t, 60_000)).toBe(0);
    expect(isOvertime(t, 60_000)).toBe(false);
    expect(formatClock(0)).toBe('0:00');
  });

  it('adjustRest sposta la fine di ±15 s e aggiorna il totale', () => {
    const t = adjustRest(startRest(60, 0), 15);
    expect(t).toEqual({ endsAt: 75_000, totalMs: 75_000 });
    expect(remainingMs(adjustRest(t, -15), 0)).toBe(60_000);
    expect(adjustRest(startRest(10, 0), -30).totalMs).toBe(0);
  });

  it('setRestRemaining usa il valore digitato come nuovo residuo', () => {
    expect(remainingMs(setRestRemaining(90, 5_000), 5_000)).toBe(90_000);
  });

  it('progresso dell\'anello 0–1', () => {
    const t = startRest(100, 0);
    expect(restProgress(t, 0)).toBe(0);
    expect(restProgress(t, 50_000)).toBe(0.5);
    expect(restProgress(t, 200_000)).toBe(1);
  });

  it('formatClock e parseClockInput', () => {
    expect(formatClock(125_000)).toBe('2:05');
    expect(formatClock(-1)).toBe('−0:01');
    expect(parseClockInput('90')).toBe(90);
    expect(parseClockInput('1:30')).toBe(90);
    expect(parseClockInput('2:5')).toBe(125);
    expect(parseClockInput('abc')).toBeNull();
    expect(parseClockInput('1:75')).toBeNull();
  });
});

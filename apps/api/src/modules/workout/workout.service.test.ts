import {
  calculateEstimatedOneRm,
  calculateVolume,
  nextUtcDate,
  suggestOverloadWeight,
  toIsoWeek,
  toSessionDateOnly,
} from './workout.service.js';

describe('workout core logic', () => {
  it('calculates volume using sets * reps * weight', () => {
    expect(calculateVolume(4, 8, 80)).toBe(2560);
  });

  it('returns zero volume when weight is missing', () => {
    expect(calculateVolume(4, 8)).toBe(0);
  });

  it('calculates estimated 1RM with Epley formula', () => {
    expect(calculateEstimatedOneRm(100, 5)).toBeCloseTo(116.67, 2);
  });

  it('suggests +2.5kg when previous set was completed', () => {
    expect(suggestOverloadWeight(80, true)).toBe(82.5);
  });

  it('keeps same load when previous set was not completed', () => {
    expect(suggestOverloadWeight(80, false)).toBe(80);
  });

  it('normalizes sessionDate to UTC date boundary', () => {
    const source = new Date('2026-04-09T23:59:59.000+07:00');
    const normalized = toSessionDateOnly(source);

    expect(normalized.toISOString().slice(0, 10)).toBe('2026-04-09');
    expect(normalized.toISOString().endsWith('00:00:00.000Z')).toBe(true);
  });

  it('creates exclusive next day boundary for daily upsert window', () => {
    const start = new Date('2026-04-09T00:00:00.000Z');
    const endExclusive = nextUtcDate(start);

    expect(endExclusive.toISOString()).toBe('2026-04-10T00:00:00.000Z');
  });

  it('formats ISO week key correctly', () => {
    expect(toIsoWeek(new Date('2026-04-09T00:00:00.000Z'))).toBe('2026-W15');
  });
});

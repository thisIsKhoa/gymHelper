import { dashboardOverviewQuerySchema } from './dashboard.schemas.js';

describe('dashboard overview query schema', () => {
  it('uses default weeks when not provided', () => {
    const parsed = dashboardOverviewQuerySchema.parse({});
    expect(parsed.weeks).toBe(16);
  });

  it('parses valid weeks from query string', () => {
    const parsed = dashboardOverviewQuerySchema.parse({ weeks: '24' });
    expect(parsed.weeks).toBe(24);
  });

  it('rejects weeks below lower bound', () => {
    expect(() => dashboardOverviewQuerySchema.parse({ weeks: '3' })).toThrow();
  });

  it('rejects weeks above upper bound', () => {
    expect(() => dashboardOverviewQuerySchema.parse({ weeks: '60' })).toThrow();
  });
});

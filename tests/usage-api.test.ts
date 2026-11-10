import { describe, expect, it } from 'vitest';
import { parseUsage, usableToken } from '../src/shared/usage-api';

describe('parseUsage', () => {
  it('pourcentages → 0..1, date de remise à zéro → secondes', () => {
    const res = parseUsage({
      five_hour: { utilization: 81.0, resets_at: '2026-11-10T11:00:00.503278+00:00' },
      seven_day: { utilization: 12.5, resets_at: '2026-11-10T16:00:00+00:00' },
      seven_day_opus: null,
    });
    expect(res).toEqual({
      fiveHour: { utilization: 0.81, resetsAt: Math.round(Date.parse('2026-11-10T11:00:00.503Z') / 1000) },
      sevenDay: { utilization: 0.125, resetsAt: Date.parse('2026-11-10T16:00:00Z') / 1000 },
    });
  });

  it('réponse inutilisable : null', () => {
    expect(parseUsage(null)).toBeNull();
    expect(parseUsage({ error: { type: 'authentication_error' } })).toBeNull();
    expect(parseUsage({ five_hour: { utilization: 'beaucoup' } })).toBeNull();
  });
});

describe('usableToken', () => {
  const now = 1_000_000;
  it('jeton valable : rendu', () => {
    expect(usableToken({ claudeAiOauth: { accessToken: 'abc', expiresAt: now + 3_600_000 } }, now)).toBe('abc');
  });

  it('expiré (ou presque) ou absent : rien, et jamais de renouvellement', () => {
    expect(usableToken({ claudeAiOauth: { accessToken: 'abc', expiresAt: now + 30_000 } }, now)).toBeNull();
    expect(usableToken({}, now)).toBeNull();
    expect(usableToken(null, now)).toBeNull();
  });
});

import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { normalizeRetentionExtension } from '../src/contracts/s06';

describe('S06 retention extension boundary', () => {
  const valid = { operationId: randomUUID(), expectedVersion: 1, reason: 'Follow-up agreed', expiresAt: '2028-02-29T12:30:00.000Z' };
  test('normalizes the explicit reason and preserves the chosen finite expiry', () => {
    expect(normalizeRetentionExtension({ ...valid, reason: '  Follow-up agreed  ' })).toEqual(valid);
    expect(normalizeRetentionExtension({ ...valid, expiresAt: '9999-12-31T23:59:59.999Z' }).expiresAt).toBe('9999-12-31T23:59:59.999Z');
  });
  test('rejects unknown shape, invalid operation and unsafe versions', () => {
    for (const change of [{ extra: true }, { operationId: 'bad' }, { expectedVersion: 0 }, { expectedVersion: 1.2 }, { expectedVersion: 1e10 }]) expect(() => normalizeRetentionExtension({ ...valid, ...change })).toThrow();
    expect(() => normalizeRetentionExtension(Object.create({ ...valid }))).toThrow();
  });
  test('requires canonical UTC calendar time and nonempty bounded plain reason', () => {
    for (const expiresAt of ['infinity', '2028-02-30T12:30:00.000Z', '2028-02-29', '2028-02-29T12:30:00+07:00', '0000-01-01T00:00:00.000Z']) expect(() => normalizeRetentionExtension({ ...valid, expiresAt })).toThrow();
    for (const reason of ['', ' ', 'a'.repeat(2001), '\u0000secret', '\ud800']) expect(() => normalizeRetentionExtension({ ...valid, reason })).toThrow();
  });
});

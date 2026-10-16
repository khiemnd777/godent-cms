import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { userIdentifier } from '../src/modules/input';
import { normalizeLeadCommand, normalizeLeadQuery, normalizeRecipientSettings, decodeS05Cursor, encodeS05Cursor } from '../src/contracts/lead-operations';

describe('S05 bounded lead operation inputs', () => {
  test('note normalizes NFC, counts code points and rejects hidden fields or invalid scalars', () => {
    const base = { operationId: randomUUID(), expectedVersion: 1, kind: 'note' as const };
    expect(normalizeLeadCommand({ ...base, text: ' a\u0301😀 ' })).toEqual({ ...base, text: 'á😀' });
    expect(() => normalizeLeadCommand({ ...base, text: '😀'.repeat(2001) })).toThrow();
    expect(() => normalizeLeadCommand({ ...base, text: 'a\u0000' })).toThrow();
    expect(() => normalizeLeadCommand({ ...base, text: 'x', actorId: randomUUID() })).toThrow();
    expect(() => normalizeLeadCommand({ ...base, text: 'x', expectedVersion: '1' })).toThrow();
  });
  test('contact distinguishes two-way contact, phone attempt and sent email', () => {
    const base = { operationId: randomUUID(), expectedVersion: 1, kind: 'contact', summary: 'Actual attempt' };
    expect(normalizeLeadCommand({ ...base, channel: 'phone', outcome: 'unanswered' })).toMatchObject({ outcome: 'unanswered' });
    expect(() => normalizeLeadCommand({ ...base, channel: 'email', outcome: 'unanswered' })).toThrow();
    expect(() => normalizeLeadCommand({ ...base, channel: 'phone', outcome: 'email_sent' })).toThrow();
    expect(() => normalizeLeadCommand({ ...base, channel: 'phone', outcome: 'two_way', at: '2026-01-01' })).toThrow();
  });
  test('query normalizes literal substring search and validates calendar ranges', () => {
    expect(normalizeLeadQuery(Object.assign(Object.create(null), { pageSize: '20' }))).toEqual({ pageSize: 20 });
    expect(normalizeLeadQuery({ q: ' a\u0301%_ ', from: '2026-10-01', to: '2026-10-31' })).toMatchObject({ q: 'á%_', pageSize: 20 });
    expect(() => normalizeLeadQuery({ q: 'a' })).toThrow();
    expect(() => normalizeLeadQuery({ from: '2026-02-30' })).toThrow();
    expect(() => normalizeLeadQuery({ from: '2026-11-01', to: '2026-10-31' })).toThrow();
    expect(() => normalizeLeadQuery({ pageSize: '51' })).toThrow();
    expect(() => normalizeLeadQuery({ location: randomUUID() })).toThrow();
  });
  test('cursor binds complete query context and page size', () => {
    const tenant = randomUUID(), id = randomUUID(), query = normalizeLeadQuery({ q: 'minh', pageSize: '20' });
    const cursor = encodeS05Cursor({ tenant, purpose: 'leads', query }, { createdAt: '2026-10-16T02:20:00.123456Z', id });
    expect(decodeS05Cursor(cursor, { tenant, purpose: 'leads', query })).toEqual({ createdAt: '2026-10-16T02:20:00.123456Z', id });
    expect(() => decodeS05Cursor(cursor, { tenant, purpose: 'leads', query: { ...query, pageSize: 50 } })).toThrow();
    expect(() => decodeS05Cursor(cursor, { tenant: randomUUID(), purpose: 'leads', query })).toThrow();
    for (const createdAt of ['2026-02-30T00:00:00.000Z', '2026-13-01T00:00:00.000Z', '2026-10-01T24:00:00.000Z', '0000-01-01T00:00:00.000Z']) {
      expect(() => decodeS05Cursor(encodeS05Cursor({ tenant, purpose: 'leads', query }, { createdAt, id }), { tenant, purpose: 'leads', query })).toThrow();
    }
  });
  test('Better Auth user identifiers are case-preserving text across assignment, filters and recipients', () => {
    const base = { operationId: randomUUID(), expectedVersion: 1 };
    for (const userId of ['AbCdEf0123456789AbCdEf0123456789', 'Admin_With-Dash-42', 'A'.repeat(128), randomUUID()]) {
      expect(userIdentifier(userId)).toBe(userId);
      expect(normalizeLeadCommand({ ...base, kind: 'assign', assigneeUserId: userId })).toEqual({ ...base, kind: 'assign', assigneeUserId: userId });
      expect(normalizeLeadQuery({ assignee: userId }).assignee).toBe(userId);
      expect(normalizeLeadQuery({ assignee: userId }, true).assignee).toBe(userId);
      expect(normalizeRecipientSettings({ ...base, mode: 'selected', recipientUserIds: [userId] }).recipientUserIds).toEqual([userId]);
    }
    expect(normalizeLeadCommand({ ...base, kind: 'assign', assigneeUserId: null })).toEqual({ ...base, kind: 'assign', assigneeUserId: null });
    for (const userId of ['', 'A'.repeat(129), 'a b', 'a\n', 'a/b', 'a\\b', 'a@example.test', 'á', 'a\0', 42, null, {}]) {
      expect(() => userIdentifier(userId)).toThrow(BadRequestException);
      if (userId !== null) expect(() => normalizeLeadCommand({ ...base, kind: 'assign', assigneeUserId: userId })).toThrow();
      expect(() => normalizeLeadQuery({ assignee: userId })).toThrow();
      expect(() => normalizeRecipientSettings({ ...base, mode: 'selected', recipientUserIds: [userId] })).toThrow();
    }
    const userId = 'AbCdEf0123456789AbCdEf0123456789';
    expect(() => normalizeLeadCommand({ operationId: userId, expectedVersion: 1, kind: 'assign', assigneeUserId: userId })).toThrow();
    const cursor = encodeS05Cursor({}, { id: userId, createdAt: '2026-10-16T02:20:00.000Z' });
    expect(() => decodeS05Cursor(cursor, {})).toThrow();
  });
  test('selected recipients require nonempty unique identities and default never accepts arbitrary emails', () => {
    const base = { operationId: randomUUID(), expectedVersion: 1 };
    expect(() => normalizeRecipientSettings({ ...base, mode: 'selected', recipientUserIds: [] })).toThrow();
    const id = randomUUID();
    expect(() => normalizeRecipientSettings({ ...base, mode: 'selected', recipientUserIds: [id, id] })).toThrow();
    expect(() => normalizeRecipientSettings({ ...base, mode: 'default', recipientUserIds: ['a@example.invalid'] })).toThrow();
    expect(normalizeRecipientSettings({ ...base, mode: 'default', recipientUserIds: [] })).toEqual({ ...base, mode: 'default', recipientUserIds: [] });
  });
});

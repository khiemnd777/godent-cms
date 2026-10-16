import { S05_LIMITS, type LeadCommand, type LeadQuery, type RecipientSettingsInput } from './s05';
import { intakeUuid } from './intake';
import { normalizeUserIdentifier } from './user-identifier';

function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Invalid input');
  return value as Record<string, unknown>;
}
function plain(value: unknown, max: number = S05_LIMITS.text): string {
  if (typeof value !== 'string') throw new Error('Invalid text');
  const result = value.normalize('NFC').trim();
  if (!result || [...result].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(result)) throw new Error('Invalid text');
  return result;
}
function base(v: Record<string, unknown>) {
  if (!Number.isSafeInteger(v.expectedVersion) || Number(v.expectedVersion) < 1) throw new Error('Invalid version');
  return { operationId: intakeUuid(v.operationId), expectedVersion: Number(v.expectedVersion) };
}
export function normalizeLeadCommand(input: unknown): LeadCommand {
  const shape = object(input, ['operationId', 'expectedVersion', 'kind', 'assigneeUserId', 'text', 'channel', 'outcome', 'summary', 'reason']);
  const fields: Record<string, string[]> = { assign: ['assigneeUserId'], note: ['text'], contact: ['channel', 'outcome', 'summary'], close: ['reason'], reopen: ['reason'] };
  if (typeof shape.kind !== 'string' || !fields[shape.kind]) throw new Error('Invalid command');
  const v = object(input, ['operationId', 'expectedVersion', 'kind', ...fields[shape.kind]]), common = base(v);
  switch (v.kind) {
    case 'assign': return { ...common, kind: 'assign', assigneeUserId: v.assigneeUserId === null ? null : normalizeUserIdentifier(v.assigneeUserId) };
    case 'note': return { ...common, kind: 'note', text: plain(v.text) };
    case 'contact':
      if (!['phone', 'email'].includes(String(v.channel)) || !['two_way', 'unanswered', 'email_sent'].includes(String(v.outcome)) ||
        (v.outcome === 'unanswered' && v.channel !== 'phone') || (v.outcome === 'email_sent' && v.channel !== 'email')) throw new Error('Invalid contact');
      return { ...common, kind: 'contact', channel: v.channel as 'phone' | 'email', outcome: v.outcome as 'two_way' | 'unanswered' | 'email_sent', summary: plain(v.summary) };
    case 'close':
      if (!['completed', 'unreachable', 'spam', 'duplicate'].includes(String(v.reason))) throw new Error('Invalid reason');
      return { ...common, kind: 'close', reason: v.reason as 'completed' | 'unreachable' | 'spam' | 'duplicate' };
    case 'reopen': return { ...common, kind: 'reopen', reason: plain(v.reason) };
    default: throw new Error('Invalid command');
  }
}
function day(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
  return value;
}
export function normalizePageSize(value: unknown): number {
  if (value === undefined) return S05_LIMITS.pageSize;
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > S05_LIMITS.maxPageSize) throw new Error('Invalid page size');
  return Number(value);
}
export function normalizeLeadQuery(input: unknown, count = false): LeadQuery {
  const v = object(input, count ? ['q', 'status', 'assignee', 'from', 'to'] : ['q', 'status', 'assignee', 'from', 'to', 'cursor', 'pageSize']);
  const q = v.q === undefined ? undefined : plain(v.q, S05_LIMITS.searchMax);
  if (q && [...q].length < S05_LIMITS.searchMin) throw new Error('Invalid query');
  if (v.status !== undefined && !['new', 'assigned', 'contacted', 'closed'].includes(String(v.status))) throw new Error('Invalid status');
  const assignee = v.assignee === undefined ? undefined : ['me', 'unassigned'].includes(String(v.assignee)) ? String(v.assignee) : normalizeUserIdentifier(v.assignee);
  const from = day(v.from), to = day(v.to); if (from && to && from > to) throw new Error('Invalid date range');
  return { ...(q ? { q } : {}), ...(v.status ? { status: v.status as LeadQuery['status'] } : {}), ...(assignee ? { assignee } : {}),
    ...(from ? { from } : {}), ...(to ? { to } : {}), pageSize: normalizePageSize(v.pageSize) };
}
export function normalizeRecipientSettings(input: unknown): RecipientSettingsInput {
  const v = object(input, ['operationId', 'expectedVersion', 'mode', 'recipientUserIds']);
  if (!['default', 'selected'].includes(String(v.mode)) || !Array.isArray(v.recipientUserIds) || v.recipientUserIds.length > 50) throw new Error('Invalid recipients');
  const ids = v.recipientUserIds.map(normalizeUserIdentifier).sort();
  if (new Set(ids).size !== ids.length || (v.mode === 'selected' ? !ids.length : ids.length !== 0)) throw new Error('Invalid recipients');
  return { ...base(v), mode: v.mode as 'default' | 'selected', recipientUserIds: ids };
}
export interface S05Cursor { createdAt: string; id: string }
export function encodeS05Cursor(context: unknown, after: S05Cursor): string {
  return Buffer.from(JSON.stringify({ context, sort: 'created_at_desc,id_desc', ...after })).toString('base64url');
}
export function decodeS05Cursor(value: unknown, context: unknown): S05Cursor | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 1600 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid cursor');
  const v = object(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')), ['context', 'sort', 'createdAt', 'id']);
  if (JSON.stringify(v.context) !== JSON.stringify(context) || v.sort !== 'created_at_desc,id_desc' || typeof v.createdAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,6}Z$/.test(v.createdAt) || !Number.isFinite(Date.parse(v.createdAt))) throw new Error('Invalid cursor');
  const fraction = v.createdAt.slice(20, -1).padEnd(3, '0').slice(0, 3);
  if (v.createdAt.startsWith('0000-') || new Date(v.createdAt).toISOString() !== `${v.createdAt.slice(0, 19)}.${fraction}Z`) throw new Error('Invalid cursor calendar');
  return { createdAt: v.createdAt, id: intakeUuid(v.id) };
}
export function literalSubstring(value: string) { return `%${value.replace(/[\\%_]/g, '\\$&')}%`; }

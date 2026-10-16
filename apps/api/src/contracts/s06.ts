import { intakeUuid } from './intake';
import type { LeadCommandResult } from './s05';

export const S06_LIMITS = { noticeDays: 7, auditDays: 365, batchSize: 10, leaseSeconds: 30, maxAttempts: 5 } as const;
export interface RetentionExtensionInput { operationId: string; expectedVersion: number; reason: string; expiresAt: string }
export type RetentionExtensionResult = LeadCommandResult;
export interface RetentionTiming { serverTime: string; validUntil: string | null }
export interface RetentionNotice {
  revision: number; dueAt: string; status: 'not_due' | 'pending' | 'processing' | 'blocked' | 'captured' | 'failed';
  blockedReason: string | null; recipients: number; captured: number;
}
export const S06_ROUTES = {
  extension: (tenant: string, lead: string) => `/api/tenants/${encodeURIComponent(tenant)}/leads/${encodeURIComponent(lead)}/retention-extension`,
} as const;

/** Explicit finite UTC instant. No implicit time zone and no new maximum retention period. */
export function normalizeRetentionExtension(input: unknown): RetentionExtensionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error('Invalid input');
  const v = input as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'expectedVersion,expiresAt,operationId,reason' || !Number.isSafeInteger(v.expectedVersion) || Number(v.expectedVersion) < 1 || Number(v.expectedVersion) > 999999999) throw new Error('Invalid version');
  if (typeof v.reason !== 'string') throw new Error('Invalid reason');
  const reason = v.reason.normalize('NFC').trim();
  if (!reason || [...reason].length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(reason)) throw new Error('Invalid reason');
  if (typeof v.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.expiresAt) || v.expiresAt.startsWith('0000-') || !Number.isFinite(Date.parse(v.expiresAt)) || new Date(v.expiresAt).toISOString() !== v.expiresAt) throw new Error('Invalid expiry');
  return { operationId: intakeUuid(v.operationId), expectedVersion: Number(v.expectedVersion), reason, expiresAt: v.expiresAt };
}

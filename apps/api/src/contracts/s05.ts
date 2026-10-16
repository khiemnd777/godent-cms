import type { LeadDetail as S04Detail, LeadListItem as S04Item, PreferredChannel } from './s04';
import type { RetentionNotice, RetentionTiming } from './s06';

/** S05 canonical contract. Assignment records responsibility; all tenant administrators retain access. */
export const S05_LIMITS = { text: 2000, searchMin: 2, searchMax: 80, pageSize: 20, maxPageSize: 50, countCap: 10000,
  batchSize: 10, concurrency: 2, leaseSeconds: 30, maxAttempts: 5, deliveryHours: 24 } as const;
export type LeadStatus = 'new' | 'assigned' | 'contacted' | 'closed';
export type ClosureReason = 'completed' | 'unreachable' | 'spam' | 'duplicate';
export type ContactOutcome = 'two_way' | 'unanswered' | 'email_sent';
export interface LeadAssignee { userId: string; name: string; eligible: boolean }
export interface LeadCapabilities { canWrite: boolean; reason: 'tenant_suspended' | null }
export interface LeadListItem extends Omit<S04Item, 'status'> {
  code: string; version: number; status: LeadStatus; assignee: LeadAssignee | null;
  interest: { serviceSlug: string; serviceTitle: string } | null;
  expiresAt: string; normalExpiresAt: string; extensionExpiresAt: string | null; retentionRevision: number;
}
export type NotificationState = 'pending' | 'processing' | 'blocked' | 'captured' | 'failed' | 'cancelled';
export interface LeadNotification { transport: 'local_capture'; status: NotificationState; blockedReason: string | null }
export interface LeadDetail extends Omit<S04Detail, 'status' | 'interest'>, LeadListItem, RetentionTiming {
  closedAt: string | null; closureReason: ClosureReason | null; hasContactAttempt: boolean; hasTwoWayContact: boolean;
  capabilities: LeadCapabilities; notification: LeadNotification;
  retentionNotice: RetentionNotice;
}
export interface LeadPage extends RetentionTiming { items: LeadListItem[]; nextCursor: string | null }
export interface LeadCount extends RetentionTiming { count: number; capped: boolean; newCount: number; newCapped: boolean }
export interface LeadQuery { q?: string; status?: LeadStatus; assignee?: 'me' | 'unassigned' | string; from?: string; to?: string; pageSize: number }
interface CommandBase { operationId: string; expectedVersion: number }
export type LeadCommand = CommandBase & (
  { kind: 'assign'; assigneeUserId: string | null } |
  { kind: 'note'; text: string } |
  { kind: 'contact'; channel: PreferredChannel; outcome: ContactOutcome; summary: string } |
  { kind: 'close'; reason: ClosureReason } |
  { kind: 'reopen'; reason: string }
);
export interface LeadCommandResult { operationId: string; appliedVersion: number; replayed: boolean; lead: LeadDetail }
interface HistoryBase { id: string; createdAt: string; version: number; actor: { userId: string; name: string } }
export type LeadHistoryEvent = HistoryBase & (
  { kind: 'assign'; payload: { before: LeadAssignee | null; after: LeadAssignee | null; status: LeadStatus } } |
  { kind: 'note'; payload: { text: string } } |
  { kind: 'contact'; payload: { channel: PreferredChannel; outcome: ContactOutcome; summary: string; status: LeadStatus } } |
  { kind: 'close'; payload: { reason: ClosureReason; status: 'closed' } } |
  { kind: 'reopen'; payload: { reason: string; status: LeadStatus } } |
  { kind: 'retention_extended'; payload: { reason: string; before: string; expiresAt: string } }
);
export interface LeadHistoryPage extends RetentionTiming { items: LeadHistoryEvent[]; nextCursor: string | null }
export interface LeadAssigneeOption { userId: string; name: string; email: string }
export interface LeadAssigneePage { items: LeadAssigneeOption[]; nextCursor: string | null }
export interface RecipientSettings {
  version: number; mode: 'default' | 'selected'; recipientUserIds: string[];
  defaultRecipient: LeadAssignee | null; needsConfiguration: boolean; capabilities: LeadCapabilities;
  recipients: LeadAssignee[];
}
export interface RecipientSettingsInput extends CommandBase { mode: 'default' | 'selected'; recipientUserIds: string[] }
export interface RecipientSettingsResult { operationId: string; appliedVersion: number; replayed: boolean; settings: RecipientSettings }
export type S05ErrorCode = 'INVALID_INPUT' | 'VERSION_CONFLICT' | 'OPERATION_CONFLICT' | 'INVALID_TRANSITION' |
  'ASSIGNEE_UNAVAILABLE' | 'RECIPIENT_UNAVAILABLE' | 'REAUTH_REQUIRED' | 'LEAD_UNAVAILABLE';
export const S05_ROUTES = {
  leads: (tenant: string) => `/api/tenants/${encodeURIComponent(tenant)}/leads`,
  lead: (tenant: string, id: string) => `/api/tenants/${encodeURIComponent(tenant)}/leads/${encodeURIComponent(id)}`,
  count: (tenant: string) => `/api/tenants/${encodeURIComponent(tenant)}/leads/count`,
  commands: (tenant: string, id: string) => `/api/tenants/${encodeURIComponent(tenant)}/leads/${encodeURIComponent(id)}/commands`,
  history: (tenant: string, id: string) => `/api/tenants/${encodeURIComponent(tenant)}/leads/${encodeURIComponent(id)}/history`,
  assignees: (tenant: string) => `/api/tenants/${encodeURIComponent(tenant)}/lead-assignees`,
  settings: (tenant: string) => `/api/tenants/${encodeURIComponent(tenant)}/lead-notification-settings`,
} as const;

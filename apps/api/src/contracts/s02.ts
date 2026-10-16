/** S02 private administration contract. No public publication or route registry. */
export const ADMIN_ORIGIN = 'http://127.0.0.1:5891';
export const API_HOST = '127.0.0.1:5890';

export interface TenantMembership {
  tenantId: string;
  tenantName: string;
  role: 'tenant_admin';
}
export interface CurrentSession {
  user: { id: string; name: string; email: string; emailVerified: boolean };
  session: { expiresAt: string };
  platformAdmin: boolean;
  tenantMemberships: TenantMembership[];
  csrfToken: string;
}
export interface ServiceDraft {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  locale: 'vi';
  version: number;
  updatedAt: string;
}
export interface DraftInput { title: string; body: string }
export interface SaveDraftInput extends DraftInput { expectedVersion: number }
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface TenantSummary { id: string; name: string; status: 'active' | 'suspended'; createdAt: string }
export interface MemberSummary { userId: string; name: string; email: string; role: 'tenant_admin'; status: 'active' | 'revoked' }
export interface InvitationSummary { id: string; email: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null }
export interface ProvisionTenantInput {
  name: string;
  initialAdminEmail: string;
  initialQuotaPolicy: import('./m5-platform').M5QuotaPolicy & { mode: 'monitor' | 'enforced' };
}
export interface InviteMemberInput { email: string }
export interface AcceptInvitationInput { token: string }

// Custom mutations require JSON, the exact administration Origin and X-CSRF-Token.
// GET endpoints never activate membership. Tokens are delivered only to private mail capture.
export const S02_ROUTES = {
  session: '/api/session',
  reauthenticate: '/api/session/reauth',
  tenants: '/api/platform/tenants',
  acceptInvitation: '/api/invitations/accept',
  tenant: (tenantId: string) => `/api/tenants/${encodeURIComponent(tenantId)}`,
} as const;

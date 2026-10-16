/** S04 local consultation intake. Acknowledgement never confirms an appointment. */
export const S04_LIMITS = { name: 120, email: 254, message: 500, phoneDigitsMin: 7, phoneDigitsMax: 15,
  requestHours: 24, inactivityDays: 180, pageSize: 20, maxPageSize: 50,
  requestsPerMinute: 60, newPerTenMinutes: 5, challengeFrom: 3, challengeSeconds: 300 } as const;
export const S04_CONSENT_VERSION = 'consultation-vi-v1';
export const S04_CONSENT_COPY = 'Tôi đồng ý để phòng khám sử dụng thông tin đã cung cấp để liên hệ tư vấn theo yêu cầu này.';
export const S04_ACK = { status: 'accepted' } as const;
export type PreferredLanguage = 'vi' | 'en';
export type PreferredChannel = 'phone' | 'email';
export interface IntakeInput {
  requestKey: string;
  sourcePublicationId: string;
  name?: string;
  phone?: string;
  email?: string;
  preferredLanguage: PreferredLanguage;
  preferredChannel: PreferredChannel;
  message?: string;
  consent: true;
  interestServiceSlug?: string;
  locationId?:string;
  challenge?: { token: string; answer: string };
}
export interface IntakeAcknowledgement { status: 'accepted' }
export interface IntakeChallengeInput { requestKey: string }
/** Local-only interaction test adapter; this does not establish production bot protection. */
export interface IntakeChallenge { token: string; prompt: string; expiresAt: string; kind: 'local-arithmetic' }
export type IntakeErrorCode = 'INVALID_INPUT' | 'SOURCE_UNAVAILABLE' | 'REQUEST_CONFLICT' | 'RATE_LIMITED' |
  'CAPTCHA_REQUIRED' | 'CAPTCHA_INVALID' | 'CAPTCHA_UNAVAILABLE';
export interface IntakeErrorResponse { statusCode: number; error: string; code?: IntakeErrorCode }
export interface LegacyLeadSource {
  type?:'service';
  tenantSlug: string;
  serviceSlug: string;
  serviceTitle: string;
  publicationId: string;
  path: string;
}
export type LeadSource=LegacyLeadSource|import('./m4').M4LeadSource;
export interface LeadListItem {
  id: string;
  name: string | null;
  phoneMasked: string | null;
  emailMasked: string | null;
  preferredLanguage: PreferredLanguage;
  preferredChannel: PreferredChannel;
  status: 'new';
  createdAt: string;
  source: LeadSource;
}
export interface LeadDetail extends LeadListItem {
  location?:{id:string;publicationId:string;name:string;address:string}|null;
  phone: string | null;
  email: string | null;
  message: string | null;
  consent: { acceptedAt: string; version: string; copy: string };
  interest: { serviceSlug: string; serviceTitle: string } | null;
  lastActivityAt: string;
  expiresAt: string;
}
export interface LeadPage { items: LeadListItem[]; nextCursor: string | null }
export const S04_ROUTES = {
  intake: (tenantSlug: string, serviceSlug: string) => `/api/public/intake/sites/${encodeURIComponent(tenantSlug)}/services/${encodeURIComponent(serviceSlug)}`,
  challenge: (tenantSlug: string, serviceSlug: string) => `/api/public/intake/sites/${encodeURIComponent(tenantSlug)}/services/${encodeURIComponent(serviceSlug)}/challenge`,
  leads: (tenantId: string) => `/api/tenants/${encodeURIComponent(tenantId)}/leads`,
  lead: (tenantId: string, id: string) => `/api/tenants/${encodeURIComponent(tenantId)}/leads/${encodeURIComponent(id)}`,
} as const;

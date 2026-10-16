/** S07 media contract. URLs always use the current-eligibility gateway. */
export const MEDIA_LIMITS = { bytes: 5 * 1024 * 1024, pixels: 16_000_000, edge: 8192,
  multipartOverhead: 16 * 1024, signedSeconds: 60, processingSeconds: 15, derivativeEdge: 1600 } as const;
export type MediaKind = 'ordinary' | 'patient_derived';
export type MediaState = 'uploading' | 'processing' | 'ready' | 'rejected' | 'withdrawn';
export type MediaJobState = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export interface ServiceMediaReference { assetId: string; revision: number; alt: string }
export interface MediaAsset { id: string; tenantId: string; materialKind: MediaKind; state: MediaState;
  version: number; revision: number; bytes: number; detectedType: 'jpeg' | 'png' | 'webp' | null;
  width: number | null; height: number | null; createdAt: string; withdrawnAt: string | null;
  rejectionCode: string | null; publishable: boolean; permission: { scope: 'service_cover'; evidenceReference: string; grantedAt: string } | null;
  processing: MediaJobSummary | null; purge: MediaJobSummary | null }
export interface MediaJobSummary { status: MediaJobState; attempts: number; failureCode: string | null; completedAt: string | null }
export interface MediaPage { items: MediaAsset[]; nextCursor: string | null }
export interface MediaPermissionInput { expectedVersion: number; operationId: string; scope: 'service_cover'; evidenceReference: string }
export interface MediaWithdrawalInput { expectedVersion: number; operationId: string; reason: string }
export interface MediaRetryInput { expectedVersion: number; operationId: string }
export interface MediaAccessInput { revision: number; variant: 'cover' | 'original'; purpose: 'admin_preview' }
export interface MediaAccessResult { url: string; expiresAt: string }
export interface PublicMediaBlock extends ServiceMediaReference { width: number; height: number; path: string; profile: 'cover' }
export const S07_ROUTES = {
  media: (tenantId: string) => `/api/tenants/${encodeURIComponent(tenantId)}/media`,
  asset: (tenantId: string, id: string) => `/api/tenants/${encodeURIComponent(tenantId)}/media/${encodeURIComponent(id)}`,
  permission: (tenantId: string, id: string) => `${S07_ROUTES.asset(tenantId,id)}/permission`,
  withdrawal: (tenantId: string, id: string) => `${S07_ROUTES.asset(tenantId,id)}/withdrawal`,
  access: (tenantId: string, id: string) => `${S07_ROUTES.asset(tenantId,id)}/access`,
  retry: (tenantId: string, id: string) => `${S07_ROUTES.asset(tenantId,id)}/retry`,
  publicDerivative: (tenantId: string, id: string, revision: number) => `/api/public/media/${encodeURIComponent(tenantId)}/${encodeURIComponent(id)}/${revision}/cover`,
} as const;

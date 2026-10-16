import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { S02Auth } from '../auth';
import type { S02Database } from '../database';
import { normalizeRetentionExtension, type RetentionExtensionResult } from '../contracts/s06';
import { LeadFailure, type LeadsService } from './leads.service';
import { assertMutationRequest, nodeHeaders, parseIdentifier, type PrivateRequest } from './request-security';

export class RetentionService {
  constructor(private readonly db: S02Database, private readonly identity: S02Auth, private readonly leads: LeadsService) {}
  async extend(request: PrivateRequest, tenant: string, id: string, input: unknown): Promise<RetentionExtensionResult> {
    const tenantId = parseIdentifier(tenant), leadId = parseIdentifier(id), headers = nodeHeaders(request.headers);
    const actor = await this.identity.currentSession(headers);
    if (!actor) throw new UnauthorizedException();
    assertMutationRequest(request.headers);
    if (!this.identity.verifyCsrf(headers, actor)) throw new ForbiddenException();
    let command;
    try { command = normalizeRetentionExtension(input); } catch { throw new LeadFailure('INVALID_INPUT'); }
    const result = await this.db.withTenant(actor, tenantId, async tx => {
      const rows = await tx.execute(sql`SELECT gcms_s06.extend_lead(${tenantId},${leadId},${JSON.stringify(command)}::text::jsonb) AS result`);
      const value = rows[0].result as Record<string, unknown>;
      if (value.code) {
        if (!['INVALID_INPUT', 'VERSION_CONFLICT', 'OPERATION_CONFLICT', 'REAUTH_REQUIRED', 'LEAD_UNAVAILABLE'].includes(String(value.code))) throw new Error('Invalid retention result');
        throw new LeadFailure(value.code as ConstructorParameters<typeof LeadFailure>[0]);
      }
      return value;
    });
    // Re-authorize the read after commit. An expired/revoked lead never returns through a receipt.
    return { ...result, lead: await this.leads.detail({ headers: request.headers, originalUrl: request.originalUrl, method: 'GET' }, tenantId, leadId) } as unknown as RetentionExtensionResult;
  }
}

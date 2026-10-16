import { BadRequestException, ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { S02Auth } from '../auth';
import type { S02Database, S02Transaction, SessionActor } from '../database';
import { decodeS05Cursor, encodeS05Cursor, literalSubstring, normalizeLeadCommand, normalizeLeadQuery, normalizePageSize, normalizeRecipientSettings } from '../contracts/lead-operations';
import { S05_LIMITS, type LeadAssigneePage, type LeadCommandResult, type LeadCount, type LeadDetail, type LeadHistoryPage, type LeadListItem,
  type LeadPage, type LeadQuery, type RecipientSettings, type RecipientSettingsResult, type S05ErrorCode } from '../contracts/s05';
import { assertMutationRequest, decodePageCursor, encodePageCursor, isMutation, nodeHeaders, parseIdentifier, type PrivateRequest } from './request-security';

export class LeadFailure extends HttpException {
  constructor(readonly code: S05ErrorCode) { super({ code }, code === 'INVALID_INPUT' ? 400 : code === 'REAUTH_REQUIRED' ? 403 : code === 'LEAD_UNAVAILABLE' ? 404 : 409); }
}
function parsed<T>(action: () => T): T { try { return action(); } catch { throw new LeadFailure('INVALID_INPUT'); } }
const columns = sql`l.id,l.name,'YC-'||lpad(l.code_number::text,greatest(6,length(l.code_number::text)),'0') AS code,l.version,l.status,
  gcms_s05.assignee(l.tenant_id,l.assignee_user_id) AS assignee,
  CASE WHEN l.phone IS NULL THEN NULL ELSE repeat('•',greatest(length(l.phone)-3,0))||right(l.phone,3) END AS "phoneMasked",
  CASE WHEN l.email IS NULL THEN NULL ELSE left(l.email,1)||'***@'||split_part(l.email,'@',2) END AS "emailMasked",
  l.preferred_language AS "preferredLanguage",l.preferred_channel AS "preferredChannel",l.created_at AS "createdAt",
  to_char(l.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime",
  jsonb_build_object('tenantSlug',l.source_tenant_slug,'serviceSlug',l.source_service_slug,'serviceTitle',l.source_service_title,
    'publicationId',l.source_publication_id,'path',l.source_path) AS source,
  CASE WHEN l.interest_service_id IS NULL THEN NULL ELSE jsonb_build_object('serviceSlug',l.interest_service_slug,'serviceTitle',l.interest_service_title) END AS interest`;
function item(row: Record<string, unknown>): LeadListItem {
  const { cursorTime, ...value } = row; void cursorTime;
  return { ...value, createdAt: new Date(String(value.createdAt)).toISOString() } as unknown as LeadListItem;
}
function filters(tenant: string, q: LeadQuery, actor: SessionActor) {
  const assignee = q.assignee === 'me' ? actor.userId : q.assignee;
  return sql`l.tenant_id=${tenant} AND l.expires_at>clock_timestamp()
    ${q.q ? sql`AND (l.name ILIKE ${literalSubstring(q.q)} ESCAPE E'\\\\' OR 'YC-'||lpad(l.code_number::text,greatest(6,length(l.code_number::text)),'0')=${q.q.toUpperCase()})` : sql``}
    ${q.status ? sql`AND l.status=${q.status}` : sql``}
    ${assignee ? assignee === 'unassigned' ? sql`AND l.assignee_user_id IS NULL` : sql`AND l.assignee_user_id=${assignee}` : sql``}
    ${q.from ? sql`AND l.created_at>=(${q.from}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')` : sql``}
    ${q.to ? sql`AND l.created_at<((${q.to}::date+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')` : sql``}`;
}
export class LeadsService {
  constructor(private readonly db: S02Database, private readonly identity: S02Auth) {}
  private async actor(request: PrivateRequest): Promise<SessionActor> {
    const headers = nodeHeaders(request.headers), actor = await this.identity.currentSession(headers);
    if (!actor) throw new UnauthorizedException();
    if (isMutation(request.method)) { assertMutationRequest(request.headers); if (!this.identity.verifyCsrf(headers, actor)) throw new ForbiddenException(); }
    return actor;
  }
  async list(request: PrivateRequest, tenant: string, input: unknown): Promise<LeadPage> {
    const tenantId = parseIdentifier(tenant), q = parsed(() => normalizeLeadQuery(input));
    const actor = await this.actor(request);
    const context = { tenant: tenantId, purpose: 'leads', query: q, ...(q.assignee === 'me' ? { actorUserId: actor.userId } : {}) };
    const cursor = parsed(() => decodeS05Cursor((input as Record<string, unknown>).cursor, context));
    return this.db.withLeadTenant(actor, tenantId, async (tx, fresh) => {
      const rows = await tx.execute(sql`SELECT ${columns} FROM gcms_s04.lead l WHERE ${filters(tenantId, q, fresh)}
        ${cursor ? sql`AND (l.created_at,l.id)<(${cursor.createdAt}::timestamptz,${cursor.id})` : sql``}
        ORDER BY l.created_at DESC,l.id DESC LIMIT ${q.pageSize + 1}`);
      const selected = rows.slice(0, q.pageSize), last = selected.at(-1);
      return { items: selected.map(row => item(row)), nextCursor: rows.length > q.pageSize && last ? encodeS05Cursor(context, { createdAt: String(last.cursorTime), id: String(last.id) }) : null };
    });
  }
  async count(request: PrivateRequest, tenant: string, input: unknown): Promise<LeadCount> {
    const tenantId = parseIdentifier(tenant), q = parsed(() => normalizeLeadQuery(input, true)), actor = await this.actor(request);
    return this.db.withLeadTenant(actor, tenantId, async (tx, fresh) => {
      const rows = await tx.execute(sql`SELECT (SELECT count(*)::integer FROM (SELECT 1 FROM gcms_s04.lead l WHERE ${filters(tenantId, q, fresh)} LIMIT ${S05_LIMITS.countCap + 1}) limited) AS total,
        (SELECT count(*)::integer FROM (SELECT 1 FROM gcms_s04.lead l WHERE l.tenant_id=${tenantId} AND l.expires_at>clock_timestamp() AND l.status='new' LIMIT ${S05_LIMITS.countCap + 1}) new_rows) AS "newTotal"`);
      const total = Number(rows[0].total), newTotal = Number(rows[0].newTotal);
      return { count: Math.min(total, S05_LIMITS.countCap), capped: total > S05_LIMITS.countCap, newCount: Math.min(newTotal, S05_LIMITS.countCap), newCapped: newTotal > S05_LIMITS.countCap };
    });
  }
  private async get(tx: S02Transaction, tenant: string, id: string): Promise<LeadDetail> {
    const rows = await tx.execute(sql`SELECT ${columns},l.phone,l.email,l.message,
      jsonb_build_object('acceptedAt',l.consent_at,'version',l.consent_version,'copy',l.consent_copy) AS consent,
      l.last_activity_at AS "lastActivityAt",l.expires_at AS "expiresAt",l.closed_at AS "closedAt",l.closure_reason AS "closureReason",
      l.has_contact_attempt AS "hasContactAttempt",l.has_two_way_contact AS "hasTwoWayContact",
      jsonb_build_object('canWrite',t.status='active','reason',CASE WHEN t.status='suspended' THEN 'tenant_suspended' END) AS capabilities,
      gcms_s05.lead_notification(l.tenant_id,l.id) AS notification
      FROM gcms_s04.lead l JOIN gcms_s02.tenant t ON t.id=l.tenant_id WHERE l.tenant_id=${tenant} AND l.id=${id} AND l.expires_at>clock_timestamp()`);
    if (!rows[0]) throw new LeadFailure('LEAD_UNAVAILABLE'); const row = rows[0];
    return { ...item(row), lastActivityAt: new Date(String(row.lastActivityAt)).toISOString(), expiresAt: new Date(String(row.expiresAt)).toISOString(),
      closedAt: row.closedAt ? new Date(String(row.closedAt)).toISOString() : null } as LeadDetail;
  }
  async detail(request: PrivateRequest, tenant: string, id: string): Promise<LeadDetail> {
    const tenantId = parseIdentifier(tenant), leadId = parseIdentifier(id), actor = await this.actor(request);
    return this.db.withLeadTenant(actor, tenantId, tx => this.get(tx, tenantId, leadId));
  }
  async command(request: PrivateRequest, tenant: string, id: string, input: unknown): Promise<LeadCommandResult> {
    const tenantId = parseIdentifier(tenant), leadId = parseIdentifier(id), c = parsed(() => normalizeLeadCommand(input)), actor = await this.actor(request);
    return this.db.withTenant(actor, tenantId, async tx => {
      const rows = await tx.execute(sql`SELECT gcms_s05.lead_command(${tenantId},${leadId},${JSON.stringify(c)}::text::jsonb) AS result`);
      const result = this.result(rows[0].result); return { ...result, lead: await this.get(tx, tenantId, leadId) } as unknown as LeadCommandResult;
    });
  }
  private result(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') throw new Error('Invalid S05 result');
    const result = value as Record<string, unknown>;
    if (typeof result.code === 'string') {
      const codes: S05ErrorCode[] = ['INVALID_INPUT', 'VERSION_CONFLICT', 'OPERATION_CONFLICT', 'INVALID_TRANSITION', 'ASSIGNEE_UNAVAILABLE', 'RECIPIENT_UNAVAILABLE', 'REAUTH_REQUIRED', 'LEAD_UNAVAILABLE'];
      if (!codes.includes(result.code as S05ErrorCode)) throw new Error('Invalid S05 error'); throw new LeadFailure(result.code as S05ErrorCode);
    }
    return result;
  }
  async history(request: PrivateRequest, tenant: string, id: string, input: Record<string, unknown>): Promise<LeadHistoryPage> {
    const tenantId = parseIdentifier(tenant), leadId = parseIdentifier(id), size = parsed(() => normalizePageSize(input.pageSize));
    if (Object.keys(input).some(k => !['cursor', 'pageSize'].includes(k))) throw new BadRequestException();
    const context = { tenant: tenantId, purpose: 'history', lead: leadId, pageSize: size }, cursor = parsed(() => decodeS05Cursor(input.cursor, context)), actor = await this.actor(request);
    return this.db.withLeadTenant(actor, tenantId, async tx => {
      await this.get(tx, tenantId, leadId);
      const rows = await tx.execute(sql`SELECT id,version,kind,payload,created_at AS "createdAt",to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime",
        jsonb_build_object('userId',actor_id,'name',actor_name) AS actor FROM gcms_s05.lead_event WHERE tenant_id=${tenantId} AND lead_id=${leadId}
        ${cursor ? sql`AND (created_at,id)<(${cursor.createdAt}::timestamptz,${cursor.id})` : sql``} ORDER BY created_at DESC,id DESC LIMIT ${size + 1}`);
      const selected = rows.slice(0, size), last = selected.at(-1);
      return { items: selected.map(row => { const { cursorTime, ...value } = row; void cursorTime; return { ...value, createdAt: new Date(String(row.createdAt)).toISOString() }; }),
        nextCursor: rows.length > size && last ? encodeS05Cursor(context, { createdAt: String(last.cursorTime), id: String(last.id) }) : null } as LeadHistoryPage;
    });
  }
  async assignees(request: PrivateRequest, tenant: string, input: Record<string, unknown>): Promise<LeadAssigneePage> {
    const tenantId = parseIdentifier(tenant), size = parsed(() => normalizePageSize(input.pageSize));
    if (Object.keys(input).some(k => !['cursor', 'pageSize', 'q'].includes(k))) throw new BadRequestException();
    const q = input.q === undefined ? undefined : parsed(() => normalizeLeadQuery({ q: input.q }).q);
    const scope = JSON.stringify({ tenantId, q, pageSize: size, purpose: 'assignees' }), after = decodePageCursor(input.cursor, scope), actor = await this.actor(request);
    return this.db.withLeadTenant(actor, tenantId, async tx => {
      const rows = await tx.execute(sql`SELECT u.id AS "userId",u.name,u.email FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
        WHERE m.tenant_id=${tenantId} AND m.status='active' AND u.active AND u.email_verified
        ${q ? sql`AND u.name ILIKE ${literalSubstring(q)} ESCAPE E'\\\\'` : sql``} ${after ? sql`AND u.id>${after}` : sql``} ORDER BY u.id LIMIT ${size + 1}`);
      const selected = rows.slice(0, size), last = selected.at(-1);
      return { items: selected, nextCursor: rows.length > size && last ? encodePageCursor(scope, String(last.userId)) : null } as LeadAssigneePage;
    });
  }
  async settings(request: PrivateRequest, tenant: string): Promise<RecipientSettings> {
    const tenantId = parseIdentifier(tenant), actor = await this.actor(request);
    return this.db.withLeadTenant(actor, tenantId, async tx => (await tx.execute(sql`SELECT gcms_s05.read_settings(${tenantId}) AS settings`))[0].settings as RecipientSettings);
  }
  async saveSettings(request: PrivateRequest, tenant: string, input: unknown): Promise<RecipientSettingsResult> {
    const tenantId = parseIdentifier(tenant), c = parsed(() => normalizeRecipientSettings(input)), actor = await this.actor(request);
    return this.db.withTenant(actor, tenantId, async tx => {
      const result = this.result((await tx.execute(sql`SELECT gcms_s05.settings_command(${tenantId},${JSON.stringify(c)}::text::jsonb) AS result`))[0].result);
      const settings = (await tx.execute(sql`SELECT gcms_s05.read_settings(${tenantId}) AS settings`))[0].settings;
      return { ...result, settings } as unknown as RecipientSettingsResult;
    });
  }
}

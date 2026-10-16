import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { createS02Auth } from '../auth';
import { sendLocalMail } from '../auth/mail';
import type { createS02Database, S02Transaction, SessionActor } from '../database';
import type { CurrentSession, InvitationSummary, MemberSummary, Page, ServiceDraft, TenantSummary } from '../contracts/s02';
import { ADMIN_ORIGIN } from '../contracts/s02';
import { acceptInput, draftInput, emptyInput, invitationInput, provisionInput, reauthInput, saveDraftInput, userIdentifier } from './input';
import { assertMutationRequest, decodePageCursor, encodePageCursor, isMutation, nodeHeaders, parseIdentifier, type PrivateRequest } from './request-security';

type Database = ReturnType<typeof createS02Database>;
type Identity = ReturnType<typeof createS02Auth>;
const PAGE_SIZE = 25;

function rows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows)) return result.rows as T[];
  throw new Error('Unexpected database result');
}
function page<T>(items: T[], scope: string, id: (item: T) => string): Page<T> {
  const visible = items.slice(0, PAGE_SIZE);
  return { items: visible, nextCursor: items.length > PAGE_SIZE ? encodePageCursor(scope, id(visible[visible.length - 1])) : null };
}
function iso(value: string | Date): string { return new Date(value).toISOString(); }
function draft(row: ServiceDraft): ServiceDraft { return { ...row, updatedAt: iso(row.updatedAt) }; }
function invitation(row: InvitationSummary): InvitationSummary {
  return { ...row, expiresAt: iso(row.expiresAt), acceptedAt: row.acceptedAt ? iso(row.acceptedAt) : null,
    revokedAt: row.revokedAt ? iso(row.revokedAt) : null };
}
const draftColumns = sql`id, tenant_id AS "tenantId", title, body, locale, version, updated_at AS "updatedAt"`;
const invitationColumns = sql`id, email, expires_at AS "expiresAt", accepted_at AS "acceptedAt", revoked_at AS "revokedAt"`;

/** Application operations execute only through the restricted, current-actor transaction helpers. */
export class DomainService {
  constructor(private readonly db: Database, private readonly identity: Identity) {}

  private async actor(request: PrivateRequest): Promise<SessionActor> {
    const headers = nodeHeaders(request.headers);
    const actor = await this.identity.currentSession(headers);
    if (!actor) throw new UnauthorizedException();
    if (isMutation(request.method)) {
      assertMutationRequest(request.headers);
      if (!this.identity.verifyCsrf(headers, actor)) throw new ForbiddenException();
    }
    return actor;
  }

  async currentSession(request: PrivateRequest): Promise<CurrentSession> {
    const actor = await this.actor(request);
    return this.db.withActor(actor, async (tx, current) => {
      const memberships = rows<{ tenantId: string; tenantName: string; role: 'tenant_admin' }>(await tx.execute(sql`
        SELECT m.tenant_id AS "tenantId", t.name AS "tenantName", m.role
        FROM gcms_s02.membership m JOIN gcms_s02.tenant t ON t.id = m.tenant_id
        WHERE m.user_id = ${current.userId} AND m.status = 'active' ORDER BY m.tenant_id LIMIT 100`));
      return { user: { id: current.userId, name: current.name, email: current.email,
        emailVerified: current.emailVerified },
      session: { expiresAt: iso(current.sessionExpiresAt) }, platformAdmin: current.platformAdmin,
      tenantMemberships: memberships, csrfToken: this.identity.csrfToken(current) };
    });
  }
  async reauthenticate(request: PrivateRequest, input: unknown) {
    await this.actor(request);
    const result = await this.identity.reauthenticate(nodeHeaders(request.headers), reauthInput(input));
    return { expiresAt: iso(result.expiresAt) };
  }
  async listDrafts(request: PrivateRequest, tenant: string, cursor: unknown): Promise<Page<ServiceDraft>> {
    const tenantId = parseIdentifier(tenant); const scope = `${tenantId}:services`;
    const after = decodePageCursor(cursor, scope); const actor = await this.actor(request);
    return this.db.withReadTenant(actor, tenantId, async tx => {
      const items = rows<ServiceDraft>(await tx.execute(sql`SELECT ${draftColumns} FROM gcms_s02.service_draft
        WHERE tenant_id = ${tenantId} AND (${after}::text IS NULL OR id > ${after}) ORDER BY id LIMIT ${PAGE_SIZE + 1}`));
      return page(items.map(draft), scope, item => item.id);
    });
  }
  async getDraft(request: PrivateRequest, tenant: string, id: string): Promise<ServiceDraft> {
    const tenantId = parseIdentifier(tenant); const draftId = parseIdentifier(id); const actor = await this.actor(request);
    return this.db.withReadTenant(actor, tenantId, async tx => {
      const [value] = rows<ServiceDraft>(await tx.execute(sql`SELECT ${draftColumns} FROM gcms_s02.service_draft
        WHERE tenant_id = ${tenantId} AND id = ${draftId}`));
      if (!value) throw new NotFoundException();
      return draft(value);
    });
  }
  async createDraft(request: PrivateRequest, tenant: string, input: unknown): Promise<ServiceDraft> {
    const tenantId = parseIdentifier(tenant); const value = draftInput(input); const actor = await this.actor(request);
    return this.db.withTenant(actor, tenantId, async (tx, current) => {
      const [saved] = rows<ServiceDraft>(await tx.execute(sql`INSERT INTO gcms_s02.service_draft
        (tenant_id,id,title,body,locale,version,updated_at,updated_by)
        VALUES (${tenantId},${randomUUID()},${value.title},${value.body},'vi',1,now(),${current.userId}) RETURNING ${draftColumns}`));
      await this.audit(tx, current, tenantId, 'draft.created', saved.id);
      return draft(saved);
    });
  }
  async saveDraft(request: PrivateRequest, tenant: string, id: string, input: unknown): Promise<ServiceDraft> {
    const tenantId = parseIdentifier(tenant); const draftId = parseIdentifier(id);
    const value = saveDraftInput(input); const actor = await this.actor(request);
    return this.db.withTenant(actor, tenantId, async (tx, current) => {
      const [saved] = rows<ServiceDraft>(await tx.execute(sql`UPDATE gcms_s02.service_draft SET title=${value.title},body=${value.body},
        version=version+1,updated_at=now(),updated_by=${current.userId}
        WHERE tenant_id=${tenantId} AND id=${draftId} AND version=${value.expectedVersion} RETURNING ${draftColumns}`));
      if (!saved) {
        const found = rows(await tx.execute(sql`SELECT id FROM gcms_s02.service_draft WHERE tenant_id=${tenantId} AND id=${draftId}`));
        if (!found.length) throw new NotFoundException();
        throw new ConflictException();
      }
      await this.audit(tx, current, tenantId, 'draft.saved', saved.id);
      return draft(saved);
    });
  }
  async listTenants(request: PrivateRequest, cursor: unknown): Promise<Page<TenantSummary>> {
    const actor = await this.actor(request); const scope = 'platform:tenants'; const after = decodePageCursor(cursor, scope);
    return this.db.withPlatform(actor, async tx => {
      const items = rows<TenantSummary>(await tx.execute(sql`SELECT id,name,status,created_at AS "createdAt" FROM gcms_s02.tenant
        WHERE (${after}::text IS NULL OR id > ${after}) ORDER BY id LIMIT ${PAGE_SIZE + 1}`));
      return page(items.map(item => ({ ...item, createdAt: iso(item.createdAt) })), scope, item => item.id);
    });
  }
  async provisionTenant(request: PrivateRequest, input: unknown) {
    const value = provisionInput(input); const actor = await this.actor(request);
    const token = randomBytes(32).toString('base64url');
    const result = await this.db.withPlatform(actor, async (tx, current) => {
      await this.identity.requireRecent(current, tx);
      const [tenant] = rows<TenantSummary>(await tx.execute(sql`INSERT INTO gcms_s02.tenant (id,name,status)
        VALUES (${randomUUID()},${value.name},'active') RETURNING id,name,status,created_at AS "createdAt"`));
      // Initialize the explicit policy in the same transaction, before any invitation can be handed off.
      await tx.execute(sql`SELECT gcms_m5.initialize_new_tenant(${tenant.id},${JSON.stringify(value.initialQuotaPolicy)}::text::jsonb)`);
      const invite = await this.insertInvitation(tx, current, tenant.id, value.initialAdminEmail, token);
      await this.audit(tx, current, tenant.id, 'tenant.provisioned', tenant.id);
      return { tenant: { ...tenant, createdAt: iso(tenant.createdAt) }, invitation: invite };
    });
    await this.deliverInvitation(value.initialAdminEmail, token);
    return result;
  }
  async listMembers(request: PrivateRequest, tenant: string, cursor: unknown): Promise<Page<MemberSummary>> {
    const tenantId = parseIdentifier(tenant); const actor = await this.actor(request);
    const scope = `${tenantId}:members`; const after = decodePageCursor(cursor, scope);
    return this.db.withReadTenant(actor, tenantId, async tx => {
      const items = rows<MemberSummary>(await tx.execute(sql`SELECT m.user_id AS "userId",u.name,u.email,m.role,m.status
        FROM gcms_s02.membership m JOIN gcms_s02_auth."user" u ON u.id=m.user_id
        WHERE m.tenant_id=${tenantId} AND (${after}::text IS NULL OR m.user_id>${after}) ORDER BY m.user_id LIMIT ${PAGE_SIZE + 1}`));
      return page(items, scope, item => item.userId);
    });
  }
  async revokeMember(request: PrivateRequest, tenant: string, user: string) {
    const tenantId = parseIdentifier(tenant); const userId = userIdentifier(user); const actor = await this.actor(request);
    return this.db.withTenant(actor, tenantId, async (tx, current) => {
      await this.identity.requireRecent(current, tx);
      await this.audit(tx, current, tenantId, 'membership.revoked', userId);
      const changed = rows(await tx.execute(sql`UPDATE gcms_s02.membership SET status='revoked',updated_at=now()
        WHERE tenant_id=${tenantId} AND user_id=${userId} AND status='active' RETURNING user_id`));
      if (!changed.length) throw new NotFoundException();
      return { status: 'revoked' as const };
    });
  }
  async listInvitations(request: PrivateRequest, tenant: string, cursor: unknown): Promise<Page<InvitationSummary>> {
    const tenantId = parseIdentifier(tenant); const actor = await this.actor(request);
    const scope = `${tenantId}:invitations`; const after = decodePageCursor(cursor, scope);
    return this.db.withReadTenant(actor, tenantId, async tx => {
      const items = rows<InvitationSummary>(await tx.execute(sql`SELECT ${invitationColumns} FROM gcms_s02.invitation
        WHERE tenant_id=${tenantId} AND (${after}::text IS NULL OR id>${after}) ORDER BY id LIMIT ${PAGE_SIZE + 1}`));
      return page(items.map(invitation), scope, item => item.id);
    });
  }
  async inviteMember(request: PrivateRequest, tenant: string, input: unknown) {
    const tenantId = parseIdentifier(tenant); const value = invitationInput(input); const actor = await this.actor(request);
    const token = randomBytes(32).toString('base64url');
    const result = await this.db.withTenant(actor, tenantId, async (tx, current) => {
      await this.identity.requireRecent(current, tx);
      // A new send also invalidates prior unconsumed invitations for the same intended identity.
      await tx.execute(sql`UPDATE gcms_s02.invitation SET revoked_at=now() WHERE tenant_id=${tenantId}
        AND email=${value.email} AND accepted_at IS NULL AND revoked_at IS NULL`);
      return this.insertInvitation(tx, current, tenantId, value.email, token);
    });
    await this.deliverInvitation(value.email, token);
    return result;
  }
  async resendInvitation(request: PrivateRequest, tenant: string, id: string, input: unknown) {
    emptyInput(input); const tenantId = parseIdentifier(tenant); const invitationId = parseIdentifier(id); const actor = await this.actor(request);
    const token = randomBytes(32).toString('base64url');
    const result = await this.db.withTenant(actor, tenantId, async (tx, current) => {
      await this.identity.requireRecent(current, tx);
      const [old] = rows<{ email: string }>(await tx.execute(sql`UPDATE gcms_s02.invitation SET revoked_at=now()
        WHERE tenant_id=${tenantId} AND id=${invitationId} AND accepted_at IS NULL AND revoked_at IS NULL RETURNING email`));
      if (!old) throw new ConflictException();
      return this.insertInvitation(tx, current, tenantId, old.email, token);
    });
    await this.deliverInvitation(result.email, token);
    return result;
  }
  async revokeInvitation(request: PrivateRequest, tenant: string, id: string) {
    const tenantId = parseIdentifier(tenant); const invitationId = parseIdentifier(id); const actor = await this.actor(request);
    return this.db.withTenant(actor, tenantId, async (tx, current) => {
      await this.identity.requireRecent(current, tx);
      const changed = rows(await tx.execute(sql`UPDATE gcms_s02.invitation SET revoked_at=now()
        WHERE tenant_id=${tenantId} AND id=${invitationId} AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id`));
      if (!changed.length) throw new ConflictException();
      await this.audit(tx, current, tenantId, 'invitation.revoked', invitationId);
      return { status: 'revoked' as const };
    });
  }
  async acceptInvitation(request: PrivateRequest, input: unknown) {
    const value = acceptInput(input); const actor = await this.actor(request);
    if (!actor.emailVerified) throw new ForbiddenException();
    return this.db.withInvitation(actor, createHash('sha256').update(value.token).digest('hex'), async (tx, current, invite) => {
      await this.identity.requireRecent(current, tx);
      await tx.execute(sql`INSERT INTO gcms_s02.membership (tenant_id,user_id,role,status)
        VALUES (${invite.tenant_id},${current.userId},'tenant_admin','active')
        ON CONFLICT (tenant_id,user_id) DO UPDATE SET role='tenant_admin',status='active',updated_at=now()`);
      await tx.execute(sql`UPDATE gcms_s02.invitation SET accepted_at=now() WHERE id=${invite.id} AND tenant_id=${invite.tenant_id}`);
      await this.audit(tx, current, invite.tenant_id, 'invitation.accepted', invite.id);
      return { tenantId: invite.tenant_id, role: 'tenant_admin' as const };
    });
  }
  async disableUser(request: PrivateRequest, user: string, input: unknown) {
    emptyInput(input); const actor = await this.actor(request); const targetId = userIdentifier(user);
    return this.db.disableUser(actor, targetId);
  }
  private async insertInvitation(tx: S02Transaction, actor: SessionActor, tenantId: string, email: string, token: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const [created] = rows<InvitationSummary>(await tx.execute(sql`INSERT INTO gcms_s02.invitation
      (id,tenant_id,email,token_hash,expires_at,created_by) VALUES
      (${randomUUID()},${tenantId},${email},${hash},now()+interval '24 hours',${actor.userId}) RETURNING ${invitationColumns}`));
    await this.audit(tx, actor, tenantId, 'invitation.created', created.id);
    return invitation(created);
  }
  private async audit(tx: S02Transaction, actor: SessionActor, tenantId: string | null, event: string, targetId: string) {
    await tx.execute(sql`INSERT INTO gcms_s02.audit_event (id,tenant_id,actor_id,event,target_id)
      VALUES (${randomUUID()},${tenantId},${actor.userId},${event},${targetId})`);
  }
  private async deliverInvitation(email: string, token: string) {
    // Fragment keeps the one-use token out of HTTP paths, referrers and access logs.
    await sendLocalMail({ to: email, type: 'invitation', url: `${ADMIN_ORIGIN}/invitations#token=${encodeURIComponent(token)}` });
  }
}
